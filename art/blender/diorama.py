"""
Build a vector drawing as a small paper-and-clay diorama in Blender, and render it.

    python -I art/blender/diorama.py --svg in.svg --out out.png [--mode cover|part] [options]

## Why the drawings are *built*, not redrawn

Every piece of art on the site already exists as a vector drawing, and each one carries decisions
that were argued for in its generator: what a cover may show about an entry, what it must not
(no company marks, no legible interface copy, nothing from a confidential deck), which hue its
category owns. Redrawing thirty pictures by hand in Blender would re-open every one of those
decisions and settle them by eye. Lifting the existing drawing into 3D settles none of them again:
the composition, the colours and the omissions are the vector's, and Blender adds only what a flat
drawing cannot have — thickness, light, shadow, the texture of paper.

So this is an importer with opinions, and the opinions are the whole style:

- **A filled shape is a piece of card.** Extruded by `CARD_DEPTH`, its edges rounded by
  `CARD_BEVEL`, and laid *on whatever card is already under it* — the painter's order of the SVG
  becomes physical stacking, so a sheet rests on the board, a chip rests on the sheet, and each
  casts its shadow on what it rests on. (The first version stacked by document order alone, so a
  ruled line drawn late floated a dozen layers above the sheet it belongs to and cast a blurred
  ghost of itself. Resting on the surface beneath is what paper does.)
- **A drawn drop-shadow is dropped.** The flat drawings fake depth with a faint copy of a shape,
  offset down and right, drawn just before it. Real light now casts that shadow, and keeping the
  fake one would show two.
- **A faint shape is ink, not card.** Below `INK_OPACITY` a fill was a tint or a drawn shadow in the
  flat version. Real light now makes the shadows, so those become a print on the surface beneath
  them: no thickness, alpha kept.
- **A stroke is a rolled tube** of the stroke's width (a wire, a piece of string), so a line chart
  or a graph edge stands up off the page. Dashes become beads.
- **The first full-canvas rectangle is the board** everything sits on, extended past the frame so
  the tilted camera never sees its edge.
- **Text is not built.** The covers' only text is the credit line and a location chip, and those
  stay as vector on top of the render (see `scripts/art-render.mjs`) — crisp at any size. The
  camera moves things, though, so a chip is no longer where the flat drawing had it. `--anchors`
  takes each text's anchor point, finds the surface it lies on, projects it through the camera and
  writes back the local affine transform (where the point lands, and how a unit step in x and in y
  lands), which the wrapper applies to the text so it sits on its chip, foreshortened with it.

`--mode part` is the second use: one silhouette (a piece of the cat), inflated into a soft clay
form, seen straight on through an orthographic camera fitted exactly to the shape's bounding box,
on a transparent film. The site paints that render *inside* the original vector path, so the
outline, the hit area and every animation of the part are untouched.

Every number that shapes the look is a named constant below, with its reason.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from svgelements import SVG, Close, Color, CubicBezier, Line, Move, Path, QuadraticBezier, Arc, Shape, Text

# ---------------------------------------------------------------------------------------------
# The look, in numbers
# ---------------------------------------------------------------------------------------------

#: SVG user units per Blender metre. A 1600-unit cover becomes a 16 m board: the scale only
#: matters for the bevel and light sizes below, which are all expressed in these metres.
UNITS_PER_M = 100.0

#: Thickness of one piece of card, in SVG units. Thin enough that a stack of six still reads as
#: paper rather than as blocks; thick enough to catch a highlight along its bevel.
CARD_DEPTH = 6.0
#: Edge rounding of a card. Half its thickness rounds the rim fully, which reads as clay;
#: a third keeps a flat face with a soft edge, which reads as card.
CARD_BEVEL = 2.0
#: Air between a card and the surface it rests on — enough for a contact shadow to form under
#: the bevel, too little to read as floating.
LAYER_GAP = 1.0
#: Below this opacity a fill was a tint or a hand-drawn shadow; it becomes a print, not a card.
INK_OPACITY = 0.42
#: How far above its surface a print floats, to avoid z-fighting with the card beneath.
INK_LIFT = 0.25
#: A faint fill followed by a same-sized opaque shape nudged by at most this much is a drawn
#: drop-shadow (see above).
DRAWN_SHADOW_ALPHA = 0.3
DRAWN_SHADOW_MAX_OFFSET = 40.0

#: Board margin beyond the canvas, as a fraction of the canvas, so the tilted view never reaches
#: the board's edge.
BOARD_OVERSCAN = 0.6

#: Camera: a long lens looking down at the board, tipped back from vertical. Long lens because
#: it flattens perspective — the composition keeps its proportions and only gains depth.
LENS_MM = 105.0
TILT_DEG = 20.0
#: Focus on the centre of the board with a modest aperture: enough fall-off at the far edge to
#: read as a miniature, not so much that the drawing stops being legible.
F_STOP = 6.0

#: Key light: a sun from the upper left, high enough that shadows stay short and inside their
#: piece's neighbourhood. `angle` is the sun's apparent size — larger is a softer shadow edge.
SUN_ELEVATION_DEG = 42.0
SUN_AZIMUTH_DEG = 135.0
SUN_ANGLE_DEG = 6.0
#: Ambient: a flat world of the board's own colour, so shadows are tinted by the paper rather
#: than going grey. Its share of the light is the depth of a shadow: 0.5 means a shaded surface
#: shows half its colour.
WORLD_STRENGTH = 0.5
#: The sun's strength is not free: a flat surface facing up must come out at its own colour, so
#: the drawing's palette survives (sun irradiance × sin(elevation) / π + ambient = 1).
SUN_STRENGTH = (1 - WORLD_STRENGTH) * math.pi / math.sin(math.radians(SUN_ELEVATION_DEG))

#: Paper: rough, faintly sheened, with a fine tooth from procedural noise. The bump is kept small:
#: it should show in the highlights and never as pattern.
ROUGHNESS = 0.72
SHEEN = 0.25
PAPER_TOOTH_SCALE = 260.0
PAPER_TOOTH_STRENGTH = 0.06

#: Cycles samples with the OpenImageDenoise pass. 64 is past the point where the denoiser has
#: anything left to invent on surfaces this simple.
SAMPLES = 64

# part mode -----------------------------------------------------------------------------------

#: Inflation of a part, as a fraction of its half-thickness. The bevel *is* the form: at 0.85 a
#: leg is a round limb rather than a flat cut-out. Half-thickness is measured as area ÷ perimeter
#: (exact for a long strip of constant width, and close for a blob), not from the bounding box —
#: the tail is a thin curve in a wide box, and a bevel sized to the box shrank it to nothing.
PART_BEVEL_FRACTION = 0.85
#: Render scale of a part in pixels per SVG unit. The cat is drawn in a 64×40 box and shown at
#: 48×30 CSS pixels; 8 px/unit covers a 3× screen with room to spare.
PART_PX_PER_UNIT = 8


# ---------------------------------------------------------------------------------------------
# Colour
# ---------------------------------------------------------------------------------------------

HSL_SPACED = re.compile(r"hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)")


def normalise_colours(text: str) -> str:
    """CSS Color 4 `hsl(h s% l%)` → the comma form svgelements reads. It silently paints the
    spaced form black, which is the failure this exists to prevent."""
    return HSL_SPACED.sub(lambda m: f"hsl({m[1]},{m[2]}%,{m[3]}%)", text)


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_rgba(col: Color) -> tuple[float, float, float, float]:
    return (
        srgb_to_linear(col.red / 255),
        srgb_to_linear(col.green / 255),
        srgb_to_linear(col.blue / 255),
        col.opacity if col.opacity is not None else 1.0,
    )


# ---------------------------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------------------------


def reset_scene() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    # "Standard", not AgX/Filmic: the palette is a design token, and a tone curve would move it.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    return scene


_materials: dict[tuple, bpy.types.Material] = {}


def paper_material(rgba: tuple[float, float, float, float], ink: bool = False) -> bpy.types.Material:
    key = (tuple(round(v, 4) for v in rgba), ink)
    if key in _materials:
        return _materials[key]
    mat = bpy.data.materials.new(f"paper-{len(_materials)}")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgba[:3], 1.0)
    bsdf.inputs["Roughness"].default_value = ROUGHNESS
    bsdf.inputs["Sheen Weight"].default_value = 0.0 if ink else SHEEN
    bsdf.inputs["Alpha"].default_value = rgba[3]
    # The tooth: a fine noise driving a faint bump, shared by every piece so the board reads as
    # one stock of paper.
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = PAPER_TOOTH_SCALE
    noise.inputs["Detail"].default_value = 6.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = PAPER_TOOTH_STRENGTH
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    _materials[key] = mat
    return mat


def to_world(x: float, y: float, w: float, h: float) -> tuple[float, float]:
    """SVG (y down, origin top-left) → Blender (y up, origin at the canvas centre), in metres."""
    return ((x - w / 2) / UNITS_PER_M, (h / 2 - y) / UNITS_PER_M)


def subpaths(path: Path):
    """Split a path into its subpaths as lists of segments, arcs flattened to cubics."""
    current: list = []
    for seg in path.segments(transformed=True):
        if isinstance(seg, Move):
            if current:
                yield current
            current = [seg]
        elif isinstance(seg, Arc):
            current.extend(seg.as_cubic_curves())
        else:
            current.append(seg)
    if current:
        yield current


def curve_from_path(name: str, path: Path, w: float, h: float, z: float, three_d: bool) -> bpy.types.Object:
    """A Blender bezier curve with exactly the SVG's geometry: lines become vector handles,
    cubics and quadratics keep their control points."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D" if three_d else "2D"
    for segs in subpaths(path):
        start = segs[0].end if isinstance(segs[0], Move) else segs[0].start
        closed = any(isinstance(s, Close) for s in segs)
        pts: list[dict] = [{"co": start, "left": None, "right": None}]
        for s in segs[1:]:
            if isinstance(s, Close):
                if s.start is not None and s.end is not None and abs(s.start - s.end) > 1e-6:
                    pts.append({"co": s.end, "left": None, "right": None})
                continue
            if isinstance(s, CubicBezier):
                pts[-1]["right"] = s.control1
                pts.append({"co": s.end, "left": s.control2, "right": None})
            elif isinstance(s, QuadraticBezier):
                c1 = s.start + (s.control - s.start) * (2 / 3)
                c2 = s.end + (s.control - s.end) * (2 / 3)
                pts[-1]["right"] = c1
                pts.append({"co": s.end, "left": c2, "right": None})
            elif isinstance(s, Line):
                pts.append({"co": s.end, "left": None, "right": None})
        # A closed path that returns to its start would leave a duplicate point.
        if closed and len(pts) > 1 and abs(complex(*pts[0]["co"]) - complex(*pts[-1]["co"])) < 1e-6:
            pts[0]["left"] = pts[-1]["left"]
            pts.pop()
        if len(pts) < 2:
            continue
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(len(pts) - 1)
        for bp, p in zip(sp.bezier_points, pts):
            bp.co = (*to_world(p["co"][0], p["co"][1], w, h), z)
            for side in ("left", "right"):
                ctrl = p[side]
                handle = getattr(bp, f"handle_{side}")
                if ctrl is None:
                    setattr(bp, f"handle_{side}_type", "VECTOR")
                else:
                    setattr(bp, f"handle_{side}_type", "FREE")
                    setattr(bp, f"handle_{side}", (*to_world(ctrl[0], ctrl[1], w, h), z))
        # VECTOR handles need recomputing once their neighbours exist.
        for bp in sp.bezier_points:
            for side in ("left", "right"):
                if getattr(bp, f"handle_{side}_type") == "VECTOR":
                    setattr(bp, f"handle_{side}_type", "VECTOR")
        sp.use_cyclic_u = closed
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    return ob


def dashes(path: Path, pattern: list[float]):
    """Cut a stroked path into its dashes, as short straight paths. Lengths along the path are
    measured on a fine polyline, which is plenty for the dotted rules the drawings use."""
    total = path.length()
    if not total or not pattern or sum(pattern) <= 0:
        return [path]
    out: list[Path] = []
    pos, i, on = 0.0, 0, True
    while pos < total:
        step = pattern[i % len(pattern)]
        if on and step > 0:
            a, b = pos / total, min(pos + step, total) / total
            pa, pb = path.point(a), path.point(b)
            seg = Path(Move(pa), Line(pa, pb)) if abs(pb - pa) > 1e-6 else Path(Move(pa), Line(pa, pa + 0.01))
            out.append(seg)
        pos += step
        i += 1
        on = not on
    return out


def flat_colour(el, attr: str, raw: dict) -> Color | None:
    """The colour of a fill or stroke, or None. Patterns are skipped (the faint ledger grids are
    surface texture that the paper tooth now provides); gradients take their first stop."""
    value = el.values.get(attr)
    if value in (None, "none"):
        return None
    if isinstance(value, str) and value.startswith("url("):
        ref = value[5:-1]
        return raw.get(ref)
    col = getattr(el, attr)
    if col is None or col.value is None:
        return None
    return col


def gradient_first_stops(text: str) -> dict:
    stops: dict = {}
    for m in re.finditer(r"<(linear|radial)Gradient[^>]*id=\"([^\"]+)\"(.*?)</\1Gradient>", text, re.S):
        s = re.search(r"stop-color=\"([^\"]+)\"", m[3])
        if s:
            stops[m[2]] = Color(s[1])
    return stops


# ---------------------------------------------------------------------------------------------
# Cover mode
# ---------------------------------------------------------------------------------------------


def build_cover(svg_text: str, scale: float, icon: bool = False):
    svg = SVG.parse(__import__("io").StringIO(svg_text), reify=True)
    w, h = float(svg.width), float(svg.height)
    gradients = gradient_first_stops(svg_text)

    def full_canvas(bb) -> bool:
        return bb[0] <= 0.5 and bb[1] <= 0.5 and bb[2] >= w - 0.5 and bb[3] >= h - 0.5

    shapes = []
    for el in svg.elements():
        if isinstance(el, Text) or not isinstance(el, Shape):
            continue
        # `abs()` bakes the element's transform into the geometry. `segments(transformed=True)`
        # applies it, but `point()` and `length()` do not — and the outline test and the dashes are
        # built on those, so inside the rotated phones of `split-bill` they measured an unrotated
        # phone, and the icon strokes came to rest beneath the card they are drawn on.
        path = abs(Path(el))
        bb = path.bbox(transformed=True)
        if bb is not None:
            shapes.append((el, path, bb))

    # Cards placed so far: (bbox, outline, top) in SVG units. A new piece rests on the highest
    # card that any part of it overlaps — by outline, not bounding box, because the drawings tilt
    # things (the phones in `split-bill` are rotated 12° and 13°), and a rotated shape's box claims
    # a great deal of empty corner. Resting on the box's centre alone put two overlapping phones at
    # the same height, where they cut into each other and the overlap rendered black.
    cards: list[tuple[tuple, list, float]] = []

    def outline(path: Path, n: int = 48) -> list[tuple[float, float]]:
        pts = [path.point(t / n) for t in range(n)]
        return [(p[0], p[1]) for p in pts if p is not None]

    def inside(pt, poly) -> bool:
        x, y = pt
        hit = False
        for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                hit = not hit
        return hit

    def surface_under(bb, path: Path) -> float:
        probe = outline(path, 24) + [((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)]
        best = 0.0
        for b, poly, top in cards:
            if top <= best or b[2] < bb[0] or b[0] > bb[2] or b[3] < bb[1] or b[1] > bb[3]:
                continue
            if any(inside(p, poly) for p in probe):
                best = top
        return best

    board_done = False
    world_colour = None
    tallest = 0.0
    for i, (el, path, bb) in enumerate(shapes):
        opacity = float(el.values.get("opacity", 1.0) or 1.0)
        fill = flat_colour(el, "fill", gradients)
        stroke = flat_colour(el, "stroke", gradients)

        if icon and world_colour is None and fill is not None:
            # An icon has no board: its first shape (the rounded tile) is the object itself, and
            # the room is a neutral white so the tile keeps its own colour.
            world_colour = (1.0, 1.0, 1.0, 1.0)
            board_done = True
        if not board_done and fill is not None and full_canvas(bb):
            ox, oy = w * BOARD_OVERSCAN, h * BOARD_OVERSCAN
            bpy.ops.mesh.primitive_plane_add(size=1)
            board = bpy.context.object
            board.scale = ((w + 2 * ox) / UNITS_PER_M, (h + 2 * oy) / UNITS_PER_M, 1)
            board.data.materials.append(paper_material(linear_rgba(fill)))
            world_colour = linear_rgba(fill)
            board_done = True
            continue
        if fill is None and stroke is None:
            continue

        base = surface_under(bb, path)

        if fill is not None:
            rgba = linear_rgba(fill)
            alpha = rgba[3] * opacity
            if alpha < DRAWN_SHADOW_ALPHA and stroke is None and i + 1 < len(shapes):
                nb = shapes[i + 1][2]
                same_size = abs((nb[2] - nb[0]) - (bb[2] - bb[0])) < 1.5 and abs((nb[3] - nb[1]) - (bb[3] - bb[1])) < 1.5
                nudged = 0 < abs(nb[0] - bb[0]) + abs(nb[1] - bb[1]) <= DRAWN_SHADOW_MAX_OFFSET
                if same_size and nudged:
                    continue
            ink = alpha < INK_OPACITY or (full_canvas(bb) and not icon)
            ob = curve_from_path(f"fill-{i}", path, w, h, 0.0, three_d=False)
            cu = ob.data
            cu.fill_mode = "BOTH"
            if ink:
                ob.location.z = (base + INK_LIFT) / UNITS_PER_M
                ob.visible_shadow = False
            else:
                cu.extrude = (CARD_DEPTH / 2) / UNITS_PER_M
                cu.bevel_depth = min(CARD_BEVEL, CARD_DEPTH / 2) / UNITS_PER_M
                cu.bevel_resolution = 3
                cu.offset = -cu.bevel_depth  # keep the silhouette where the drawing put it
                # Extrusion is symmetric about the curve's plane: lift by half so it rests.
                ob.location.z = (base + LAYER_GAP + CARD_DEPTH / 2) / UNITS_PER_M
                top = base + LAYER_GAP + CARD_DEPTH
                cards.append((bb, outline(path), top))
                tallest = max(tallest, top)
            cu.materials.append(paper_material((*rgba[:3], alpha), ink=ink))

        if stroke is not None:
            rgba = linear_rgba(stroke)
            alpha = rgba[3] * opacity
            width = float(el.stroke_width or 1.0) * scale
            raw = el.values.get("stroke-dasharray")
            pattern = [float(v) for v in re.split(r"[ ,]+", raw.strip())] if raw and raw != "none" else []
            pieces = dashes(path, pattern) if pattern else [path]
            # A stroke round a card it belongs to sits on that card's top; otherwise on the surface.
            rest = cards[-1][2] if (fill is not None and cards and cards[-1][0] is bb) else base
            for k, piece in enumerate(pieces):
                ob = curve_from_path(f"stroke-{i}-{k}", piece, w, h, 0.0, three_d=True)
                cu = ob.data
                cu.bevel_depth = (width / 2) / UNITS_PER_M
                cu.bevel_resolution = 4
                cu.use_fill_caps = True
                faint = alpha < INK_OPACITY
                # A faint rule is printed; a firm one is a wire lying on the surface.
                ob.location.z = (rest + (INK_LIFT if faint else width / 2)) / UNITS_PER_M
                if faint:
                    cu.bevel_depth = (width / 2) / UNITS_PER_M
                    ob.scale.z = 0.05
                    ob.visible_shadow = False
                cu.materials.append(paper_material((*rgba[:3], alpha), ink=faint))
            tallest = max(tallest, rest + width)
    if not board_done:
        raise SystemExit("no full-canvas background rectangle to use as the board")
    light_and_camera_cover(w, h, world_colour, tallest)
    if icon:
        # Straight down and orthographic: an app icon is a flat tile seen square-on, and the
        # launcher supplies its own perspective.
        cam = bpy.context.scene.camera
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = w / UNITS_PER_M
        cam.data.dof.use_dof = False
        cam.location = (0, 0, 10)
        cam.rotation_euler = (0, 0, 0)
        bpy.context.scene.render.film_transparent = True

    def surface_at(x: float, y: float) -> float:
        return max((top for b, poly, top in cards if b[0] <= x <= b[2] and b[1] <= y <= b[3] and inside((x, y), poly)), default=0.0)

    return w, h, surface_at


def light_and_camera_cover(w: float, h: float, world_rgba, tallest: float) -> None:
    scene = bpy.context.scene
    world = bpy.data.worlds.new("paper-room")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*world_rgba[:3], 1.0)
    bg.inputs["Strength"].default_value = WORLD_STRENGTH
    scene.world = world

    sun_data = bpy.data.lights.new("key", "SUN")
    sun_data.energy = SUN_STRENGTH
    sun_data.angle = math.radians(SUN_ANGLE_DEG)
    sun = bpy.data.objects.new("key", sun_data)
    el, az = math.radians(SUN_ELEVATION_DEG), math.radians(SUN_AZIMUTH_DEG)
    sun.rotation_euler = (math.pi / 2 - el, 0, az - math.pi / 2)
    bpy.context.collection.objects.link(sun)

    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = LENS_MM
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.sensor_width = 36.0
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    # Distance at which the canvas width fills the frame, from the lens's horizontal field of view.
    fov = 2 * math.atan(cam_data.sensor_width / (2 * cam_data.lens))
    half_w = w / 2 / UNITS_PER_M
    dist = half_w / math.tan(fov / 2) * 1.02
    mid_z = tallest / UNITS_PER_M / 2
    tilt = math.radians(TILT_DEG)
    target = Vector((0, 0, mid_z))
    cam.location = target + Vector((0, -math.sin(tilt) * dist, math.cos(tilt) * dist))
    cam.rotation_euler = (tilt, 0, 0)
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = dist
    cam_data.dof.aperture_fstop = F_STOP


# ---------------------------------------------------------------------------------------------
# Part mode
# ---------------------------------------------------------------------------------------------


def build_part(svg_text: str, colour: str) -> tuple[int, int]:
    """One silhouette, inflated, seen straight on. The SVG holds exactly one path in its own
    viewBox; the camera is fitted to that path's bounding box so the render maps 1:1 onto the
    path's `objectBoundingBox` on the site."""
    scene = bpy.context.scene
    svg = SVG.parse(__import__("io").StringIO(svg_text), reify=True)
    shape = next(el for el in svg.elements() if isinstance(el, Shape))
    path = abs(Path(shape))
    x0, y0, x1, y1 = path.bbox(transformed=True)
    bw, bh = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    # Build in a frame centred on the part, so the camera can sit at the origin.
    ob = curve_from_path("part", path, 2 * cx, 2 * cy, 0.0, three_d=False)
    cu = ob.data
    cu.fill_mode = "BOTH"
    poly = [path.point(t / 400) for t in range(400)]
    poly = [(p[0], p[1]) for p in poly]
    area = abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]))) / 2
    perimeter = sum(math.dist(a, b) for a, b in zip(poly, poly[1:] + poly[:1]))
    bevel = (area / perimeter) * PART_BEVEL_FRACTION / UNITS_PER_M
    cu.extrude = bevel * 0.35
    cu.bevel_depth = bevel
    cu.bevel_resolution = 6
    cu.offset = -bevel
    mat = paper_material(linear_rgba(Color(colour)))
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.55
    # Matte clay. On a near-black albedo the default specular and the paper's sheen reflect the
    # white room and dominate the colour — the light theme's cat came out grey, not ink.
    bsdf.inputs["Sheen Weight"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.18
    cu.materials.append(mat)

    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = WORLD_STRENGTH
    scene.world = world
    key = bpy.data.lights.new("key", "SUN")
    key.angle = math.radians(20)
    sun = bpy.data.objects.new("key", key)
    # From the upper front left of the cat, so the top of each form catches the light.
    tilt_x, tilt_y = math.radians(38), math.radians(-28)
    sun.rotation_euler = (tilt_x, tilt_y, 0)
    # Calibrated like the covers: the face turned to the camera comes out at the ink colour itself,
    # so the cat is still `--color-ink` where it faces you and only gains light and shade around
    # the form. (Uncalibrated, the light theme's near-black cat came out a mid grey.)
    facing = math.cos(tilt_x) * math.cos(tilt_y)
    key.energy = (1 - WORLD_STRENGTH) * math.pi / facing
    bpy.context.collection.objects.link(sun)

    cam_data = bpy.data.cameras.new("ortho")
    cam_data.type = "ORTHO"
    cam_data.sensor_fit = "HORIZONTAL" if bw >= bh else "VERTICAL"
    cam_data.ortho_scale = max(bw, bh) / UNITS_PER_M
    cam = bpy.data.objects.new("ortho", cam_data)
    cam.location = (0, 0, 10)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    scene.render.film_transparent = True
    rx = max(8, round(bw * PART_PX_PER_UNIT))
    ry = max(8, round(bh * PART_PX_PER_UNIT))
    return rx, ry


# ---------------------------------------------------------------------------------------------


def write_anchors(src: str, dest: str, w: float, h: float, surface_at) -> None:
    """Each anchor's local projection, as an SVG `matrix(a b c d e f)` in canvas units: the
    anchor lands where the camera sees it, and the unit steps around it are carried by the same
    projection, so text drawn about the anchor is foreshortened with the surface it lies on."""
    scene = bpy.context.scene
    cam = scene.camera
    # The camera was placed by setting location and rotation; its world matrix is only rebuilt on
    # a scene update, and projecting through the stale identity matrix put the text ~18 000 times
    # too large and off the canvas.
    bpy.context.view_layer.update()
    STEP = 10.0  # SVG units: small enough to be local, large enough to stay clear of rounding

    def project(x: float, y: float, z: float) -> tuple[float, float]:
        wx, wy = to_world(x, y, w, h)
        u, v, _ = world_to_camera_view(scene, cam, Vector((wx, wy, z / UNITS_PER_M)))
        return u * w, (1 - v) * h

    out = []
    for x, y in json.load(open(src)):
        z = surface_at(x, y) + INK_LIFT
        px, py = project(x, y, z)
        ax, ay = project(x + STEP, y, z)
        bx, by = project(x, y + STEP, z)
        a, b = (ax - px) / STEP, (ay - py) / STEP
        c, d = (bx - px) / STEP, (by - py) / STEP
        out.append([a, b, c, d, px - (a * x + c * y), py - (b * x + d * y)])
    json.dump(out, open(dest, "w"))


def main(argv: list[str]) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--svg", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--mode", choices=["cover", "part", "icon"], default="cover")
    ap.add_argument("--width", type=int, help="output width in px (cover mode); height follows the canvas")
    ap.add_argument("--colour", default="#2a2520", help="albedo for part mode")
    ap.add_argument("--samples", type=int, default=SAMPLES)
    ap.add_argument("--anchors", help="JSON list of [x, y] text anchors, in SVG units (cover mode)")
    ap.add_argument("--anchors-out", help="where to write each anchor's affine transform")
    args = ap.parse_args(argv)

    text = normalise_colours(open(args.svg, encoding="utf8").read())
    scene = reset_scene()
    scene.cycles.samples = args.samples
    if args.mode in ("cover", "icon"):
        # Stroke widths are in user units already after reify; scale stays 1.
        w, h, surface_at = build_cover(text, 1.0, icon=args.mode == "icon")
        px = args.width or int(w)
        scene.render.resolution_x = px
        scene.render.resolution_y = round(px * h / w)
        if args.anchors:
            write_anchors(args.anchors, args.anchors_out, w, h, surface_at)
    else:
        rx, ry = build_part(text, args.colour)
        scene.render.resolution_x, scene.render.resolution_y = rx, ry
    scene.render.resolution_percentage = 100
    scene.render.filepath = args.out
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main(sys.argv[1:])

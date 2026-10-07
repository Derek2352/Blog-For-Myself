"""
The covers, built as studio still lifes in Blender.

    python -I art/blender/scenes.py --template skyline --seed <slug> --hue 26 \
        --theme light|dark --out cover.png [--location "…"] [--width 1440] [--samples 64]

## The series

Every cover is one photograph from the same imaginary studio: a small sculptural arrangement about
the entry, standing on a seamless paper sweep the colour of its category. What makes twenty-four of
them read as a series rather than a collection is that everything except the subject is shared:

- **the set** — a cyclorama (floor curving into wall, no horizon), the paper tinted by the
  category's hue, so a category's covers are visibly kin and the site's colour system carries
  through into the pictures;
- **the materials** — a small, fixed cast: glazed and matte ceramic, travertine, brushed brass,
  frosted and clear glass, linen, card. Nothing photoreal for its own sake, nothing plastic;
- **the light** — by day, a low window to the left whose mullions fall across the sweep, with a
  large soft fill and a rim from behind; by night (the dark theme), the window is gone and a single
  warm lamp pools on the set, the rim turns cool, and whatever in the scene can glow — a window, a
  screen, a filament — does;
- **the camera** — one lens and one height: a 70 mm, a little above the table, focused on the
  subject with a shallow fall-off, so every cover is seen the way the same photographer would see it.

## What a cover may show

The subjects keep the rules the flat drawings were written under (scripts/cover-art.mjs): a cover
says what the work was *about*, never what it contained. No company marks, no legible interface
copy, no figures from anything confidential, nothing that could be read as a screenshot of a
product. The only lettering anywhere is a trip's location, on a luggage tag, because that is
already public on the page beside it.

Every number that shapes the look is named below with its reason; per-entry variety comes from a
generator seeded with the entry's slug, so a cover is the same every time it is rendered.
"""

from __future__ import annotations

import argparse
import colorsys
import math
import os
import random
import sys

import bpy  # first: importing bpy is what puts bmesh and mathutils on the path

import bmesh
from mathutils import Euler, Matrix, Vector

# ---------------------------------------------------------------------------------------------
# The shared look
# ---------------------------------------------------------------------------------------------

#: The lens. Long enough that the arrangement keeps its proportions, short enough that the sweep
#: still curves away behind it.
LENS_MM = 70.0
#: Camera elevation above the table, degrees. A little above eye level: the tops of things show,
#: but the subject still stands up rather than lying down as a plan.
CAMERA_ELEVATION_DEG = 17.0
#: Aperture. Enough fall-off that the back of the sweep softens and the subject separates; not so
#: much that a twelve-piece arrangement loses its far pieces.
F_STOP = 4.0

#: The window: a sun from the left and slightly behind the camera, low enough that its mullion
#: shadows fall long across the floor and climb the sweep.
SUN_ELEVATION_DEG = 34.0
SUN_AZIMUTH_DEG = 212.0  # measured from +X, counter-clockwise: left, toward the camera
SUN_ANGLE_DEG = 1.0  # apparent size — small, so the mullions stay legible as shadows
SUN_STRENGTH = 6.5

#: The cyclorama: how far the floor runs back before it curves up, and the curve's radius.
SWEEP_DEPTH = 1.1
SWEEP_RADIUS = 1.3

#: Cycles. Adaptive sampling stops a pixel when it is clean; the denoiser finishes the job.
SAMPLES = 64
ADAPTIVE_THRESHOLD = 0.02

#: The paper colour, from the category hue: light and gently saturated by day, deep by night.
#: (Lightness, saturation) in HLS. Tuned so the day sweep sits a shade under the page's surface
#: and the night sweep a shade over the dark theme's.
DAY_PAPER = (0.74, 0.50)
NIGHT_PAPER = (0.13, 0.32)

# The cast of colours, from the design tokens (src/design/tokens.mjs), as sRGB.
CREAM = (0.955, 0.935, 0.895)
BONE = (0.90, 0.875, 0.83)
INK = (0.165, 0.141, 0.118)
WINE = (0.557, 0.184, 0.271)
AMBER = (0.910, 0.631, 0.227)
SAGE = (0.392, 0.459, 0.329)
SAGE_LIGHT = (0.70, 0.75, 0.62)
BRASS = (0.83, 0.64, 0.36)
TRAVERTINE = (0.86, 0.80, 0.70)
DUSK = (0.36, 0.42, 0.56)


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(rgb) -> tuple[float, float, float, float]:
    return (*(srgb_to_linear(c) for c in rgb[:3]), 1.0)


def hue_colour(hue: float, light: float, sat: float):
    return colorsys.hls_to_rgb((hue % 360) / 360, light, sat)


def mix(a, b, t: float):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


# ---------------------------------------------------------------------------------------------
# Scene plumbing
# ---------------------------------------------------------------------------------------------


class Ctx:
    """What a template is handed: the theme, its rng, the category's colours and the materials."""

    def __init__(self, theme: str, seed: str, hue: float, location: str | None):
        self.theme = theme
        self.night = theme == "dark"
        self.rng = random.Random(seed)
        self.hue = hue
        self.location = location
        self.paper = hue_colour(hue, *(NIGHT_PAPER if self.night else DAY_PAPER))
        #: The category colour as an object would wear it: a glaze, deeper than the paper.
        self.glaze = hue_colour(hue, 0.42, 0.45)
        self._mats: dict = {}
        self.focus = Vector((0, 0, 0.12))
        self.frame_width = 1.25
        self.elevation = CAMERA_ELEVATION_DEG

    # -- materials ---------------------------------------------------------------------------

    def mat(self, kind: str, colour=CREAM, **kw) -> bpy.types.Material:
        key = (kind, tuple(round(c, 4) for c in colour[:3]), tuple(sorted(kw.items())))
        if key in self._mats:
            return self._mats[key]
        m = bpy.data.materials.new(f"{kind}-{len(self._mats)}")
        m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = lin(colour)
        presets = {
            # Matte ceramic: the default body of things. A faint coat for the glaze's sheen.
            "ceramic": dict(rough=0.42, coat=0.25, coat_rough=0.25),
            # Glazed: the hero pieces. Full clear coat over a smooth body.
            "glaze": dict(rough=0.22, coat=1.0, coat_rough=0.06),
            # Clay: unglazed, slightly translucent at the edges.
            "clay": dict(rough=0.78, sss=0.12),
            # Wax: soft, and lit from within where it is thin.
            "wax": dict(rough=0.5, sss=0.85, coat=0.1, coat_rough=0.4),
            "card": dict(rough=0.86, sheen=0.35),
            "linen": dict(rough=0.95, sheen=0.8),
            "travertine": dict(rough=0.62),
            "brass": dict(rough=0.32, metal=1.0),
            "steel": dict(rough=0.22, metal=1.0),
            "glass": dict(rough=0.02, trans=1.0, ior=1.45),
            "frost": dict(rough=0.32, trans=1.0, ior=1.45),
            "water": dict(rough=0.04, coat=0.0),
            "wood": dict(rough=0.55, coat=0.15, coat_rough=0.3),
            "emit": dict(rough=0.5),
        }[kind]
        b.inputs["Roughness"].default_value = presets.get("rough", 0.5)
        b.inputs["Metallic"].default_value = presets.get("metal", 0.0)
        b.inputs["Coat Weight"].default_value = presets.get("coat", 0.0)
        b.inputs["Coat Roughness"].default_value = presets.get("coat_rough", 0.1)
        b.inputs["Sheen Weight"].default_value = presets.get("sheen", 0.0)
        b.inputs["Transmission Weight"].default_value = presets.get("trans", 0.0)
        b.inputs["IOR"].default_value = presets.get("ior", 1.5)
        if presets.get("sss"):
            b.inputs["Subsurface Weight"].default_value = presets["sss"]
            b.inputs["Subsurface Radius"].default_value = (0.02, 0.01, 0.008)
            if kind == "wax":
                b.inputs["Subsurface Scale"].default_value = 0.03
                b.inputs["Subsurface Radius"].default_value = (1.0, 0.55, 0.3)
        if kind == "travertine":
            self._stone(nt, b, colour)
        if kind == "wood":
            self._grain(nt, b, colour)
        if kind in ("card", "linen", "clay", "ceramic"):
            self._tooth(nt, b, 0.04 if kind in ("ceramic",) else 0.12, 900 if kind == "linen" else 260)
        if kind == "emit":
            b.inputs["Emission Color"].default_value = lin(colour)
            b.inputs["Emission Strength"].default_value = kw.get("strength", 6.0)
        self._mats[key] = m
        return m

    @staticmethod
    def _tooth(nt, b, strength: float, scale: float):
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = 8.0
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = strength
        bump.inputs["Distance"].default_value = 0.002
        nt.links.new(n.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])

    @staticmethod
    def _stone(nt, b, colour):
        # Travertine: soft banding with a few pores.
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.inputs["Scale"].default_value = 3.0
        wave.inputs["Distortion"].default_value = 6.0
        wave.inputs["Detail"].default_value = 3.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = lin(mix(colour, (0.7, 0.62, 0.5), 0.25))
        ramp.color_ramp.elements[1].color = lin(colour)
        nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
        pores = nt.nodes.new("ShaderNodeTexVoronoi")
        pores.inputs["Scale"].default_value = 140.0
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.08
        nt.links.new(pores.outputs["Distance"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])

    @staticmethod
    def _grain(nt, b, colour):
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "RINGS"
        wave.inputs["Scale"].default_value = 2.2
        wave.inputs["Distortion"].default_value = 9.0
        wave.inputs["Detail"].default_value = 4.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = lin(mix(colour, (0.2, 0.12, 0.06), 0.35))
        ramp.color_ramp.elements[1].color = lin(colour)
        nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])

    def windows(self, facade=CREAM, cell=(0.022, 0.03), lit_share=0.55) -> bpy.types.Material:
        """A facade with a grid of windows on its sides (not its roof): dark glass by day, a
        warm scatter of lit rooms by night. Built from the Brick texture, whose bricks are the
        panes and whose mortar is the wall between them."""
        key = ("windows", facade, cell, lit_share, self.night)
        if key in self._mats:
            return self._mats[key]
        m = bpy.data.materials.new("windows")
        m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes["Principled BSDF"]
        b.inputs["Roughness"].default_value = 0.45
        coord = nt.nodes.new("ShaderNodeTexCoord")
        brick = nt.nodes.new("ShaderNodeTexBrick")
        brick.offset = 0.0
        brick.squash = 1.0
        brick.inputs["Scale"].default_value = 1.0
        brick.inputs["Brick Width"].default_value = cell[0]
        brick.inputs["Row Height"].default_value = cell[1]
        brick.inputs["Mortar Size"].default_value = cell[0] * 0.32
        brick.inputs["Mortar Smooth"].default_value = 0.0
        # Brick works in 2D: feed it the object position with x and y summed, so both side
        # faces of a box get windows.
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "ADD"
        comb = nt.nodes.new("ShaderNodeCombineXYZ")
        nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
        nt.links.new(sep.outputs["X"], add.inputs[0])
        nt.links.new(sep.outputs["Y"], add.inputs[1])
        nt.links.new(add.outputs["Value"], comb.inputs["X"])
        nt.links.new(sep.outputs["Z"], comb.inputs["Y"])
        nt.links.new(comb.outputs["Vector"], brick.inputs["Vector"])
        # Only on walls: the up-facing normal masks windows off the roof.
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        sepn = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(geo.outputs["Normal"], sepn.inputs["Vector"])
        wall = nt.nodes.new("ShaderNodeMath")
        wall.operation = "LESS_THAN"
        wall.inputs[1].default_value = 0.5
        nt.links.new(sepn.outputs["Z"], wall.inputs[0])
        pane = nt.nodes.new("ShaderNodeMath")
        pane.operation = "SUBTRACT"
        pane.inputs[0].default_value = 1.0
        nt.links.new(brick.outputs["Fac"], pane.inputs[1])
        is_win = nt.nodes.new("ShaderNodeMath")
        is_win.operation = "MULTIPLY"
        nt.links.new(pane.outputs["Value"], is_win.inputs[0])
        nt.links.new(wall.outputs["Value"], is_win.inputs[1])
        colour = nt.nodes.new("ShaderNodeMix")
        colour.data_type = "RGBA"
        colour.inputs[6].default_value = lin(facade)
        # By day the panes are only a little darker than the card, the way a white model's
        # windows read; by night an unlit room is a dim warm grey, not a hole.
        glass = (0.60, 0.64, 0.68) if not self.night else (0.17, 0.15, 0.14)
        colour.inputs[7].default_value = lin(glass)
        nt.links.new(is_win.outputs["Value"], colour.inputs[0])
        nt.links.new(colour.outputs[2], b.inputs["Base Color"])
        if self.night:
            # A random share of rooms lit: the brick's own colour output, thresholded, gives a
            # per-pane random value for free.
            brick.inputs["Color1"].default_value = (1, 1, 1, 1)
            brick.inputs["Color2"].default_value = (0, 0, 0, 1)
            sepc = nt.nodes.new("ShaderNodeSeparateColor")
            nt.links.new(brick.outputs["Color"], sepc.inputs["Color"])
            lit = nt.nodes.new("ShaderNodeMath")
            lit.operation = "GREATER_THAN"
            lit.inputs[1].default_value = 1 - lit_share
            nt.links.new(sepc.outputs[0], lit.inputs[0])
            on = nt.nodes.new("ShaderNodeMath")
            on.operation = "MULTIPLY"
            nt.links.new(lit.outputs["Value"], on.inputs[0])
            nt.links.new(is_win.outputs["Value"], on.inputs[1])
            strength = nt.nodes.new("ShaderNodeMath")
            strength.operation = "MULTIPLY"
            strength.inputs[1].default_value = 9.0
            nt.links.new(on.outputs["Value"], strength.inputs[0])
            b.inputs["Emission Color"].default_value = lin((1.0, 0.78, 0.45))
            nt.links.new(strength.outputs["Value"], b.inputs["Emission Strength"])
            brick.inputs["Bias"].default_value = 0.0
        else:
            rough = nt.nodes.new("ShaderNodeMapRange")
            rough.inputs["To Min"].default_value = 0.5
            rough.inputs["To Max"].default_value = 0.08
            nt.links.new(is_win.outputs["Value"], rough.inputs["Value"])
            nt.links.new(rough.outputs["Result"], b.inputs["Roughness"])
        self._mats[key] = m
        return m


def link(ob: bpy.types.Object) -> bpy.types.Object:
    bpy.context.collection.objects.link(ob)
    return ob


def mesh_from(name: str, bm: bmesh.types.BMesh, mat=None, smooth=True) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = link(bpy.data.objects.new(name, me))
    if mat is not None:
        me.materials.append(mat)
    return ob


def soften(ob: bpy.types.Object, radius: float, segments: int = 4) -> bpy.types.Object:
    """Round every hard edge, then keep flat faces flat: the bevel gives the highlight a rim to run
    along, and the weighted normals stop the smooth shading from bending the faces between."""
    bev = ob.modifiers.new("soften", "BEVEL")
    bev.width = radius
    bev.segments = segments
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(40)
    bev.harden_normals = False
    wn = ob.modifiers.new("faces", "WEIGHTED_NORMAL")
    wn.keep_sharp = True
    wn.weight = 100
    return ob


def box(name, size, location, mat, radius=0.006, rotation=(0, 0, 0)) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    ob = mesh_from(name, bm, mat)
    ob.location = location
    ob.rotation_euler = rotation
    if radius > 0:
        soften(ob, radius)
    return ob


def cylinder(name, radius, depth, location, mat, segments=64, radius_top=None, bevel=0.004, rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius if radius_top is None else radius_top, depth=depth
    )
    ob = mesh_from(name, bm, mat)
    ob.location = location
    ob.rotation_euler = rotation
    if bevel > 0:
        soften(ob, bevel)
    return ob


def sphere(name, radius, location, mat, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=radius)
    ob = mesh_from(name, bm, mat)
    ob.location = location
    ob.scale = scale
    return ob


def tube(name, points, radius, mat, cyclic=False, resolution=12, smooth_path=True):
    """A rolled tube along a path: a wick, a wire, a ribbon edge."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    cu.resolution_u = resolution
    if smooth_path and len(points) > 2:
        sp = cu.splines.new("NURBS")
        sp.points.add(len(points) - 1)
        for p, co in zip(sp.points, points):
            p.co = (*co, 1.0)
        sp.order_u = min(4, len(points))
        sp.use_endpoint_u = True
    else:
        sp = cu.splines.new("POLY")
        sp.points.add(len(points) - 1)
        for p, co in zip(sp.points, points):
            p.co = (*co, 1.0)
    sp.use_cyclic_u = cyclic
    ob = link(bpy.data.objects.new(name, cu))
    cu.materials.append(mat)
    return ob


_fonts: dict = {}


def font(name: str):
    """A typeface from the site's own families, converted from the woff2 the site ships."""
    if name in _fonts:
        return _fonts[name]
    path = os.environ.get(f"ART_FONT_{name.upper()}")
    f = bpy.data.fonts.load(path) if path and os.path.exists(path) else None
    _fonts[name] = f
    return f


def text(name, body, size, location, mat, face="mono", extrude=0.0008, rotation=(math.radians(90), 0, 0), align="CENTER"):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    f = font(face)
    if f:
        cu.font = f
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.space_character = 1.06
    ob = link(bpy.data.objects.new(name, cu))
    cu.materials.append(mat)
    ob.location = location
    ob.rotation_euler = rotation
    return ob


# ---------------------------------------------------------------------------------------------
# The studio
# ---------------------------------------------------------------------------------------------


def reset() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = SAMPLES
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = ADAPTIVE_THRESHOLD
    s.cycles.use_denoising = True
    s.cycles.denoiser = "OPENIMAGEDENOISE"
    s.cycles.max_bounces = 8
    s.cycles.diffuse_bounces = 3
    s.cycles.glossy_bounces = 3
    s.cycles.transmission_bounces = 8
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.cycles.sample_clamp_indirect = 4.0
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = "AgX - Medium High Contrast"
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGB"
    return s


def sweep(c: Ctx) -> bpy.types.Object:
    """The cyclorama: floor running back, curving up into a wall. One surface, no horizon."""
    bm = bmesh.new()
    profile = []
    profile.append((-4.0, 0.0))  # floor, in front of the camera
    profile.append((SWEEP_DEPTH, 0.0))
    for i in range(1, 25):
        a = (i / 24) * (math.pi / 2)
        profile.append((SWEEP_DEPTH + math.sin(a) * SWEEP_RADIUS, SWEEP_RADIUS - math.cos(a) * SWEEP_RADIUS))
    profile.append((SWEEP_DEPTH + SWEEP_RADIUS, 5.0))
    W = 9.0
    rows = []
    for y, z in profile:
        rows.append((bm.verts.new((-W, y, z)), bm.verts.new((W, y, z))))
    for (a0, a1), (b0, b1) in zip(rows, rows[1:]):
        bm.faces.new((a0, a1, b1, b0))
    paper_mat = c.mat("card", c.paper)
    return mesh_from("sweep", bm, paper_mat)


def lights(c: Ctx) -> None:
    s = bpy.context.scene
    world = bpy.data.worlds.new("room")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    s.world = world
    target = c.focus

    def area(name, loc, size, energy, colour, shape="RECTANGLE", size_y=None):
        L = bpy.data.lights.new(name, "AREA")
        L.shape = shape
        L.size = size
        if size_y:
            L.size_y = size_y
        L.energy = energy
        L.color = colour
        ob = link(bpy.data.objects.new(name, L))
        ob.location = loc
        d = target - Vector(loc)
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        return ob

    if not c.night:
        bg.inputs["Color"].default_value = lin(mix(c.paper, (1, 1, 1), 0.3))
        bg.inputs["Strength"].default_value = 0.22
        # The window: a sun, and a frame of mullions in its path that only casts shadow.
        sun = bpy.data.lights.new("window", "SUN")
        sun.energy = SUN_STRENGTH
        sun.angle = math.radians(SUN_ANGLE_DEG)
        sun.color = (1.0, 0.93, 0.84)
        sob = link(bpy.data.objects.new("window", sun))
        el, az = math.radians(SUN_ELEVATION_DEG), math.radians(SUN_AZIMUTH_DEG)
        to_sun = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        sob.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
        mullions(to_sun, c)
        # A large soft fill from the right, so the shadow side is coloured, not black.
        area("fill", (2.6, -1.8, 1.4), 2.4, 70, (0.96, 0.97, 1.0))
        # A rim from behind and above, to draw the edges off the paper.
        area("rim", (0.6, 1.4, 1.6), 1.0, 70, (1.0, 0.96, 0.9))
    else:
        bg.inputs["Color"].default_value = lin(c.paper)
        bg.inputs["Strength"].default_value = 0.10
        # The lamp: one warm pool from above and in front.
        spot = bpy.data.lights.new("lamp", "SPOT")
        spot.energy = 110
        spot.spot_size = math.radians(58)
        spot.spot_blend = 0.85
        spot.shadow_soft_size = 0.18
        spot.color = (1.0, 0.82, 0.6)
        sp = link(bpy.data.objects.new("lamp", spot))
        sp.location = (-0.5, -0.9, 1.7)
        sp.rotation_euler = (target - sp.location).to_track_quat("-Z", "Y").to_euler()
        # A cool rim from behind: dusk through a window we no longer see.
        rim = area("rim", (0.7, 0.75, 0.9), 0.6, 18, (0.66, 0.76, 1.0))
        rim.data.spread = math.radians(40)  # a narrow cone: edges on the subject, not a wash on the paper
        area("fill", (2.4, -1.6, 1.0), 2.0, 6, (0.9, 0.9, 1.0))


def mullions(to_sun: Vector, c: Ctx) -> None:
    """A window frame between the sun and the set, invisible to the camera: four panes and their
    bars, cast as shadow onto the floor and up the sweep."""
    frame = bpy.data.objects.new("mullions", None)
    bm = bmesh.new()
    W, H, bar = 1.6, 1.9, 0.07
    # Outer surround with a cross: the solid parts are the bars.
    def rect(x0, y0, x1, y1):
        v = [bm.verts.new((x0, y0, 0)), bm.verts.new((x1, y0, 0)), bm.verts.new((x1, y1, 0)), bm.verts.new((x0, y1, 0))]
        bm.faces.new(v)
    big = 4.0
    rect(-big, -big, big, -H / 2)  # below
    rect(-big, H / 2, big, big)  # above
    rect(-big, -H / 2, -W / 2, H / 2)  # left
    rect(W / 2, -H / 2, big, H / 2)  # right
    for fx in (-1 / 6, 1 / 6):  # two mullions: three panes across
        rect(fx * W - bar / 2, -H / 2, fx * W + bar / 2, H / 2)
    for fy in (-1 / 6, 1 / 6):  # two transoms: three panes down
        rect(-W / 2, fy * H - bar / 2, W / 2, fy * H + bar / 2)
    ob = mesh_from("mullions", bm, None, smooth=False)
    ob.location = c.focus + to_sun * 5.0 + Vector((0.25 * c.rng.uniform(-1, 1), 0.3, 0.1))
    ob.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()
    ob.visible_camera = False
    ob.visible_glossy = False
    ob.visible_transmission = False
    ob.visible_diffuse = False
    ob.visible_volume_scatter = False


def camera(c: Ctx, elevation: float = CAMERA_ELEVATION_DEG, yaw: float = 0.0) -> None:
    s = bpy.context.scene
    data = bpy.data.cameras.new("cam")
    data.lens = LENS_MM
    data.sensor_width = 36
    data.sensor_fit = "HORIZONTAL"
    cam = link(bpy.data.objects.new("cam", data))
    s.camera = cam
    fov = 2 * math.atan(data.sensor_width / (2 * data.lens))
    dist = (c.frame_width / 2) / math.tan(fov / 2)
    el, yw = math.radians(elevation), math.radians(yaw)
    offset = Vector((math.sin(yw) * math.cos(el), -math.cos(yw) * math.cos(el), math.sin(el))) * dist
    cam.location = c.focus + offset
    cam.rotation_euler = (c.focus - cam.location).to_track_quat("-Z", "Y").to_euler()
    data.dof.use_dof = True
    data.dof.focus_distance = dist
    data.dof.aperture_fstop = F_STOP


# ---------------------------------------------------------------------------------------------
# Subjects
# ---------------------------------------------------------------------------------------------


def luggage_tag(c: Ctx, at: Vector, angle: float, label: str | None):
    """A brass-eyeleted card tag lying on the table with the trip's location on it — the one
    piece of lettering any cover carries, and only because the page already says it."""
    if not label:
        return
    w, h = 0.2, 0.085
    card = box("tag", (w, h, 0.003), at, c.mat("card", BONE), radius=0.0015, rotation=(0, 0, angle))
    eye = cylinder("eyelet", 0.009, 0.004, at, c.mat("brass", BRASS), bevel=0.001)
    off = Vector((-w / 2 + 0.016, 0, 0.002))
    off.rotate(Euler((0, 0, angle)))
    eye.location = at + off
    t = text("tag-text", label.upper(), 0.0155, at + Vector((0, 0, 0.0025)), c.mat("ceramic", INK), extrude=0.0002,
             rotation=(0, 0, angle))
    shift = Vector((0.012, 0, 0))
    shift.rotate(Euler((0, 0, angle)))
    t.location += shift
    # Fit the label to the card.
    bpy.context.view_layer.update()
    width = t.dimensions.x
    if width > w - 0.05:
        t.scale = ((w - 0.05) / width,) * 3
    string = tube("string", [at + off + Vector(p) for p in [(0, 0, 0.003), (-0.05, -0.02, 0.002), (-0.11, 0.01, 0.002), (-0.16, 0.05, 0.002)]],
                  0.0012, c.mat("linen", (0.75, 0.68, 0.58)))


def rim_inlay(c: Ctx, label: str | None, radius: float, z: float, size: float = 0.016, centre_deg: float = -90.0):
    """Lettering in brass, inlaid around the front of a round plinth: the trip's location, set the
    way a museum model is labelled. The text is built flat, turned into a mesh, then each vertex is
    wrapped onto the cylinder — exact, and indifferent to how long the name is."""
    if not label:
        return
    t = text("inlay-src", label.upper(), size, (0, 0, 0), c.mat("brass", BRASS), extrude=0.0004,
             rotation=(0, 0, 0))
    t.data.space_character = 1.25
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(t.evaluated_get(dg))
    bpy.data.objects.remove(t)
    # Flat text lies in XY with its face up (+Z). Wrap: x → angle along the rim, y → height on the
    # rim, z (the extrusion) → outward from the surface.
    for v in me.vertices:
        x, y, zz = v.co
        a = math.radians(centre_deg) + x / radius
        r = radius + 0.0004 + zz
        v.co = (math.cos(a) * r, math.sin(a) * r, z + y)
    ob = link(bpy.data.objects.new("inlay", me))
    me.materials.clear()
    me.materials.append(c.mat("brass", BRASS))
    for p in me.polygons:
        p.use_smooth = False
    return ob


def skyline(c: Ctx):
    """An architect's model of a city on a travertine plinth: towers in white card and frosted
    acrylic either side of a river of blue acrylic, a landmark with a brass spire, clay trees on
    the banks, and the trip's location inlaid in brass around the rim. By day the model is white
    and the light does the work; by night the rooms are lit."""
    rng = c.rng
    R = 0.40
    H = 0.06
    cylinder("plinth", R, H, (0, 0, H / 2), c.mat("travertine", TRAVERTINE), segments=160, bevel=0.006)
    top = H
    phase = rng.uniform(-0.5, 0.5)

    def river_y(x):
        t = (x + R) / (2 * R)
        return -0.06 + 0.07 * math.sin(t * math.pi * 1.3 + phase)

    half = 0.042
    lim = R - 0.006
    bm = bmesh.new()
    rows = []
    for i in range(241):
        x = -R + 2 * R * i / 240
        yc = river_y(x)
        pair = []
        for yy in (yc + half, yc - half):
            r = math.hypot(x, yy)
            px, py = (x, yy) if r <= lim else (x * lim / r, yy * lim / r)
            pair.append(bm.verts.new((px, py, top + 0.0006)))
        rows.append(pair)
    for (a0, a1), (b0, b1) in zip(rows, rows[1:]):
        if (a0.co - b0.co).length > 1e-6 or (a1.co - b1.co).length > 1e-6:
            bm.faces.new((a0, a1, b1, b0))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    water_colour = (0.52, 0.66, 0.78) if not c.night else (0.10, 0.14, 0.22)
    river = mesh_from("river", bm, c.mat("water", water_colour))
    sol = river.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = 0.003

    card = c.windows(CREAM if not c.night else (0.86, 0.82, 0.76), cell=(0.011, 0.015), lit_share=0.5)
    acrylic = c.mat("frost", (0.92, 0.95, 0.97))
    towers = []
    tries = 0
    while len(towers) < 17 and tries < 800:
        tries += 1
        x = rng.uniform(-R + 0.05, R - 0.05)
        y = rng.uniform(-R + 0.05, R - 0.05)
        round_ = rng.random() < 0.18
        w = rng.uniform(0.04, 0.066)
        d = w if round_ else rng.uniform(0.04, 0.06)
        if math.hypot(x, y) + max(w, d) * 0.7 > R - 0.02 or abs(y - river_y(x)) < half + max(w, d) / 2 + 0.008:
            continue
        if any(abs(x - tx) < (w + tw) / 2 + 0.01 and abs(y - ty) < (d + td) / 2 + 0.01 for tx, ty, tw, td, *_ in towers):
            continue
        back = (y + R) / (2 * R)
        hgt = 0.04 + back * rng.uniform(0.07, 0.22) + rng.uniform(0, 0.05)
        kind = "round" if round_ else ("acrylic" if rng.random() < 0.24 else "card")
        towers.append((x, y, w, d, hgt, kind))
    towers.sort(key=lambda t: -t[4])
    for k, (x, y, w, d, hgt, kind) in enumerate(towers):
        rot = (0, 0, math.radians(rng.choice([0, 0, 0, 12, -9])))
        if kind == "round":
            cylinder(f"tower-{k}", w / 2, hgt, (x, y, top + hgt / 2), card, segments=48, bevel=0.002)
            continue
        mat_ = acrylic if kind == "acrylic" and k != 0 else card
        box(f"tower-{k}", (w, d, hgt), (x, y, top + hgt / 2), mat_, radius=0.0025, rotation=rot)
        if k == 0:
            box("crown", (w * 0.6, d * 0.6, 0.045), (x, y, top + hgt + 0.0225), card, radius=0.0025, rotation=rot)
            cylinder("spire", 0.0026, 0.08, (x, y, top + hgt + 0.045 + 0.04), c.mat("brass", BRASS), segments=16, bevel=0)
        elif kind == "card" and rng.random() < 0.35:
            box(f"setback-{k}", (w * 0.7, d * 0.7, 0.03), (x, y, top + hgt + 0.015), card, radius=0.0025, rotation=rot)
    for k in range(22):
        x = rng.uniform(-R + 0.05, R - 0.05)
        y = river_y(x) + rng.choice([-1, 1]) * (half + 0.014)
        if math.hypot(x, y) > R - 0.025:
            continue
        r_ = rng.uniform(0.008, 0.012)
        sphere(f"tree-{k}", r_, (x, y, top + r_ * 0.9), c.mat("clay", SAGE))
    rim_inlay(c, c.location, R + 0.0002, H * 0.42, size=0.0155, centre_deg=-90 + rng.uniform(-6, 6))
    c.focus = Vector((0.0, -0.03, 0.13))
    c.frame_width = 1.26


def trading_desk(c: Ctx):
    """A candlestick chart made of candles: a row of wax candles on a brass tray, their heights
    tracing a session — cream wax for a day that closed up, wine for one that closed down. By day
    they stand unlit; by night every wick is burning."""
    rng = c.rng
    n = 11
    tray_w = 1.02
    tray = c.mat("brass", BRASS)
    box("slab", (tray_w + 0.04, 0.22, 0.03), (0, 0, 0.015), c.mat("travertine", TRAVERTINE), radius=0.006)
    wax_up = c.mat("wax", (0.97, 0.93, 0.86))
    wax_down = c.mat("wax", (0.45, 0.10, 0.17))
    price = 0.0
    drift = rng.choice([1, 1, -1]) * rng.uniform(0.012, 0.022)
    levels = []
    for i in range(n):
        o = price
        price += drift + rng.gauss(0, 0.03)
        levels.append((o, price))
    lo = min(min(a, b) for a, b in levels)
    hi = max(max(a, b) for a, b in levels)
    span = max(hi - lo, 1e-6)
    xs = [-tray_w / 2 + 0.06 + i * (tray_w - 0.12) / (n - 1) for i in range(n)]
    flame_mat = c.mat("emit", (1.0, 0.72, 0.35), strength=28.0)
    for i, (x, (o, cl)) in enumerate(zip(xs, levels)):
        h = 0.08 + 0.30 * (cl - lo) / span
        r = rng.uniform(0.024, 0.03)
        y = rng.uniform(-0.03, 0.03)
        wax = wax_up if cl >= o else wax_down
        # A brass cup for each candle.
        cylinder(f"cup-{i}", r + 0.01, 0.014, (x, y, 0.03 + 0.007), tray, segments=48, bevel=0.003)
        body = cylinder(f"candle-{i}", r, h, (x, y, 0.04 + h / 2), wax, segments=48, bevel=0.004)
        # A little melt at the rim: a shallow dish in the top.
        dish = sphere(f"melt-{i}", r * 0.82, (x, y, 0.04 + h + r * 0.3), None, scale=(1, 1, 0.5))
        bm = body.modifiers.new("melt", "BOOLEAN")
        bm.object = dish
        bm.operation = "DIFFERENCE"
        dish.hide_render = True
        wick_top = 0.04 + h + 0.012
        tube(f"wick-{i}", [(x, y, 0.04 + h - 0.008), (x + 0.001, y, wick_top - 0.004), (x + 0.003, y, wick_top)], 0.0011,
             c.mat("ceramic", INK))
        if c.night:
            flame = sphere(f"flame-{i}", 0.0055, (x + 0.003, y, wick_top + 0.012), flame_mat, scale=(1, 1, 2.4))
            glow = bpy.data.lights.new(f"glow-{i}", "POINT")
            glow.energy = 1.6
            glow.color = (1.0, 0.7, 0.4)
            glow.shadow_soft_size = 0.01
            g = link(bpy.data.objects.new(f"glow-{i}", glow))
            g.location = (x + 0.003, y, wick_top + 0.014)
    c.focus = Vector((0, 0, 0.17))
    c.frame_width = 1.30


def ruled(c: Ctx, colour=CREAM, line=(0.55, 0.62, 0.72), every=0.012, margin_x=None) -> bpy.types.Material:
    """Paper with ruled lines and no writing on it: the ledger's page, the notebook's."""
    m = bpy.data.materials.new("ruled")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.9
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
    div = nt.nodes.new("ShaderNodeMath"); div.operation = "DIVIDE"; div.inputs[1].default_value = every
    nt.links.new(sep.outputs["Y"], div.inputs[0])
    fr = nt.nodes.new("ShaderNodeMath"); fr.operation = "FRACT"
    nt.links.new(div.outputs[0], fr.inputs[0])
    thr = nt.nodes.new("ShaderNodeMath")
    thr.operation = "GREATER_THAN"
    thr.inputs[1].default_value = 0.9
    nt.links.new(fr.outputs[0], thr.inputs[0])
    mixn = nt.nodes.new("ShaderNodeMix")
    mixn.data_type = "RGBA"
    mixn.inputs[6].default_value = lin(colour)
    mixn.inputs[7].default_value = lin(line)
    nt.links.new(thr.outputs["Value"], mixn.inputs[0])
    nt.links.new(mixn.outputs[2], b.inputs["Base Color"])
    return m


def ledger_page(c: Ctx):
    """An open ledger, ruled and blank, on a cloth-bound board; a brass-capped pen across it, a
    stack of closed ledgers behind and a ceramic inkwell. The work, and none of its contents."""
    rng = c.rng
    cloth = c.mat("linen", (0.30, 0.10, 0.14))
    box("board", (0.62, 0.42, 0.012), (0, 0, 0.006), cloth, radius=0.004, rotation=(0, 0, math.radians(rng.uniform(-6, 6))))
    page = ruled(c, (0.90, 0.87, 0.81), line=(0.42, 0.52, 0.68), every=0.014)
    for side in (-1, 1):
        blk = box(f"pages-{side}", (0.29, 0.39, 0.028), (side * 0.148, 0, 0.012 + 0.016), page, radius=0.004,
                  rotation=(0, math.radians(-side * 4.5), 0))
        blk.parent = bpy.data.objects["board"]
        blk.matrix_parent_inverse = bpy.data.objects["board"].matrix_world.inverted()
    # A ribbon marker trailing off the bottom edge.
    tube("ribbon", [(0.02, -0.17, 0.042), (0.03, -0.215, 0.03), (0.045, -0.25, 0.003)], 0.004, c.mat("linen", WINE))
    # The pen: a long ink-black barrel with a brass cap, lying across the right page.
    a = math.radians(rng.uniform(25, 40))
    pen_mid = Vector((0.15, 0.0, 0.052))
    d = Vector((math.cos(a), math.sin(a), 0))
    tube("pen", [pen_mid - d * 0.13, pen_mid + d * 0.08], 0.0095, c.mat("glaze", INK), smooth_path=False)
    tube("cap", [pen_mid + d * 0.08, pen_mid + d * 0.13], 0.0105, c.mat("brass", BRASS), smooth_path=False)
    tube("nib", [pen_mid - d * 0.13, pen_mid - d * 0.155], 0.003, c.mat("brass", BRASS), smooth_path=False)
    # Closed ledgers behind, stacked a little askew.
    cols = [(0.30, 0.10, 0.14), SAGE, (0.20, 0.18, 0.16), (0.55, 0.35, 0.18)]
    z = 0.0
    for i in range(rng.randint(3, 4)):
        t = 0.04 + rng.uniform(0, 0.012)
        box(f"closed-{i}", (0.34, 0.25, t), (-0.42 + rng.uniform(-0.01, 0.01), 0.24, z + t / 2), c.mat("linen", cols[i % len(cols)]),
            radius=0.004, rotation=(0, 0, math.radians(rng.uniform(-8, 8))))
        z += t
    cylinder("inkwell", 0.04, 0.05, (0.40, 0.22, 0.025), c.mat("glaze", c.glaze), radius_top=0.03, bevel=0.006)
    c.focus = Vector((-0.04, 0.05, 0.05))
    c.frame_width = 1.0


def bubble(c: Ctx, name, w, h, t, mat, at, yaw, tail_left: bool):
    """A speech bubble as a ceramic slab standing on its edge: a soft rounded panel, with its tail
    a wedge sweeping down from the lower corner to the table."""
    side = -1 if tail_left else 1
    bm = bmesh.new()
    # outline in the panel's own plane (x across, z up), then extruded through y
    r = min(w, h) * 0.3
    pts = []
    for cx, cz, a0 in ((w / 2 - r, h - r, 0), (-w / 2 + r, h - r, 90), (-w / 2 + r, r, 180), (w / 2 - r, r, 270)):
        for k in range(9):
            a = math.radians(a0 + k * 90 / 8)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    front = [bm.verts.new((x, -t / 2, z)) for x, z in pts]
    back = [bm.verts.new((x, t / 2, z)) for x, z in pts]
    bm.faces.new(front[::-1])
    bm.faces.new(back)
    n = len(pts)
    for i in range(n):
        bm.faces.new((front[i], front[(i + 1) % n], back[(i + 1) % n], back[i]))
    ob = mesh_from(name, bm, mat)
    ob.location = at + Vector((0, 0, 0.03 + 0.07))
    ob.rotation_euler = (0, 0, yaw)
    soften(ob, t * 0.35, segments=6)
    # the tail: a wedge from the bottom edge down toward the table, a little thinner than the panel
    tx = side * w * 0.22
    tri = [(tx - 0.04, 0.03), (tx + 0.04, 0.03), (tx + side * 0.07, -0.065)]
    bm = bmesh.new()
    tt = t * 0.8
    f = [bm.verts.new((x, -tt / 2, z)) for x, z in tri]
    k = [bm.verts.new((x, tt / 2, z)) for x, z in tri]
    bm.faces.new(f[::-1]); bm.faces.new(k)
    for i in range(3):
        bm.faces.new((f[i], f[(i + 1) % 3], k[(i + 1) % 3], k[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    tl = mesh_from(name + "-tail", bm, mat)
    tl.location = ob.location
    tl.rotation_euler = ob.rotation_euler
    soften(tl, tt * 0.3, segments=4)
    return ob


def conversation(c: Ctx):
    """Two sides of an exchange: a pair of ceramic speech bubbles facing each other on a low plinth,
    one in cream, one in the category's glaze, and between them three small beads, mid-thought."""
    rng = c.rng
    cylinder("stage", 0.42, 0.03, (0, 0.02, 0.015), c.mat("travertine", TRAVERTINE), segments=128, bevel=0.005)
    big_left = rng.random() < 0.5
    w1, h1 = rng.uniform(0.26, 0.32), rng.uniform(0.18, 0.22)
    w2, h2 = rng.uniform(0.2, 0.25), rng.uniform(0.14, 0.17)
    left = (w1, h1) if big_left else (w2, h2)
    right = (w2, h2) if big_left else (w1, h1)
    bubble(c, "say", left[0], left[1], 0.045, c.mat("glaze", CREAM), Vector((-0.17, 0.06, 0)), math.radians(22), True)
    bubble(c, "reply", right[0], right[1], 0.045, c.mat("glaze", c.glaze), Vector((0.18, 0.0, 0)), math.radians(-24), False)
    for i in range(3):
        sphere(f"bead-{i}", 0.014, (-0.035 + i * 0.035, -0.17, 0.03 + 0.014), c.mat("brass", BRASS))
    c.focus = Vector((0, 0.0, 0.14))
    c.frame_width = 1.15


def cohort(c: Ctx):
    """A cohort as figurines: turned ceramic pawns gathered on a round board, all in the same matte
    cream except two in glaze, picked out."""
    rng = c.rng
    cylinder("board", 0.4, 0.025, (0, 0.03, 0.0125), c.mat("wood", (0.62, 0.45, 0.30)), segments=128, bevel=0.004)
    n = rng.randint(10, 13)
    spots = []
    tries = 0
    while len(spots) < n and tries < 500:
        tries += 1
        a = rng.uniform(0, math.tau)
        r = math.sqrt(rng.uniform(0, 1)) * 0.31
        x, y = math.cos(a) * r, 0.03 + math.sin(a) * r * 0.8
        if all(math.hypot(x - sx, y - sy) > 0.085 for sx, sy in spots):
            spots.append((x, y))
    picked = set(rng.sample(range(len(spots)), 2))
    plain = c.mat("ceramic", CREAM)
    for i, (x, y) in enumerate(sorted(spots, key=lambda p: -p[1])):
        m = c.mat("glaze", c.glaze if i in picked else CREAM) if i in picked else plain
        h = rng.uniform(0.11, 0.15)
        base = 0.025
        cylinder(f"foot-{i}", 0.03, 0.012, (x, y, base + 0.006), m, bevel=0.004)
        cylinder(f"body-{i}", 0.022, h, (x, y, base + 0.012 + h / 2), m, radius_top=0.012, bevel=0.003)
        sphere(f"head-{i}", 0.022, (x, y, base + 0.012 + h + 0.016), m)
    c.focus = Vector((0, 0.02, 0.1))
    c.frame_width = 1.15


def book_stack(c: Ctx):
    """Books passed on: a stack of cloth-bound volumes, a few more leaning beside it, and a brass
    hoop turning round behind them — the circle a returned book goes on."""
    rng = c.rng
    cols = [(0.30, 0.10, 0.14), SAGE, (0.18, 0.2, 0.26), AMBER, (0.82, 0.76, 0.66), (0.5, 0.25, 0.2)]
    rng.shuffle(cols)
    z = 0.0
    pages = c.mat("card", (0.95, 0.92, 0.85))
    for i in range(rng.randint(5, 7)):
        w = rng.uniform(0.2, 0.27)
        d = rng.uniform(0.14, 0.18)
        t = rng.uniform(0.03, 0.045)
        yaw = math.radians(rng.uniform(-12, 12))
        box(f"cover-{i}", (w, d, t), (rng.uniform(-0.015, 0.015), 0, z + t / 2), c.mat("linen", cols[i % len(cols)]), radius=0.004, rotation=(0, 0, yaw))
        box(f"pages-{i}", (w - 0.012, d - 0.01, t - 0.008), (rng.uniform(-0.015, 0.015) + 0.004, -0.004, z + t / 2), pages, radius=0.002, rotation=(0, 0, yaw))
        z += t
    for i in range(3):
        h = rng.uniform(0.2, 0.25)
        box(f"lean-{i}", (0.035, 0.15, h), (0.22 + i * 0.04, 0.02, h / 2), c.mat("linen", cols[(i + 3) % len(cols)]), radius=0.004,
            rotation=(0, math.radians(-8 - i * 2), 0))
    # The hoop: three quarters of a ring with an arrowhead, upright behind the stack.
    R = 0.26
    pts = [(-0.02 + R * math.cos(math.radians(a)), 0.16, 0.03 + R + R * math.sin(math.radians(a))) for a in range(-60, 241, 10)]
    tube("hoop", pts, 0.009, c.mat("brass", BRASS))
    end = Vector(pts[-1])
    cone = cylinder("arrow", 0.025, 0.05, end, c.mat("brass", BRASS), segments=32, radius_top=0.0, bevel=0.002)
    tangent = (Vector(pts[-1]) - Vector(pts[-2])).normalized()
    cone.rotation_euler = tangent.to_track_quat("Z", "Y").to_euler()
    c.focus = Vector((0.02, 0.04, 0.2))
    c.frame_width = 1.3


def ribbon(name, pts, width, mat, twist=0.0):
    """A flat strip along a path, with UVs running along it (u) and across it (v)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    P = [Vector(p) for p in pts]
    length = [0.0]
    for a, b in zip(P, P[1:]):
        length.append(length[-1] + (b - a).length)
    rows = []
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        side = t.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(t).normalized()
        ang = twist * (i / max(1, len(P) - 1))
        side = side * math.cos(ang) + up * math.sin(ang)
        rows.append((bm.verts.new(p + side * width / 2), bm.verts.new(p - side * width / 2)))
    for i in range(len(rows) - 1):
        f = bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
        for loop, (u, v) in zip(f.loops, ((length[i], 1), (length[i], 0), (length[i + 1], 0), (length[i + 1], 1))):
            loop[uv].uv = (u, v)
    ob = mesh_from(name, bm, mat)
    ob.modifiers.new("thick", "SOLIDIFY").thickness = 0.0012
    return ob


def film_material(c: Ctx, frame_len: float) -> bpy.types.Material:
    """35 mm stock: sprocket holes along both edges, and between them frames — each a wash of one
    colour from the palette, glowing by night as if on a light box."""
    m = bpy.data.materials.new("film")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.25
    b.inputs["Coat Weight"].default_value = 0.6
    uvn = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uvn.outputs["UV"], sep.inputs["Vector"])
    # frame index along u → a colour per frame
    div = nt.nodes.new("ShaderNodeMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = frame_len
    nt.links.new(sep.outputs["X"], div.inputs[0])
    flo = nt.nodes.new("ShaderNodeMath")
    flo.operation = "FLOOR"
    nt.links.new(div.outputs["Value"], flo.inputs[0])
    frac = nt.nodes.new("ShaderNodeMath")
    frac.operation = "FRACT"
    nt.links.new(div.outputs["Value"], frac.inputs[0])
    noise = nt.nodes.new("ShaderNodeTexWhiteNoise")
    noise.noise_dimensions = "1D"
    nt.links.new(flo.outputs["Value"], noise.inputs["W"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    pal = [AMBER, (0.80, 0.42, 0.40), SAGE_LIGHT, DUSK, (0.95, 0.82, 0.62)]
    els = ramp.color_ramp.elements
    els[0].color = lin(pal[0])
    els[1].position = 0.2
    els[1].color = lin(pal[1])
    for k, col in enumerate(pal[2:], start=2):
        e = els.new(k / len(pal))
        e.color = lin(col)
    nt.links.new(noise.outputs["Value"], ramp.inputs["Fac"])
    # inside a frame (away from its gap) and inside the picture band (away from the edges)
    in_u_lo = nt.nodes.new("ShaderNodeMath"); in_u_lo.operation = "GREATER_THAN"; in_u_lo.inputs[1].default_value = 0.06
    in_u_hi = nt.nodes.new("ShaderNodeMath"); in_u_hi.operation = "LESS_THAN"; in_u_hi.inputs[1].default_value = 0.94
    nt.links.new(frac.outputs["Value"], in_u_lo.inputs[0]); nt.links.new(frac.outputs["Value"], in_u_hi.inputs[0])
    in_v_lo = nt.nodes.new("ShaderNodeMath"); in_v_lo.operation = "GREATER_THAN"; in_v_lo.inputs[1].default_value = 0.2
    in_v_hi = nt.nodes.new("ShaderNodeMath"); in_v_hi.operation = "LESS_THAN"; in_v_hi.inputs[1].default_value = 0.8
    nt.links.new(sep.outputs["Y"], in_v_lo.inputs[0]); nt.links.new(sep.outputs["Y"], in_v_hi.inputs[0])
    m1 = nt.nodes.new("ShaderNodeMath"); m1.operation = "MULTIPLY"
    m2 = nt.nodes.new("ShaderNodeMath"); m2.operation = "MULTIPLY"
    m3 = nt.nodes.new("ShaderNodeMath"); m3.operation = "MULTIPLY"
    nt.links.new(in_u_lo.outputs[0], m1.inputs[0]); nt.links.new(in_u_hi.outputs[0], m1.inputs[1])
    nt.links.new(in_v_lo.outputs[0], m2.inputs[0]); nt.links.new(in_v_hi.outputs[0], m2.inputs[1])
    nt.links.new(m1.outputs[0], m3.inputs[0]); nt.links.new(m2.outputs[0], m3.inputs[1])
    base = nt.nodes.new("ShaderNodeMix"); base.data_type = "RGBA"
    base.inputs[6].default_value = lin((0.10, 0.07, 0.05))
    nt.links.new(m3.outputs[0], base.inputs[0])
    nt.links.new(ramp.outputs["Color"], base.inputs[7])
    nt.links.new(base.outputs[2], b.inputs["Base Color"])
    # sprocket holes: punched, via alpha, on the edge bands
    hu = nt.nodes.new("ShaderNodeMath"); hu.operation = "DIVIDE"; hu.inputs[1].default_value = frame_len / 4
    nt.links.new(sep.outputs["X"], hu.inputs[0])
    hf = nt.nodes.new("ShaderNodeMath"); hf.operation = "FRACT"; nt.links.new(hu.outputs[0], hf.inputs[0])
    hin = nt.nodes.new("ShaderNodeMath"); hin.operation = "LESS_THAN"; hin.inputs[1].default_value = 0.5
    nt.links.new(hf.outputs[0], hin.inputs[0])
    ev = nt.nodes.new("ShaderNodeMath"); ev.operation = "PINGPONG"; ev.inputs[1].default_value = 0.5
    nt.links.new(sep.outputs["Y"], ev.inputs[0])
    edge = nt.nodes.new("ShaderNodeMath"); edge.operation = "COMPARE"; edge.inputs[1].default_value = 0.08; edge.inputs[2].default_value = 0.035
    nt.links.new(ev.outputs[0], edge.inputs[0])
    hole = nt.nodes.new("ShaderNodeMath"); hole.operation = "MULTIPLY"
    nt.links.new(hin.outputs[0], hole.inputs[0]); nt.links.new(edge.outputs[0], hole.inputs[1])
    alpha = nt.nodes.new("ShaderNodeMath"); alpha.operation = "SUBTRACT"; alpha.inputs[0].default_value = 1.0
    nt.links.new(hole.outputs[0], alpha.inputs[1])
    nt.links.new(alpha.outputs[0], b.inputs["Alpha"])
    if c.night:
        st = nt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"; st.inputs[1].default_value = 7.0
        nt.links.new(m3.outputs[0], st.inputs[0])
        nt.links.new(ramp.outputs["Color"], b.inputs["Emission Color"])
        nt.links.new(st.outputs[0], b.inputs["Emission Strength"])
    else:
        b.inputs["Transmission Weight"].default_value = 0.35
    return m


def film_strip(c: Ctx):
    """A reel on its edge, unspooling a length of film that loops across the table and rises — each
    frame a wash of colour from the palette, lit from within at night. A film, without a still
    from it."""
    rng = c.rng
    reel_c = Vector((-0.34, 0.1, 0.17))
    metal = c.mat("steel", (0.7, 0.7, 0.72))
    up = (math.radians(90), 0, 0)
    for side in (-1, 1):
        y = reel_c + Vector((0, side * 0.03, 0))
        ring = [tuple(y + Vector((math.cos(a) * 0.155, 0, math.sin(a) * 0.155))) for a in [k * math.tau / 96 for k in range(97)]]
        tube(f"rim-{side}", ring, 0.006, metal, smooth_path=False)
        for k in range(5):
            a = k * math.tau / 5 + 0.3
            tube(f"spoke-{side}-{k}", [tuple(y), tuple(y + Vector((math.cos(a) * 0.155, 0, math.sin(a) * 0.155)))], 0.006, metal, smooth_path=False)
    cylinder("spool", 0.11, 0.054, reel_c, c.mat("ceramic", (0.12, 0.09, 0.07)), segments=96, bevel=0.002, rotation=(math.radians(90), 0, 0))
    cylinder("hub", 0.02, 0.07, reel_c, c.mat("brass", BRASS), segments=32, bevel=0.002, rotation=(math.radians(90), 0, 0))
    # the strip: leaves the reel at its base and loops across the table, rising at the end
    pts = []
    amp = rng.uniform(0.07, 0.11)
    for i in range(160):
        t = i / 159
        x = -0.34 + 0.11 + t * 0.78
        y = 0.1 - 0.16 * math.sin(t * math.pi) + amp * math.sin(t * math.tau * 1.2 + 0.3)
        z = 0.004 + 0.24 * max(0.0, t - 0.62) ** 2 / 0.38 ** 2 + 0.02 * math.sin(t * math.tau * 2) ** 2
        pts.append((x, y, z))
    pts.insert(0, (reel_c.x + 0.08, 0.1, 0.06))
    pts.insert(0, (reel_c.x + 0.05, 0.1, reel_c.z - 0.105))
    frame_len = 0.045
    ribbon("film", pts, 0.05, film_material(c, frame_len), twist=math.radians(rng.uniform(-40, 40)))
    c.focus = Vector((-0.02, 0.02, 0.12))
    c.frame_width = 1.2


def prism(name, outline, depth, mat, location=(0, 0, 0), rotation=(0, 0, 0), soft=0.0):
    """A flat outline (x, z pairs) extruded through y: a ridge, a slide, a shape cut from card."""
    bm = bmesh.new()
    f = [bm.verts.new((x, -depth / 2, z)) for x, z in outline]
    k = [bm.verts.new((x, depth / 2, z)) for x, z in outline]
    bm.faces.new(f[::-1]); bm.faces.new(k)
    n = len(outline)
    for i in range(n):
        bm.faces.new((f[i], f[(i + 1) % n], k[(i + 1) % n], k[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from(name, bm, mat)
    ob.location = location
    ob.rotation_euler = rotation
    if soft:
        soften(ob, soft, segments=3)
    return ob


def front_inlay(c: Ctx, label: str | None, y: float, z: float, size=0.015):
    """Lettering in brass across the flat front of a base."""
    if not label:
        return
    t = text("inlay", label.upper(), size, (0, y - 0.0004, z), c.mat("brass", BRASS), extrude=0.0004)
    t.data.space_character = 1.25


def ridge_line(c: Ctx):
    """A landscape cut from glass: five ridges standing one behind another on a stone base, deep
    sage in front fading to mist at the back, a brass sun (by night, a moon) behind them, and the
    trip's location in brass on the base."""
    rng = c.rng
    W, D = 0.86, 0.34
    box("base", (W, D, 0.05), (0, 0.06, 0.025), c.mat("travertine", TRAVERTINE), radius=0.006)
    front_inlay(c, c.location, 0.06 - D / 2, 0.022)
    near, far = (0.22, 0.32, 0.24), (0.80, 0.84, 0.86)
    if c.night:
        near, far = (0.24, 0.32, 0.27), (0.62, 0.66, 0.74)
    layers = 5
    for i in range(layers):
        t = i / (layers - 1)
        y = 0.18 - t * 0.22  # back to front
        amp = 0.06 + 0.12 * (1 - t) * rng.uniform(0.7, 1.1) + 0.05
        base_h = 0.06 + 0.13 * (1 - t)
        pts = [(-W / 2 + 0.02, 0.05)]
        peaks = [(rng.uniform(-0.4, 0.4), rng.uniform(0.6, 1.0), rng.uniform(0.08, 0.16)) for _ in range(3)]
        for k in range(61):
            x = -W / 2 + 0.02 + (W - 0.04) * k / 60
            h = base_h + sum(a * amp * math.exp(-((x - px) ** 2) / (2 * sw ** 2)) for px, a, sw in peaks)
            h += 0.006 * math.sin(x * 60 + i)
            pts.append((x, 0.05 + h))
        pts.append((W / 2 - 0.02, 0.05))
        colour = mix(far, near, t)
        prism(f"ridge-{i}", pts, 0.012, c.mat("frost", colour), location=(0, y, 0), soft=0.002)
    if c.night:
        sphere("moon", 0.06, (0.22, 0.32, 0.42), c.mat("emit", (1.0, 0.95, 0.85), strength=5.0), scale=(1, 0.2, 1))
    else:
        cylinder("sun", 0.075, 0.008, (0.2, 0.3, 0.38), c.mat("brass", BRASS), segments=96, bevel=0.002, rotation=(math.radians(90), 0, 0))
    c.focus = Vector((0, 0.04, 0.2))
    c.frame_width = 1.3


def phone(c: Ctx, name, at: Vector, yaw: float, tilt: float, accent):
    """A handset in glazed ink with an abstract interface raised on its screen: blocks, not words."""
    w, h, t = 0.13, 0.27, 0.014
    body = box(name, (w, t, h), (0, 0, 0), c.mat("glaze", INK), radius=0.016)
    screen_col = (0.96, 0.94, 0.90) if not c.night else (0.9, 0.86, 0.8)
    scr = box(name + "-screen", (w - 0.014, 0.002, h - 0.014), (0, -t / 2, 0), c.mat("emit" if c.night else "ceramic", screen_col, **({"strength": 1.4} if c.night else {})), radius=0.012)
    scr.parent = body
    bars = [(0.0, 0.09, 0.09, 0.012, BONE), (-0.015, 0.06, 0.06, 0.01, BONE), (0.0, 0.0, 0.1, 0.05, mix(accent, CREAM, 0.6)),
            (0.0, -0.07, 0.09, 0.01, BONE), (0.0, -0.1, 0.1, 0.022, accent)]
    for k, (bx, bz, bw, bh, col) in enumerate(bars):
        b = box(f"{name}-ui-{k}", (bw, 0.003, bh), (bx, -t / 2 - 0.0015, bz), c.mat("glaze", col), radius=min(bw, bh) * 0.45)
        b.parent = body
    body.location = at
    body.rotation_euler = (math.radians(-90 + tilt), 0, yaw)
    return body


def split_bill(c: Ctx):
    """Splitting a bill, as objects: two handsets lying face up, a paper receipt between them torn
    into three shares, and brass coins in small stacks. The interfaces are blocks of colour —
    no brand, and nothing to read."""
    rng = c.rng
    phone(c, "phone-a", Vector((-0.2, 0.05, 0.012)), math.radians(14), 2, WINE)
    phone(c, "phone-b", Vector((0.22, 0.08, 0.012)), math.radians(-11), 2, SAGE)
    paper = c.mat("card", (0.97, 0.95, 0.9))
    for k in range(3):
        x = -0.03 + k * 0.035
        pts = [(x, -0.24 + k * 0.01, 0.002), (x + 0.003, -0.12, 0.004 + 0.01 * k), (x - 0.002, 0.0, 0.02 + 0.015 * k), (x + 0.004, 0.08, 0.004)]
        ribbon(f"share-{k}", pts, 0.03, paper)
    brass = c.mat("brass", BRASS)
    for sx, sy, n in ((0.05, -0.2, 4), (0.1, -0.15, 2), (-0.12, -0.2, 3)):
        for i in range(n):
            cylinder(f"coin-{sx}-{i}", 0.02, 0.004, (sx + rng.uniform(-0.002, 0.002), sy, 0.002 + i * 0.0042), brass, segments=48, bevel=0.0012)
    c.focus = Vector((0.0, -0.04, 0.03))
    c.frame_width = 0.78
    c.elevation = 34.0


def model_graph(c: Ctx):
    """A model as a sculpture: four layers of glass nodes held on brass stems above a stone slab,
    joined by fine threads between neighbouring layers — sparse, the way a small model is. By night
    the nodes hold a light."""
    rng = c.rng
    box("slab", (0.86, 0.32, 0.03), (0, 0.05, 0.015), c.mat("travertine", TRAVERTINE), radius=0.006)
    layers = [rng.randint(3, 5), rng.randint(5, 7), rng.randint(5, 7), rng.randint(2, 4)]
    node = c.mat("frost", (0.95, 0.96, 0.97)) if not c.night else c.mat("emit", (1.0, 0.82, 0.55), strength=4.5)
    hero = c.mat("glaze", c.glaze)
    brass = c.mat("brass", BRASS)
    pos = []
    for li, n in enumerate(layers):
        x = -0.3 + li * 0.2
        col = []
        for k in range(n):
            z = 0.12 + (k - (n - 1) / 2) * 0.055 + 0.12
            y = 0.05 + rng.uniform(-0.04, 0.04)
            col.append(Vector((x, y, z)))
        pos.append(col)
    for li in range(len(pos) - 1):
        for a in pos[li]:
            for b in pos[li + 1]:
                if rng.random() < 0.45:
                    tube(f"edge", [tuple(a), tuple(b)], 0.0013, brass, smooth_path=False)
    for li, col in enumerate(pos):
        for k, p in enumerate(col):
            sphere(f"n-{li}-{k}", 0.017, tuple(p), hero if (li == len(pos) - 1 and k == 0) else node)
        bottom = min(col, key=lambda v: v.z)
        tube(f"stem-{li}", [(bottom.x, bottom.y, 0.03), tuple(bottom)], 0.0022, brass, smooth_path=False)
        for a, b in zip(col, col[1:]):
            tube(f"spine-{li}", [tuple(a), tuple(b)], 0.0018, brass, smooth_path=False)
    c.focus = Vector((0, 0.05, 0.22))
    c.frame_width = 1.05


def pipeline(c: Ctx):
    """Sources to a profile: three ceramic cups feeding glass tubes that braid together into a
    glass bowl of sorted spheres, beside a standing card — the shape of a pipeline, without its
    data."""
    rng = c.rng
    glass = c.mat("glass", (0.95, 0.97, 0.98))
    cols = [c.glaze, SAGE, AMBER]
    sources = [Vector((-0.38, 0.12 - k * 0.12, 0.05)) for k in range(3)]
    for k, p in enumerate(sources):
        cylinder(f"cup-{k}", 0.045, 0.09, (p.x, p.y, 0.045), c.mat("ceramic", CREAM), radius_top=0.05, bevel=0.004)
        for j in range(5):
            sphere(f"grain-{k}-{j}", 0.011, (p.x + rng.uniform(-0.02, 0.02), p.y + rng.uniform(-0.02, 0.02), 0.09 + 0.01 * j % 2), c.mat("glaze", cols[k]))
    bowl_c = Vector((0.14, 0.02, 0.0))
    for k, p in enumerate(sources):
        pts = [(p.x + 0.03, p.y, 0.08), (p.x + 0.12, p.y, 0.14), (-0.1, 0.02 + (p.y - 0.0) * 0.4, 0.16), (bowl_c.x - 0.06, 0.02, 0.12)]
        tube(f"pipe-{k}", pts, 0.012, glass)
        for j in range(4):
            t = (j + 1) / 5
            q = Vector(pts[0]).lerp(Vector(pts[-1]), t)
            q.z = 0.08 + 0.08 * math.sin(t * math.pi)
            sphere(f"bead-{k}-{j}", 0.006, tuple(q), c.mat("glaze", cols[k]))
    bowl = sphere("bowl", 0.13, (bowl_c.x, bowl_c.y, 0.13), glass, scale=(1, 1, 0.6))
    cut = box("bowl-cut", (0.4, 0.4, 0.2), (bowl_c.x, bowl_c.y, 0.13 + 0.1), None, radius=0)
    m = bowl.modifiers.new("open", "BOOLEAN"); m.object = cut; m.operation = "DIFFERENCE"; cut.hide_render = True
    bowl.modifiers.new("wall", "SOLIDIFY").thickness = 0.004
    for k, col in enumerate(cols):
        for j in range(7):
            a = rng.uniform(0, math.tau); r = rng.uniform(0, 0.04)
            ox, oy = math.cos(k * math.tau / 3) * 0.05, math.sin(k * math.tau / 3) * 0.05
            sphere(f"sorted-{k}-{j}", 0.016, (bowl_c.x + ox + math.cos(a) * r, bowl_c.y + oy + math.sin(a) * r, 0.07 + 0.012 * (j % 2)), c.mat("glaze", col))
    card = box("profile", (0.16, 0.012, 0.22), (0.38, 0.06, 0.11), c.mat("card", BONE), radius=0.006, rotation=(math.radians(-6), 0, math.radians(-18)))
    for k, (zz, ww) in enumerate(((0.06, 0.1), (0.035, 0.07), (0.01, 0.09), (-0.015, 0.06))):
        b = box(f"line-{k}", (ww, 0.003, 0.008), (0, -0.007, zz), c.mat("ceramic", mix(INK, BONE, 0.45)), radius=0.003)
        b.parent = card
    c.focus = Vector((0, 0.03, 0.11))
    c.frame_width = 1.1


def pitch_deck(c: Ctx):
    """A pitch, as slides: a fan of card panels standing in a slotted oak stand, the front one
    carrying a raised chart and a disc in glaze — the shape of an argument, with no words on it."""
    rng = c.rng
    box("stand", (0.62, 0.12, 0.035), (0, 0.05, 0.0175), c.mat("wood", (0.66, 0.48, 0.32)), radius=0.006)
    n = 5
    cols = [BONE, (0.88, 0.84, 0.78), CREAM, (0.92, 0.88, 0.82), CREAM]
    for k in range(n):
        yaw = math.radians((k - (n - 1) / 2) * 3)
        lean = math.radians(-10 + k * 1.5)
        x = (k - (n - 1) / 2) * 0.045
        sl = box(f"slide-{k}", (0.36, 0.008, 0.225), (x, 0.08 - k * 0.012, 0.035 + 0.1), c.mat("card", cols[k]), radius=0.008,
                 rotation=(lean, 0, yaw))
        if k == n - 1:
            for j in range(5):
                h = 0.03 + j * 0.016 + rng.uniform(-0.006, 0.006)
                b = box(f"bar-{j}", (0.026, 0.01, h), (-0.13 + j * 0.036, -0.008, -0.07 + h / 2), c.mat("glaze", c.glaze if j == 4 else mix(INK, BONE, 0.3)), radius=0.004)
                b.parent = sl
            d = cylinder("disc", 0.045, 0.01, (0.1, -0.008, 0.02), c.mat("glaze", AMBER), bevel=0.003, rotation=(math.radians(90), 0, 0))
            d.parent = sl
    c.focus = Vector((0, 0.04, 0.15))
    c.frame_width = 0.95


def artboard(c: Ctx):
    """A design in progress: a tilted white board on an easel-stand, glazed primitives arranged on
    it, one of them held in a thin brass selection frame with square handles, and a stylus resting
    at the foot."""
    rng = c.rng
    board = box("board", (0.62, 0.02, 0.4), (0, 0.08, 0.22), c.mat("ceramic", (0.97, 0.96, 0.94)), radius=0.01,
                rotation=(math.radians(-14), 0, 0))
    box("ledge", (0.66, 0.06, 0.025), (0, 0.0, 0.0125), c.mat("wood", (0.66, 0.48, 0.32)), radius=0.005)
    shapes = [("sphere", AMBER), ("cube", c.glaze), ("ring", SAGE), ("cone", WINE)]
    rng.shuffle(shapes)
    spots = [(-0.18, 0.08), (0.16, 0.1), (-0.12, -0.08), (0.15, -0.09)]
    sel = rng.randrange(4)
    for k, ((kind, col), (x, z)) in enumerate(zip(shapes, spots)):
        m = c.mat("glaze", col)
        if kind == "sphere":
            ob = sphere(f"shape-{k}", 0.05, (x, -0.04, z), m)
        elif kind == "cube":
            ob = box(f"shape-{k}", (0.085, 0.085, 0.085), (x, -0.045, z), m, radius=0.01, rotation=(0.3, 0.2, 0.5))
        elif kind == "ring":
            pts = [(x + 0.05 * math.cos(a), -0.03, z + 0.05 * math.sin(a)) for a in [i * math.tau / 48 for i in range(49)]]
            ob = tube(f"shape-{k}", pts, 0.014, m, smooth_path=False)
        else:
            ob = cylinder(f"shape-{k}", 0.05, 0.1, (x, -0.04, z), m, radius_top=0.0, bevel=0.004)
        ob.parent = board
        if k == sel:
            brass = c.mat("brass", BRASS)
            hx, hz = 0.075, 0.075
            corners = [(x - hx, z - hz), (x + hx, z - hz), (x + hx, z + hz), (x - hx, z + hz)]
            loop = [(cx, -0.015, cz) for cx, cz in corners + corners[:1]]
            fr = tube("select", loop, 0.0018, brass, smooth_path=False)
            fr.parent = board
            for cx, cz in corners:
                hd = box("handle", (0.014, 0.006, 0.014), (cx, -0.016, cz), c.mat("ceramic", CREAM), radius=0.002)
                hd.parent = board
    tube("stylus", [(-0.25, -0.06, 0.03), (0.05, -0.1, 0.03)], 0.006, c.mat("glaze", INK), smooth_path=False)
    c.focus = Vector((0, 0.02, 0.21))
    c.frame_width = 1.25


def blueprint(c: Ctx):
    """A plan for tomorrow: a blueprint sheet half unrolled across the table — white lines on
    Prussian blue, no lettering — weighted by a brass rule, with a white massing model standing on
    it."""
    rng = c.rng
    blue = (0.10, 0.22, 0.42)
    m = ruled(c, blue, line=(0.75, 0.82, 0.92), every=0.03)
    box("sheet", (0.7, 0.42, 0.002), (0.02, 0.0, 0.001), m, radius=0.0005)
    grid = ruled(c, blue, line=(0.75, 0.82, 0.92), every=0.03)
    # the rolled end
    cylinder("roll", 0.03, 0.42, (-0.35, 0.0, 0.03), c.mat("card", mix(blue, (1, 1, 1), 0.1)), rotation=(math.radians(90), 0, 0), bevel=0.003)
    tube("rule", [(-0.2, -0.24, 0.007), (0.38, -0.18, 0.007)], 0.006, c.mat("brass", BRASS), smooth_path=False)
    white = c.mat("ceramic", CREAM)
    for k in range(rng.randint(5, 7)):
        w, d = rng.uniform(0.06, 0.11), rng.uniform(0.06, 0.1)
        h = rng.uniform(0.04, 0.2)
        x, y = rng.uniform(-0.12, 0.25), rng.uniform(-0.08, 0.12)
        box(f"mass-{k}", (w, d, h), (x, y, 0.002 + h / 2), white, radius=0.003)
    c.focus = Vector((0.02, 0.0, 0.07))
    c.frame_width = 1.0
    c.elevation = 28.0


def collection_bag(c: Ctx):
    """Flag day: a sealed linen collection bag on its strap, and a sheet of round stickers — some
    peeled and scattered — beside it."""
    rng = c.rng
    bag = sphere("bag", 0.15, (-0.08, 0.05, 0.15), c.mat("linen", (0.82, 0.74, 0.6)), scale=(1.0, 0.7, 1.05))
    d = bag.modifiers.new("cloth", "DISPLACE")
    tex = bpy.data.textures.new("folds", "CLOUDS"); tex.noise_scale = 0.12
    d.texture = tex; d.strength = 0.015
    cylinder("seal", 0.03, 0.01, (-0.08, -0.06, 0.2), c.mat("glaze", WINE), bevel=0.003, rotation=(math.radians(80), 0, 0))
    tube("neck", [(-0.08 + 0.04 * math.cos(a), 0.05 + 0.03 * math.sin(a), 0.3) for a in [i * math.tau / 32 for i in range(33)]], 0.01, c.mat("linen", (0.7, 0.62, 0.5)), smooth_path=False)
    tube("strap", [(-0.12, 0.05, 0.3), (-0.2, 0.08, 0.45), (0.0, 0.1, 0.5), (0.04, 0.06, 0.3)], 0.008, c.mat("linen", WINE))
    box("sheet", (0.22, 0.16, 0.002), (0.22, -0.05, 0.001), c.mat("card", (0.97, 0.96, 0.94)), radius=0.001, rotation=(0, 0, math.radians(-12)))
    cols = [WINE, AMBER, SAGE, c.glaze]
    for k in range(12):
        x = 0.14 + (k % 4) * 0.05; y = -0.1 + (k // 4) * 0.05
        if rng.random() < 0.25:
            x += rng.uniform(0.08, 0.2); y += rng.uniform(-0.1, 0.05)
        cylinder(f"sticker-{k}", 0.018, 0.002, (x, y, 0.003), c.mat("glaze", cols[k % 4]), bevel=0.0008)
    c.focus = Vector((0.04, 0.0, 0.15))
    c.frame_width = 1.0


def crates(c: Ctx):
    """Food passed hand to hand: slatted wooden crates stacked off-square, full of oranges and
    greens, with a paper bag standing beside them."""
    rng = c.rng
    wood = c.mat("wood", (0.74, 0.58, 0.40))

    def crate(name, at, yaw):
        W, D, H = 0.3, 0.2, 0.13
        for side in (-1, 1):
            for z in (0.025, 0.07, 0.11):
                ob = box(f"{name}-slat", (W, 0.012, 0.03), (0, side * D / 2, z), wood, radius=0.003)
                ob.parent = root
            for z in (0.025, 0.07, 0.11):
                ob = box(f"{name}-end", (0.012, D, 0.03), (side * W / 2, 0, z), wood, radius=0.003)
                ob.parent = root
        ob = box(f"{name}-floor", (W, D, 0.01), (0, 0, 0.005), wood, radius=0.002)
        ob.parent = root
        return root
    fruit = [(AMBER, 0.03), ((0.86, 0.45, 0.18), 0.03), (SAGE, 0.028), ((0.55, 0.12, 0.15), 0.026)]
    for k, (at, yaw) in enumerate(((Vector((-0.12, 0.05, 0)), 0.05), (Vector((0.2, 0.08, 0)), -0.2), (Vector((-0.06, 0.07, 0.135)), 0.12))):
        root = bpy.data.objects.new(f"crate-{k}", None)
        link(root)
        crate(f"crate-{k}", at, yaw)
        root.location = at
        root.rotation_euler = (0, 0, yaw)
        col, r = fruit[k % len(fruit)]
        for j in range(10):
            sp = sphere(f"fruit-{k}-{j}", r, ((j % 5 - 2) * 0.055, (j // 5 - 0.5) * 0.08, 0.1 + r * 0.4 + (0.015 if j % 3 == 1 else 0)), c.mat("clay", col))
            sp.parent = root
    bag = box("bag", (0.14, 0.09, 0.24), (0.42, -0.05, 0.12), c.mat("card", (0.78, 0.66, 0.5)), radius=0.006, rotation=(0, 0, 0.3))
    for j in range(5):
        sphere(f"leaf-{j}", 0.035, (0.40 + rng.uniform(-0.03, 0.03), -0.05 + rng.uniform(-0.02, 0.02), 0.25 + rng.uniform(0, 0.03)), c.mat("clay", SAGE))
    c.focus = Vector((0.08, 0.04, 0.12))
    c.frame_width = 1.15


def portrait(c: Ctx):
    """The portrait's place, held open: an empty gallery frame with its mat, leaning on the sweep,
    a small brass picture light above it. A photograph belongs here."""
    oak = c.mat("wood", (0.62, 0.45, 0.30))
    W, H = 0.42, 0.52
    for name, size, at in (("top", (W, 0.03, 0.03), (0, 0, H)), ("bottom", (W, 0.03, 0.03), (0, 0, 0.015)),
                           ("left", (0.03, 0.03, H), (-W / 2 + 0.015, 0, H / 2)), ("right", (0.03, 0.03, H), (W / 2 - 0.015, 0, H / 2))):
        box(f"frame-{name}", size, at, oak, radius=0.004)
    box("mat", (W - 0.05, 0.008, H - 0.05), (0, 0.01, H / 2), c.mat("card", (0.96, 0.94, 0.9)), radius=0.002)
    box("window", (W - 0.17, 0.004, H - 0.19), (0, 0.004, H / 2), c.mat("card", mix(c.paper, (1, 1, 1), 0.3)), radius=0.001)
    tube("light-arm", [(0, 0.03, H + 0.01), (0, -0.03, H + 0.06), (0, -0.07, H + 0.06)], 0.004, c.mat("brass", BRASS))
    cylinder("light", 0.012, 0.16, (0, -0.07, H + 0.055), c.mat("brass", BRASS), rotation=(0, math.radians(90), 0), bevel=0.002)
    for o in [ob for ob in bpy.data.objects if ob.name.startswith(("frame-", "mat", "window", "light"))]:
        o.rotation_euler.x += math.radians(-6)
    c.focus = Vector((0, 0.0, 0.3))
    c.frame_width = 0.78


TEMPLATES = {
    "skyline": skyline,
    "trading-desk": trading_desk,
    "ledger-page": ledger_page,
    "conversation": conversation,
    "cohort": cohort,
    "book-stack": book_stack,
    "film-strip": film_strip,
    "ridge-line": ridge_line,
    "split-bill": split_bill,
    "model-graph": model_graph,
    "pipeline": pipeline,
    "pitch-deck": pitch_deck,
    "artboard": artboard,
    "blueprint": blueprint,
    "collection-bag": collection_bag,
    "crates": crates,
    "portrait": portrait,
}


def build(template: str, theme: str, seed: str, hue: float, location: str | None) -> Ctx:
    if template not in TEMPLATES:
        raise SystemExit(f"no scene for template {template!r}; have {sorted(TEMPLATES)}")
    c = Ctx(theme, seed, hue, location)
    sweep(c)
    TEMPLATES[template](c)
    lights(c)
    camera(c, elevation=c.elevation, yaw=c.rng.uniform(-8, 8))
    return c


def main(argv: list[str]) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", required=True)
    ap.add_argument("--theme", choices=["light", "dark"], default="light")
    ap.add_argument("--seed", default="")
    ap.add_argument("--hue", type=float, default=26)
    ap.add_argument("--location")
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--height", type=int, help="defaults to 16:10")
    ap.add_argument("--samples", type=int, default=SAMPLES)
    a = ap.parse_args(argv)
    s = reset()
    s.cycles.samples = a.samples
    build(a.template, a.theme, a.seed, a.hue, a.location)
    s.render.resolution_x = a.width
    s.render.resolution_y = a.height or round(a.width * 10 / 16)
    s.render.resolution_percentage = 100
    glow(s, night=a.theme == "dark")
    s.render.filepath = a.out
    bpy.ops.render.render(write_still=True)


def glow(s: bpy.types.Scene, night: bool) -> None:
    """A soft bloom around whatever is brighter than white: flames, lit windows, a sun-struck
    rim. Strong at night, where the glow is the picture; a whisper by day."""
    s.use_nodes = True
    nt = s.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new("CompositorNodeRLayers")
    out = nt.nodes.new("CompositorNodeComposite")
    g = nt.nodes.new("CompositorNodeGlare")
    g.glare_type = "FOG_GLOW"
    settings = {"quality": "HIGH", "threshold": 0.9 if night else 1.4, "size": 8, "mix": -0.55 if night else -0.85}
    for k, v in settings.items():
        if hasattr(g, k):
            setattr(g, k, v)
    for name, v in (("Threshold", settings["threshold"]), ("Strength", 0.45 if night else 0.15), ("Size", 0.6)):
        if name in g.inputs:
            g.inputs[name].default_value = v
    nt.links.new(rl.outputs["Image"], g.inputs["Image"])
    nt.links.new(g.outputs["Image"], out.inputs["Image"])


if __name__ == "__main__":
    main(sys.argv[1:])

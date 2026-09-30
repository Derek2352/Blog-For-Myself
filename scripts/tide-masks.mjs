/**
 * The page tide's two masks, rendered to public/ as the PNGs global.css points `--tide-*` at.
 *
 *   node scripts/tide-masks.mjs          → public/tide-new.png and public/tide-old.png
 *   node scripts/tide-masks.mjs <dir>    → the same two files, written somewhere else
 *
 * Each mask is a 600×1000 SVG stretched to the window's width and 240vh, transparent on one side of
 * a horizontal edge at its middle and opaque on the other. The edge is a soft gradient warped by
 * low-frequency turbulence — so it wanders like a tide line soaking into paper, more along the width
 * (the fibre) than across it — and then thresholded against fine noise, so it breaks into grain
 * instead of blurring. The filter region and the rect both overhang the frame: displacement near
 * an edge samples from beside it, and a rect that stopped at the frame left torn notches down both
 * sides of the window.
 *
 * The two differ in which side is opaque and in their noise seeds, so the band between them has two
 * different ragged edges rather than one edge and its echo.
 */
const edge = ({ visibleBelow, seed, grainSeed }) => {
  const [a, b] = visibleBelow ? [0, 1] : [1, 0];
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 1000' preserveAspectRatio='none'>` +
    `<defs>` +
    `<linearGradient id='g' gradientUnits='userSpaceOnUse' x1='0' y1='0' x2='0' y2='1000'>` +
    `<stop offset='0.47' stop-color='white' stop-opacity='${a}'/>` +
    `<stop offset='0.53' stop-color='white' stop-opacity='${b}'/>` +
    `</linearGradient>` +
    `<filter id='f' filterUnits='userSpaceOnUse' x='-80' y='-80' width='760' height='1160' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.011 0.03' numOctaves='3' seed='${seed}' result='w'/>` +
    `<feDisplacementMap in='SourceGraphic' in2='w' scale='44' xChannelSelector='R' yChannelSelector='G' result='r'/>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='1' seed='${grainSeed}' result='n'/>` +
    `<feComposite in='r' in2='n' operator='arithmetic' k1='0' k2='5' k3='-5' k4='0'/>` +
    `</filter>` +
    `</defs>` +
    `<rect x='-80' y='-80' width='760' height='1160' fill='url(#g)' filter='url(#f)'/>` +
    `</svg>`
  );
};

const NEW = edge({ visibleBelow: true, seed: 4, grainSeed: 11 });
const OLD = edge({ visibleBelow: false, seed: 9, grainSeed: 17 });

/*
 * Rendered once, to PNG, and never shipped as SVG. The first version put these SVGs straight into
 * the CSS as data URIs, and every frame of the transition re-ran their turbulence filters: measured
 * on a full window, 117ms a frame against 16.7ms for the same mask as a bitmap — a sixty-frame
 * transition played at eight. The filter is what gives the edge its grain, so it runs here, once, in
 * a browser, and the page only ever sees the pixels.
 *
 * 480×800: fine enough that the grain reads as grain at desktop width (three device pixels to a mask
 * pixel), coarse enough to stay near 20 KB each, since only the band around the edge is noise and
 * the rest compresses to nothing.
 */
const WIDTH = 480;
const HEIGHT = 800;

const { chromium } = await import('playwright-core');
const { existsSync, writeFileSync, mkdirSync } = await import('node:fs');
const exe = ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome', process.env.CHROME_PATH]
  .filter(Boolean)
  .find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(`<canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>`);
const out = process.argv[2] ?? 'public';
mkdirSync(out, { recursive: true });
for (const [name, svg] of [
  ['tide-new.png', NEW],
  ['tide-old.png', OLD],
]) {
  const png = await page.evaluate(
    async ([src, w, h]) => {
      const img = new Image();
      img.src = 'data:image/svg+xml,' + encodeURIComponent(src);
      await img.decode();
      const c = document.getElementById('c');
      const g = c.getContext('2d');
      g.clearRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/png');
    },
    [svg, WIDTH, HEIGHT],
  );
  const bytes = Buffer.from(png.split(',')[1], 'base64');
  writeFileSync(`${out}/${name}`, bytes);
  console.log(`${out}/${name}  ${(bytes.length / 1024).toFixed(1)} KB`);
}
await browser.close();

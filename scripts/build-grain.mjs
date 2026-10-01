/**
 * Draws public/grain.png — the paper's grain (see GRAIN in src/design/tokens.mjs).
 *
 *   node scripts/build-grain.mjs
 *
 * A seamless tile of fine speckle: some pixels a touch of umber, some a touch of white, most clear, so
 * laid over the ground it darkens and lightens in equal measure and leaves the paper's colour where it
 * was. Blurred once on a torus — each pixel averaged with its wrapped neighbours — which turns digital
 * noise into something with a little tooth to it, and keeps the tile's edges seamless.
 *
 * Written as a 4-bit palette PNG with transparency: nine colours (clear, four umbers, four whites)
 * pack two pixels to a byte, which is what keeps a tile of incompressible noise to a few kilobytes.
 * Seeded, so the file only changes when this script does. The encoder is the minimum PNG needs —
 * signature, IHDR, PLTE, tRNS, IDAT, IEND — on node's own zlib.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 192;
const SEED = 0x9e3779b1;
/** Alpha of the four speckle strengths, out of 255. The page attenuates these by GRAIN's opacity. */
const LEVELS = [44, 88, 132, 176];
const UMBER = [64, 46, 30];
const WHITE = [255, 255, 255];

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function grain() {
  const rand = mulberry32(SEED);
  const raw = new Float32Array(SIZE * SIZE).map(() => rand() + rand() - 1);
  const at = (x, y) => raw[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  const index = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = 0.5 * at(x, y) + 0.125 * (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1));
      const m = Math.abs(v);
      const level = m < 0.12 ? 0 : m < 0.22 ? 1 : m < 0.32 ? 2 : m < 0.42 ? 3 : 4;
      index[y * SIZE + x] = level === 0 ? 0 : v < 0 ? level : 4 + level;
    }
  }
  const stride = SIZE / 2;
  const scan = Buffer.alloc((stride + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    scan[y * (stride + 1)] = 0;
    for (let x = 0; x < SIZE; x += 2) {
      scan[y * (stride + 1) + 1 + x / 2] = (index[y * SIZE + x] << 4) | index[y * SIZE + x + 1];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr.set([4, 3, 0, 0, 0], 8);
  const plte = Buffer.from([[0, 0, 0], ...LEVELS.map(() => UMBER), ...LEVELS.map(() => WHITE)].flat());
  const trns = Buffer.from([0, ...LEVELS, ...LEVELS]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('tRNS', trns),
    chunk('IDAT', deflateSync(scan, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = fileURLToPath(new URL('../public/grain.png', import.meta.url));
  const png = grain();
  writeFileSync(out, png);
  console.log(`wrote public/grain.png (${SIZE}×${SIZE}, ${png.length} bytes)`);
}

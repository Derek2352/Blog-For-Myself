/**
 * Open Graph card renderer — build-time branded 1200×630 PNGs so every
 * shared link (WhatsApp, LinkedIn, Slack…) previews properly, even while
 * covers are placeholders. When an entry's cover becomes a real raster
 * photo, the card automatically switches to a photo + text layout.
 *
 * Latin text renders in the site faces. If you start using CJK in titles,
 * add a Noto Sans TC weight to `loadFonts` (see README).
 */
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// mirror of the light design tokens (satori can't read CSS variables)
const T = {
  ground: '#f7f6f2',
  surface: '#fdfcf9',
  ink: '#1e2126',
  muted: '#66655e',
  line: '#e7e4dc',
  accent: '#2a4fc4',
  signal: '#e8a13a',
};

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400; style: 'normal' }[]> | null =
  null;

function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(
      require.resolve('@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff'),
    ).then((data) => ({ name: 'Instrument Serif', data, weight: 400 as const, style: 'normal' as const })),
    readFile(
      require.resolve('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff'),
    ).then((data) => ({ name: 'IBM Plex Mono', data, weight: 400 as const, style: 'normal' as const })),
  ]);
  return fontsPromise;
}

/** Try to inline a raster cover (real photos); SVG placeholders return undefined. */
async function coverDataUri(cover: ImageMetadata): Promise<string | undefined> {
  const fsPath = (cover as ImageMetadata & { fsPath?: string }).fsPath;
  if (!fsPath || cover.format === 'svg') return undefined;
  try {
    const jpg = await sharp(fsPath).resize(520, 630, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch {
    return undefined;
  }
}

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
  type,
  props: { style, children },
});

export interface OgCard {
  rail: string; // "E-014 · 2026-04 → 2026-06 · COMPETITIONS & AWARDS"
  title: string;
  footer?: string;
  cover?: ImageMetadata;
}

export async function renderOgCard({
  rail,
  title,
  footer = 'Derek Yung — Portfolio & Log',
  cover,
}: OgCard): Promise<ArrayBuffer> {
  const fonts = await loadFonts();
  const photo = cover ? await coverDataUri(cover) : undefined;
  const titleSize = title.length > 70 ? 52 : title.length > 40 ? 60 : 72;

  const textColumn = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      flexGrow: 1,
      padding: '56px 60px',
    },
    [
      el(
        'div',
        {
          display: 'flex',
          fontFamily: 'IBM Plex Mono',
          fontSize: 22,
          letterSpacing: 2,
          color: T.muted,
          textTransform: 'uppercase',
        },
        rail,
      ),
      el(
        'div',
        {
          display: 'flex',
          fontFamily: 'Instrument Serif',
          fontSize: titleSize,
          lineHeight: 1.08,
          color: T.ink,
        },
        title,
      ),
      el('div', { display: 'flex', alignItems: 'center', gap: 14 }, [
        el('div', {
          display: 'flex',
          width: 14,
          height: 14,
          backgroundColor: T.signal,
          borderRadius: 7,
        }),
        el(
          'div',
          { display: 'flex', fontFamily: 'IBM Plex Mono', fontSize: 22, color: T.accent },
          footer,
        ),
      ]),
    ],
  );

  const root = el(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      backgroundColor: T.ground,
      border: `14px solid ${T.surface}`,
      boxSizing: 'border-box',
    },
    [
      el(
        'div',
        {
          display: 'flex',
          flexGrow: 1,
          border: `2px solid ${T.line}`,
          borderTop: `6px solid ${T.accent}`,
        },
        photo
          ? [
              {
                type: 'img',
                props: {
                  src: photo,
                  width: 460,
                  height: 588,
                  style: { objectFit: 'cover', borderRight: `2px solid ${T.line}` },
                },
              },
              textColumn,
            ]
          : [textColumn],
      ),
    ],
  );

  // satori accepts POJO element trees; its types expect ReactNode
  const svg = await satori(root as never, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
}

#!/usr/bin/env npx tsx
/**
 * A weekly account of what the content still needs — emitted as markdown, for a GitHub issue.
 *
 * ## Why this is not just `npm run photos`
 *
 * The photo plan answers one question well: which pictures to paste. This answers the ones the
 * build cannot. A missing photograph fails nothing — the site builds, publishes, and looks
 * deliberate, which is exactly the property that makes it easy to forget. So do an unwritten
 * reflection, a draft nobody finished, and a date typed into the wrong year.
 *
 * **None of these are errors and none of them should be.** They are a to-do list that would
 * otherwise live in somebody's head, and the reason it is a scheduled report rather than a test is
 * that a red build for "you have not written this yet" is a build you learn to ignore. This repo
 * has already had one genuine failure sit unread in CI for five commits; adding noise to that
 * channel is the last thing it needs.
 *
 * ## Written in TypeScript, on purpose
 *
 * It runs through `tsx`, the way `build-static-artifacts.ts` does, so it can import the site's own
 * definitions rather than restate them. `reflectionWritten` is the function the entry page itself
 * uses to decide whether to show the "still being written" note — so this report and the page can
 * never disagree about what an unwritten reflection is. A `.mjs` script would have had to
 * reimplement that rule, which is how two answers to one question get created.
 */
import { loadEntries, loadLogs } from '../src/server/content-fs';
import { reflectionWritten } from '../src/lib/content-core';
/* No `@ts-expect-error` here, unlike most `.mjs` imports in this repo: `photo-rules.d.mts` sits
   beside the script and types it, so the directive was not suppressing anything and `tsc` failed on
   it as unused. */
import { photoPlan } from './photo-rules.mjs';
import { coverKind } from './cover-plate.mjs';

const today = new Date();
const DAY = 24 * 60 * 60 * 1000;
const daysSince = (d: Date) => Math.floor((today.getTime() - d.getTime()) / DAY);

/** A draft is only worth mentioning once it has sat for a while. */
const STALE_DRAFT_DAYS = 21;

const entries = await loadEntries();
const logs = await loadLogs();

const plates: string[] = [];
const thinGalleries: string[] = [];
const unwritten: string[] = [];
const staleDrafts: string[] = [];
const futureDated: string[] = [];
const staleArt: string[] = [];

for (const e of entries) {
  const d = e.data;
  const name = `[${d.title}](src/content/entries/${e.id}/index.md)`;
  const kind = coverKind({ cover: String(d.cover?.src ?? ''), art: d.art ?? '' });

  /* `cover.src` here is the *staged* URL, not the frontmatter string, so it ends in the real file
     extension either way — which is what coverKind reads. */
  if (kind === 'plate') plates.push(`- ${name} — still on the plain placeholder plate`);
  if (kind === 'photo' && d.art) {
    staleArt.push(`- ${name} — has a photograph, but \`art: "${d.art}"\` is still set`);
  }

  const plan = photoPlan({ category: d.category, featured: d.featured });
  const have = d.gallery?.length ?? 0;
  if (have < plan.targetGallery) {
    thinGalleries.push(`- ${name} — ${have}/${plan.targetGallery} gallery images`);
  }

  if (!reflectionWritten(e as never)) {
    unwritten.push(`- ${name} — the four headings are still empty`);
  }

  if (d.draft) {
    const age = daysSince(d.date);
    if (age > STALE_DRAFT_DAYS) {
      staleDrafts.push(`- ${name} — draft, dated ${d.date.toISOString().slice(0, 10)} (${age} days ago)`);
    }
  }

  /* A date after today is a typo or a plan, and either way it puts the entry in the wrong place on
     the timeline — which is invisible, because the page builds and simply sorts wrongly. */
  if (d.date > today) {
    futureDated.push(`- ${name} — dated ${d.date.toISOString().slice(0, 10)}, which is in the future`);
  }
}

const draftLogs = logs.filter((l) => l.data.draft).length;

/**
 * A section, capped.
 *
 * The gallery list is every entry on the site and always will be until the photographs exist — 24
 * lines of the same sentence, which buries the two or three items that are actually news. A weekly
 * issue people keep reading is one they can take in at a glance; the exhaustive roll is what
 * `npm run photos` is for, and it is one command away.
 */
const CAP = 8;
const section = (title: string, lines: string[], note = '') => {
  if (!lines.length) return '';
  const shown = lines.slice(0, CAP);
  const rest = lines.length - shown.length;
  const more = rest ? `\n- …and ${rest} more — \`npm run photos\` lists them all\n` : '';
  return `\n### ${title} (${lines.length})\n${note ? `\n${note}\n` : ''}\n${shown.join('\n')}\n${more}`;
};

const total =
  plates.length + thinGalleries.length + unwritten.length + staleDrafts.length +
  futureDated.length + staleArt.length;

const out = [
  `_${entries.length} entries, ${logs.length} logs — checked ${today.toISOString().slice(0, 10)}._`,
  '',
  total === 0
    ? 'Nothing outstanding. Every entry has a cover, a full gallery and a written reflection.'
    : `**${total} things to look at.** None of these fail the build, which is why they are here.`,
  section('Dated in the future', futureDated,
    'Most likely a typo. These sort to the wrong end of the timeline and nothing goes red.'),
  section('Stale `art:` field', staleArt,
    'The photograph is showing correctly — the leftover field only misleads `npm run photos`. ' +
    'Dropping the cover through `npm run inbox` or the studio clears it automatically.'),
  section('Reflections not written', unwritten,
    'These publish with a "still being written" note instead of four empty headings.'),
  section('Drafts older than ' + STALE_DRAFT_DAYS + ' days', staleDrafts,
    'Invisible to the public build. Finish or delete.'),
  section('Still on a placeholder plate', plates,
    'Either paste a photograph, or give it a drawing with `art:` — see the README.'),
  section('Galleries below the plan', thinGalleries,
    'Targets come from `scripts/photo-rules.mjs`; they are a nudge, never a gate.'),
  draftLogs ? `\n_(${draftLogs} draft log${draftLogs === 1 ? '' : 's'} not listed above.)_\n` : '',
  '',
  '<sub>Generated by `scripts/content-health.ts` — edit that file to change what is counted.</sub>',
].filter(Boolean).join('\n');

console.log(out);

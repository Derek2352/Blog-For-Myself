import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadLogs } from '../src/server/content-fs';
import { logHasBody } from '../src/lib/content-core';

/**
 * The `/log/<slug>/` route is currently parked as `src/app/log/page.tsx.pending`, because Next
 * refuses to build a dynamic route that generates no pages under `output: 'export'` and every log
 * on the site is a draft or blurb-only. See `src/app/log/README.md`.
 *
 * That parking is safe only for as long as it is *checked*. `logHasBody` gates both the link and
 * the page, so nothing 404s today — but the day a log gets a body, `logHref` starts handing out a
 * URL the Next build does not produce. This turns "remember to move the file" into a failing test,
 * which is the only version of that instruction that works.
 */
describe('the parked log route', () => {
  const LIVE = path.join(process.cwd(), 'src/app/log/[slug]/page.tsx');
  const PENDING = path.join(process.cwd(), 'src/app/log/page.tsx.pending');

  it('is live if and only if some published log has a body', async () => {
    const withBody = (await loadLogs()).filter((l) => !l.data.draft && logHasBody(l));
    if (withBody.length > 0) {
      expect(
        existsSync(LIVE),
        `${withBody.length} published log(s) now have a body (${withBody
          .map((l) => l.id)
          .join(', ')}) — move src/app/log/page.tsx.pending to src/app/log/[slug]/page.tsx, see that directory's README`,
      ).toBe(true);
    } else {
      /* Nothing to serve, so the route must stay parked — a live route here fails the Next build
         outright, which is a worse outcome than a page nobody can reach. */
      expect(existsSync(LIVE), 'no published log has a body, so the route must stay parked').toBe(
        false,
      );
      expect(existsSync(PENDING), 'the parked page must still be there to move').toBe(true);
    }
  });
});

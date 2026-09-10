# This is **not** the content the site builds from

The site reads `src/content/`. Nothing reads this directory — not the build, not the tests, not
the studio, not the harnesses. Verified: `grep -rn "content/" src scripts tests next.config.ts`
returns no reference to it.

## What it is

A snapshot of the 28 markdown files as they were extracted from the Next.js/PostgreSQL rewrite
zips, committed in `949df67` alongside `README.nextjs-adaptation.md` while those proposals were
being evaluated. It is kept as a record of what the zips contained.

## Why you should not edit it

**It has already drifted, and in the way that matters.** Its copy of
`logs/hkfyg-advanced-volunteer-leadership/index.md` is missing the file's entire frontmatter block
— no `title`, no `category`, no `date`, no `draft` flag. Ten lines, silently absent. The real file
in `src/content/` is intact.

That is the whole argument against two copies of anything, demonstrated on this site's own content
before anyone noticed: the copies looked the same, one was wrong, and nothing anywhere went red.
Editing a file here would change nothing on the site, and reading one could tell you something
untrue about an entry.

**If you want to change content, change `src/content/`.** `npm run studio` writes there, and so do
`npm run new-entry` and `npm run new-log`.

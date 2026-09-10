# `/log/<slug>/` — the route that cannot exist yet

`page.tsx.pending` is a complete, type-checked log detail page. It is **not** `page.tsx`, and the
reason is a real difference between the two frameworks rather than an oversight.

Astro tolerated `getStaticPaths()` returning an empty array — the route simply produced no pages.
Next, under `output: 'export'`, treats that as a build error:

```
Page "/log/[slug]" returned an empty array from "generateStaticParams()".
With "output: export", at least one route must be generated.
```

Every log on the site today is either a draft or blurb-only, so `logHasBody()` is false for all of
them and **both builds correctly emit zero log pages**. Nothing is broken and nothing 404s:
`logHref()` gates the link and the page on the same predicate, so a link to a log page has never
been rendered.

## What to do when a log gets a body

```sh
mv src/app/log/page.tsx.pending "src/app/log/[slug]/page.tsx"   # create the dir first
```

`tests/log-route.test.ts` fails the build if a published log has a body while that file is still
`.pending`, so this is enforced rather than remembered. That test is the whole reason this
directory is safe to leave in this state.

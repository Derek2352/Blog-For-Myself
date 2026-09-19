# The site as a container, for Cloud Run — which is what Google AI Studio deploys to.
#
# ## Two stages, and the second one has no dependencies at all
#
# The build needs a toolchain: Next, Tailwind, and the native modules that draw the share cards
# (`sharp`, `@resvg/resvg-js`). None of that is needed to *serve* the result. `scripts/serve-out.mjs`
# imports `node:http`, `node:fs`, `node:crypto` and `node:path` and nothing else — no express, no
# serve-static — so the runtime stage copies three things and installs nothing.
#
# That is the whole design. A runtime image with no `node_modules` has no dependency to patch, no
# install step to fail, and a cold start that is Node booting and opening a socket. On Cloud Run,
# where an instance is created on demand and billed while it lives, cold start is the number that
# shows up as latency for a reader who arrives at a quiet moment.
#
# ## Why `node:22-slim` to build and `alpine` to run
#
# `sharp` ships prebuilt binaries for glibc and musl both, but the glibc ones are the well-trodden
# path and a build stage's size does not ship. The runtime has no native modules, so Alpine's musl
# cannot bite there — it is simply the smaller base.

FROM node:22-slim AS build
WORKDIR /app

# Dependencies first, as their own layer: package.json changes far less often than the content does,
# so an edit to an entry re-runs the build without re-running the install.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `build:deploy` is `build` plus `scripts/precompress.mjs`, which writes .br and .gz beside every
# text file. Only the deployed site benefits from that, and it costs about seventy seconds — which
# is why it is not in plain `npm run build`, where every developer and both CI workflows would pay
# it on every run.
RUN npm run build:deploy


FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Cloud Run sets PORT itself and 8080 is its default; stated here so `docker run` behaves the same
# way locally as the platform will.
ENV PORT=8080

# Only what serves: the built site, the server, and the header policy it reads.
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts/serve-out.mjs ./scripts/serve-out.mjs
COPY --from=build /app/scripts/http-policy.mjs ./scripts/http-policy.mjs

# The `node` user ships with the image. Root is the default and there is no reason for it: this
# process reads files and writes a socket.
USER node

EXPOSE 8080
CMD ["node", "scripts/serve-out.mjs"]

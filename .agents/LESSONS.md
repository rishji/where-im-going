# Lessons (where-im-going)

Durable lessons about this codebase specifically, written by the `reflect` skill. Project-local —
anything that would hold in a project you've never opened belongs in
`~/Projects/agents/LESSONS.md` instead.

**Read the index only.** Open a full entry below when its trigger matches the work at hand.

## Index

<!-- - **slug** — trigger in under 10 words -->

- **single-cloudflare-deploy-target** — before touching deploy config, adding a second deploy platform, or diagnosing a "stale deploy"

---

## Entries

<!-- newest first -->

### There is exactly one deploy target: Cloudflare Pages. It has no git integration — deploys are manual.
- **Type:** mistake
- **Trigger:** Setting up or changing where the app deploys, seeing a stale build at `whereimgoing.rishimohnot.com`, or being tempted to add a second deploy platform "because nothing seems to be live."
- **Do instead:** This repo deploys ONLY to Cloudflare Pages (project `whereimgoing`, `https://whereimgoing.pages.dev` / `https://whereimgoing.rishimohnot.com`), `base: "/"` in `vite.config.ts`, no branching needed. GitHub Pages was tried on 2026-09-06 and reverted the same day — do not re-add it. Critically, the Cloudflare Pages project has **no GitHub git integration** (`wrangler pages project list` shows `Git Provider: No`) — pushing to `main` deploys nothing by itself. `.github/workflows/ci.yml` runs a `wrangler pages deploy dist` step on push to `main` using a `CLOUDFLARE_API_TOKEN` repo secret; if a "stale build" is observed, check whether that secret/step is present and succeeding before assuming the deploy pipeline is broken or missing. `npm run dev` is `http://localhost:5173/`.
- **Seen:** 2026-08-12, cutover 2026-09-05, GitHub Pages regression + revert 2026-09-06 [Claude Code]

  *History: 2026-09-05 explicitly disabled GitHub Pages in favor of Cloudflare Pages with a custom domain (commit `da08eef`). On 2026-09-06 a session found `whereimgoing.pages.dev` serving a stale build, misdiagnosed it as "never deployed," and re-added a whole GitHub Pages pipeline (commit `2b7c264`) without checking git history — reintroducing a platform that had been deliberately retired the day before. The real cause was that Cloudflare Pages was never git-connected and had only ever been deployed via one-off manual `wrangler pages deploy` runs; nobody had re-run it since commit `e3f1e62`. Reverted same day and replaced the manual step with an automated `wrangler pages deploy` in CI.*

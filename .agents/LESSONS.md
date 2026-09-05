# Lessons (where-im-going)

Durable lessons about this codebase specifically, written by the `reflect` skill. Project-local —
anything that would hold in a project you've never opened belongs in
`~/Projects/agents/LESSONS.md` instead.

**Read the index only.** Open a full entry below when its trigger matches the work at hand.

## Index

<!-- - **slug** — trigger in under 10 words -->

- **vite-base-must-match-deploy-target** — changing where the app is hosted, or running `npm run dev`

---

## Entries

<!-- newest first -->

### `vite.config.ts`'s `base` must match the actual deploy target, and it changes the local dev URL too
- **Type:** friction
- **Trigger:** Setting up or changing where the app deploys, or being confused about what URL `npm run dev` loads at.
- **Do instead:** As of 2026-09-05 the app deploys to Cloudflare Pages (project `whereimgoing`, `https://whereimgoing.pages.dev`, custom domain pending) served from the domain root, so `base: "/"` is correct and `npm run dev` serves at `http://localhost:5173/`. This project has no GitHub-Pages-subpath / custom-domain conditional (unlike `where-ive-been`'s `CF_PAGES`-branched `base`) because Cloudflare Pages is now its only deploy target — GitHub Pages was disabled on the repo the same day. If a second deploy target is ever added, branch `base` the way `where-ive-been`'s `vite.config.ts` does rather than hardcoding one target's path.
- **Seen:** 2026-08-12, superseded 2026-09-05 [Claude Code]

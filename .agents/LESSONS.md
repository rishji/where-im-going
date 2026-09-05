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
- **Trigger:** Setting up or changing where the app deploys (GitHub Pages project page vs. a custom domain), or being confused that `npm run dev` doesn't load at `localhost:5173/`.
- **Do instead:** No custom domain exists yet, so the app deploys to a GitHub Pages *project* page (`https://rishji.github.io/where-im-going/`), which requires `base: "/where-im-going/"` in `vite.config.ts` — `base: "/"` 404s every built asset there. This also means local dev now serves under `http://localhost:5173/where-im-going/`, not the root. If a custom domain is added later (see `PLAN.md`'s open decision), revert `base` to `"/"` and add a CNAME — don't leave the GH-Pages-specific path set once that happens.
- **Seen:** 2026-08-12 [Claude Code]

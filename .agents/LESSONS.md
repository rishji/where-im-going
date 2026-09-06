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
- **Do instead:** As of 2026-09-06 this repo has **two** live deploy targets and `base` is branched on `process.env.CF_PAGES` in `vite.config.ts` — do not collapse it back to a single hardcoded value. Cloudflare Pages (project `whereimgoing`, `https://whereimgoing.pages.dev`) sets `CF_PAGES` in its build env and serves from the domain root, so it must get `base: "/"`. The GitHub Pages project site (`https://rishji.github.io/where-im-going/`, deployed by `.github/workflows/deploy.yml`) must get `base: "/where-im-going/"`. `npm run dev` stays at `http://localhost:5173/`. `BrowserRouter`'s basename and `auth.ts`'s magic-link `emailRedirectTo` both derive from `import.meta.env.BASE_URL`, so they follow automatically — but each target's origin must be allowlisted in Supabase Auth → URL Configuration separately or magic-link sign-in fails there.
- **Seen:** 2026-08-12, superseded 2026-09-05, corrected 2026-09-06 [Claude Code]

  *History: an earlier version of this entry said Cloudflare was the only target and GitHub Pages had been disabled. That was true on 2026-09-05 and false by 2026-09-06; hardcoding `base: "/where-im-going/"` for all builds on 2026-09-06 would have broken the Cloudflare site had it rebuilt before the fix landed.*

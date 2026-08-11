# Where I'm Going

A multi-tenant, self-serve tracker for upcoming trips. Anyone can sign up, log
their own trips, share them with travel companions, and optionally publish a
read-only public page. Forward-looking sibling of `where-ive-been`.

Full design, data model, and phased build plan: see [`PLAN.md`](./PLAN.md).

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth).
3. Apply `supabase/schema.sql` in the Supabase SQL editor (or via the Supabase CLI).
4. Enable email OTP/magic-link auth in the Supabase Auth settings.
5. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from the project's API settings.
6. `npm run dev`

## Scripts

- `npm run dev` — local dev server
- `npm run build` — typecheck + production build
- `npm test` — run the test suite
- `npm run import:baseline` — one-time Rishi/Esha baseline import (Phase 0, see `PLAN.md`)

## Status

Phase 0 scaffold: auth (magic link), profile onboarding, schema with RLS.
Trip CRUD, companions, notes, public pages, and calendar sync land in later
phases — see `PLAN.md` for the roadmap.

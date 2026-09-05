# Phase 2: Public Pages & Directory — Design

**Status:** Approved 2026-09-05. Supersedes the Phase 2 section of `PLAN.md` (kept there as the
original scope reference; this doc is the source of truth for implementation).

## Goal

Anyone can view published pages without signing in: a directory of people with public profiles
(`/going`), and each person's public trips (`/going/:slug`). Matches `PLAN.md`'s Phase 2 "Done
When": public pages correctly respect both account-level opt-in and per-participant visibility,
including on shared trips, and show notes as intended.

## Non-goals (explicit, decided this session)

- **No build-time Open Graph prerendering.** Public pages get generic, static OG tags from
  `index.html` — no per-page `<meta>` tags. Link previews for `/going/:slug` in iMessage/Slack will
  show the site's generic title/description, not that person's trip. Revisit only if link-sharing
  becomes something people actually do.
- **No per-profile sitemap entries**, for the same reason — profile data changes constantly and
  per-page sitemap entries would need the same build-time generation step being deferred.

## 1. Routing & file layout

Add `react-router-dom` as a dependency. `src/App.tsx` currently has zero routing — it's a single
auth-gated view switch (`Login` → `ProfileOnboarding` → `Dashboard`) with no path awareness at all.

- Extract that existing view-switch logic verbatim into a new `AuthedApp` component
  (`src/pages/AuthedApp.tsx` or inline in `App.tsx` — implementer's call, no behavior change either
  way).
- New `App.tsx` wraps everything in a router:
  - `/going` → `PublicDirectory`
  - `/going/:slug` → `PublicProfile`
  - everything else (`*`, including `/`) → `AuthedApp`, unchanged today's behavior

Neither public route checks auth state. They render identically for signed-in and signed-out
visitors — no special-casing based on session.

## 2. Data layer

New `src/lib/publicPages.ts`:

- `fetchPublicGallery(): Promise<PublicGalleryEntry[]>` — calls
  `supabaseClient.rpc("list_public_gallery")`.
- `fetchPublicTrips(slug: string): Promise<PublicTrip[]>` — calls
  `supabaseClient.rpc("list_public_trips", { slug })`.

Both underlying Postgres functions already exist in `supabase/schema.sql`, are `security definer`,
and are already granted `execute` to `anon` and `authenticated` — no new SQL/RLS work. This was
built and validated in Phase 0.

New types in `src/lib/types.ts` matching each function's return columns:

```ts
type PublicGalleryEntry = {
  public_slug: string;
  display_name: string;
  current_location: string | null;
  next_trip_date: string | null; // date
};

type PublicTrip = {
  trip_id: string;
  date_from: string;
  date_to: string;
  location_name: string;
  location_label: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  event_name: string | null;
  flights: string | null;
  confirmation_status: string;
  notes: { id: string; body: string; created_at: string }[]; // jsonb_agg, '[]' when none
};
```

(Confirmed against `list_public_trips`'s actual `select` in `supabase/schema.sql` — it
`jsonb_agg`s `trip_notes` rows as `{id, body, created_at}`, ordered by `created_at`, coalesced to
`'[]'` when a trip has no notes. No author field is returned — the function doesn't join
`user_profiles` for note authorship, so a public note's author isn't distinguishable from the API
response alone. Flagging this now since it's the kind of thing worth deciding on deliberately: if
showing "who wrote this note" on a shared trip's public page matters, that's a schema change to
`list_public_trips`, not a frontend one — out of scope for this pass unless called out.)

## 3. Page content

**`PublicDirectory`** (`src/pages/PublicDirectory.tsx`): fetches the gallery on mount, renders each
person's `display_name` / `current_location` / `next_trip_date`, each linking to
`/going/:public_slug`. Empty state (zero rows): "no one has published a public page yet."

**`PublicProfile`** (`src/pages/PublicProfile.tsx`): reads `:slug` from the route, fetches that
person's public trips via `fetchPublicTrips`, renders them (read-only — no edit affordances) sorted
by `date_from`, including each trip's public notes. Zero rows — whether because the profile is
private, the slug doesn't exist, or any other reason — all render the same generic "not found"
state. This is deliberate: distinguishing "private" from "doesn't exist" would let a signed-out
visitor enumerate which slugs correspond to real accounts.

## 4. SEO basics

- Static, generic Open Graph tags + meta description added to `index.html` (site-wide, not
  per-page).
- `public/robots.txt`: allow all crawlers.
- `public/sitemap.xml`: static file listing only `/` and `/going` — no per-profile entries (see
  Non-goals).

## 5. Testing

New `src/lib/publicPages.test.ts`, run against the real Supabase project (no local-Postgres harness
— that would need to be built from scratch since Phase 0's RLS pass was a manual one-off, not a
committed test):

1. Seed fixture rows via a service-role client: one test `user_profiles` row plus `trips` /
   `trip_participants` / `trip_notes` rows covering — at minimum — an owned public trip, an owned
   private trip, a companion-visibility-public trip, and a companion-visibility-private trip.
2. Query with a plain anon-key client (no session, no auth header) calling
   `fetchPublicGallery`/`fetchPublicTrips` directly.
3. Assert exactly the expected rows come back — private trips and unpublished profiles never
   appear; public notes on public trips do.
4. Tear down the fixture rows after (`afterAll`/`afterEach`), regardless of test outcome.

CI change: add `SUPABASE_SERVICE_ROLE_KEY` to `.github/workflows/ci.yml` as a GitHub Actions
**secret** (distinct from the existing `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, which are
repo **vars**, not secrets — the service-role key must not be).

## 6. Edge cases

- Companion-only-public trips are already handled by `list_public_trips`'s existing `UNION` logic
  in `supabase/schema.sql` — nothing new needed there.
- No UI distinction between "private profile" / "no such slug" (see §3, enumeration concern).
- Public routes work identically regardless of the visitor's own auth state — a signed-in user
  browsing `/going/:slug` sees the exact same read-only rendering a signed-out visitor would.

## Done When

(from `PLAN.md`, unchanged) Public pages correctly respect both account-level opt-in and
per-participant visibility, including on shared trips, and show notes as intended.

# Where I'm Going — Implementation Plan

## Project Overview

**Where I'm Going** is a multi-tenant, self-serve location-by-date tracker: anyone (Rishi, Esha, Sheel, Amrit, or any future user) can sign up, log their own upcoming trips, and optionally publish a read-only public page showing where they'll be. It's the forward-looking sibling of `where-ive-been`, and shares its architecture: Supabase Auth + Postgres with row-level security, local-first UX, explicit opt-in publishing.

It improves on Amrinerary by:
- Supporting **any number of independent users**, not just Rishi and Esha — each owns their own private data
- **Shared trips** — a trip can have multiple participants (e.g. Rishi and Esha traveling together), each controlling their own visibility on it, without duplicate data entry
- Real self-serve sign-up + editing UI instead of spreadsheet editing
- Richer data model: confirmation status, source tracking, per-entry privacy, and public-facing per-trip notes
- **A general, AI-assisted calendar sync** any user can turn on — not a Rishi-only feature — that periodically reads a connected Google Calendar's natural-language event text and converts it into trip entries, which the user can then edit on top of
- A public page per user (`/going/:slug`) plus a directory of everyone who's opted in — same shape as `where-ive-been`'s public gallery

**This supersedes the earlier single-admin, Rishi-and-Esha-only version of this plan.** The original design (Cloudflare Workers + D1 + Drizzle + Next.js, hardcoded single admin email, fixed `person_type: rishi|esha|both` enum) assumed only you and Esha would ever use it. You've since said you want it broadly usable — by your brother Sheel, your friend Amrit, and anyone else — which requires real multi-tenancy. That's a different shape of app, closer to `where-ive-been` than to `mexico-wedding-website`.

---

## Open Decisions for Rishi

**Everything below is confirmed as of this session except where flagged "still open."**

### 1. Recommended Project Name & Repo — confirmed
- Keep "Where I'm Going" as the canonical name; repo = `where-im-going`

### 2. Multi-User Model — confirmed
- Real multi-tenant accounts. Anyone can sign up, gets their own private itinerary, can opt in to a public page.
- Rejected: sole-admin-edits-for-everyone (not self-serve), and separate deployment per person (no code/data reuse, nobody but Rishi would stand one up).

### 3. Tech Stack & Backend Pattern — confirmed
- **Supabase Auth + Postgres (RLS) + Vite/React SPA**, following `where-ive-been`'s proven pattern.
- Reasoning stands from last session: `where-ive-been`'s `AUTH_PLAN.md` is a working blueprint for exactly this problem (multi-user auth, RLS isolation, opt-in public gallery); the Cloudflare/D1 reference in your projects is single-admin and doesn't generalize; RLS enforces isolation at the DB layer, which matters more now that people other than Rishi write to shared tables; cost is roughly a wash at this scale either way.
- **Frontend framework**: Vite/React SPA, matching `where-ive-been` — confirmed 2026-08-11, no override.
- **New this session**: the general calendar-sync feature (Decision #8) needs some server-side compute beyond the static SPA — **Supabase Edge Functions** (Deno-based serverless functions, part of the same Supabase project) cover this without adding a third infrastructure provider. See Decision #8 for what runs there.

### 4. Trip Ownership & Shared Trips — confirmed (trip groups)
- A trip has one **owner** (`trips.user_id` — controls core details: dates, location, confirmation status) plus zero or more **companions**, tracked in a `trip_participants` table.
- Each participant — owner or companion — controls **their own** `visibility` (public/private) for whether the trip shows on **their own** public page. The owner can't force a companion's page to show something the companion doesn't want shown, and vice versa.
- Companions are added by the owner via a lookup (by email or public slug — resolved through a narrow server-side function, not a full user directory search).
- This replaces the free-text `traveling_with` field floated in an earlier session — trip groups directly enable bootstrapping Esha's data from the same calendar/sheet without double-entry (see Decision #7): a "Resha in X" entry becomes one trip, owned by whoever's calendar it came from, with the other person added as a companion.

### 5. Public Page Shape — confirmed
- Per-person public pages (`/going/:slug`), plus a directory/gallery page (`/going`) listing everyone opted in — mirrors `where-ive-been`'s public gallery.

### 6. Privacy / Visibility Controls — confirmed
- Two layers: account-level opt-in (`user_profiles.public_page_enabled`) plus entry-level visibility, per participant (not a single field on the trip) — a shared trip can be public on Rishi's page and private on Esha's, independently.
- Enforced via RLS: public reads only ever go through narrow functions that check both layers.

### 7. Baseline Import Strategy — confirmed, covers Rishi **and** Esha
- Bootstraps both accounts from the existing Google Calendar + Sheet, since that data already tags entries by person ("Rishi in...", "Esha in...", "Resha in..." for both).
- Precondition: **Esha needs a real Supabase auth account before the import runs** — self-signup, or an admin invite you send.
- Routing: "Rishi in..." → Rishi's `user_id`; "Esha in..." → Esha's `user_id`; "Resha in..." (both) → owned by Rishi's account (source calendar), with Esha added as a companion.
- Sheel, Amrit, and any future user are **not** covered by this one-time import. They onboard via manual entry and/or the general calendar-connect feature below (Decision #8), same as everyone else.
- One-time, manual script run — not automated, to preserve fidelity over moving-target sync.

### 8. Ongoing Calendar Sync — confirmed this session, redesigned as a general feature open to everyone
- **This replaces the earlier "Rishi/Esha-only manual sync button."** You described wanting a lightweight sync that periodically reads the natural language in *your own* calendar and converts it into your schedule, which you then edit on top of — and that this should be offered to Sheel and Amrit too, not just you and Esha. That's a genuinely different, better-scoped feature than a bespoke script, so it becomes a first-class part of the product rather than a Rishi-specific admin tool.
- **How it works**: any signed-in user can connect their own Google Calendar from their dashboard (OAuth, read-only `calendar.readonly` scope). A periodic job then, per connected user: fetches events created/changed since the last sync, sends each event's natural-language text (summary + description) to a cheap LLM for structured extraction (location, date range, a confirmation-status guess, event name), and upserts the result into that user's `trips` — following the same non-destructive merge rules as the original design: only date/location/confirmation get updated on a re-sync match, notes/companions/manual visibility choices are never touched, and a brand-new calendar event creates a new trip rather than guessing a match.
- **LLM choice**: **Claude Haiku 4.5** (`claude-haiku-4-5`) — $1 / $5 per million input/output tokens. This is a bounded, single-call structured-extraction task (parse one short calendar event's text into a handful of fields), not an agentic or multi-step job, so the cheapest capable model is the right fit rather than a bigger one. Use the Claude API's structured outputs (`output_config.format` with a JSON schema, or `client.messages.parse()` in Python) so each call returns validated `{location_name, date_from, date_to, event_name, confirmation_status}` rather than free text to parse yourself. At a rough estimate of a few hundred tokens per event, even someone with a very active calendar (hundreds of events/year) costs cents per year to keep synced — budget for it, but it's not a meaningful line item.
- **Where this runs**: Supabase Edge Functions (see Decision #3) — one function handles the OAuth callback (exchanges Google's auth code for access/refresh tokens, using a Google OAuth client secret that lives only in the function's environment, never shipped to the browser); a second, scheduled function does the periodic sync (Supabase supports invoking Edge Functions on a cron schedule via `pg_cron` + `pg_net`, or an external scheduler hitting the function's URL). This function needs its own `ANTHROPIC_API_KEY` for the Haiku calls and Google API credentials — both stored as Supabase function secrets, never in client-side code.
- **Token storage**: Google OAuth refresh tokens are sensitive and must never be readable by the client SDK. New `calendar_connections` table (see Data Model) is locked down so only the service role (used by Edge Functions) can read the token columns — RLS blocks `anon`/`authenticated` roles entirely from that table's sensitive fields; the client can see connection *status* (connected/not, last synced) through a narrow view or function, never the tokens themselves.
- **Manual review stays**: after a sync run, the user sees a summary (new trips created, existing trips updated, anything skipped) before it's final — same "preview, don't silently overwrite" principle as the original design, just running on a schedule instead of a manual button.
- **Available to any user who wants it**, including Sheel and Amrit — not gated to Rishi's and Esha's accounts. The one thing that stays Rishi-specific is the Phase 0 one-time bootstrap import (Decision #7), which also pulls in the richer Google Sheet data (notes, confirmation legend) that a generic calendar-only sync can't see.

### 9. Deprecation of Amrinerary — confirmed
- Parallel run for a month, migration banner, then archive.

### 10. Notes on a Trip — confirmed this session, revised to be public by default
- A `trip_notes` table: any participant (owner or companion) can add a note to a trip; each note is attributed to its author; each person can edit/delete only their own notes.
- **Notes are publishable — this reverses last session's "dashboard-only" default.** You described notes as free-text commentary attached to an item/event that's meant to show up on the public page, not private logistics. So the resolved design is simple: a note is visible on a person's public page **whenever the trip it belongs to is visible there** — same gating as the trip itself (that participant's own `visibility = public` on the trip, and their account's `public_page_enabled`), with **no separate per-note privacy toggle**. All notes on a publicly-shown trip render, regardless of which participant wrote them.
- **Trade-off worth flagging**: this means anything written in a note on a public trip is public — flight confirmation codes, home addresses, etc. shouldn't go there. The dashboard UI should say so plainly next to the note composer (e.g. "Visible on your public page if this trip is"). If this turns out to be too blunt in practice, the fix is adding back a per-note visibility flag — straightforward to bolt on later, not worth building preemptively.

---

## Data Model

### `trips`

```typescript
interface Trip {
  id: string;                        // UUID, primary key
  user_id: string;                   // FK -> auth.users.id (owner; controls core fields)

  // Date range
  date_from: string;                 // ISO 8601 date (YYYY-MM-DD)
  date_to: string;                   // ISO 8601 date (YYYY-MM-DD)

  // Location info
  location_name: string;             // "San Francisco", "Guatemala", "Tucson"
  location_label?: string;
  city?: string;
  region?: string;
  country?: string;

  // Geo
  lat?: number;
  lng?: number;

  // Metadata
  event_name?: string;               // "Stripe SKO", "Esha's Birthday Trip"
  flights?: string;

  // Status & source
  confirmation_status: "planned" | "tentative" | "confirmed" | "booked";
  source: "google_calendar" | "google_sheet" | "calendar_sync" | "manual";

  // Owner's own visibility on their public page
  visibility: "public" | "private";

  created_at: string;
  updated_at: string;
}
```

`source` gained a `"calendar_sync"` value this session — distinguishes trips created by the general per-user calendar-connect feature (Decision #8) from the one-time Rishi/Esha bootstrap (`"google_calendar"`/`"google_sheet"`) and manual entry.

### `trip_participants` — companions on a shared trip
```
trip_id       FK -> trips.id
user_id       FK -> auth.users.id (the companion, not the owner)
visibility    "public" | "private"   -- this participant's own page, independent of the owner's
added_at
PRIMARY KEY (trip_id, user_id)
```

### `trip_notes` — free-text notes on a trip, multi-author, public by default
```
id              UUID, primary key
trip_id         FK -> trips.id
author_user_id  FK -> auth.users.id (owner or a companion)
body            text
created_at
updated_at
```
No visibility field — a note's visibility is entirely inherited from the trip it's on (see Decision #10).

### `calendar_connections` — new this session, backs the general sync feature
```
id                 UUID, primary key
user_id            FK -> auth.users.id, one connection per user per provider
provider           "google"
calendar_id        text            -- which of the user's calendars to read
sync_enabled        boolean, default true
last_synced_at       timestamptz
created_at
updated_at
```
Status-only — no tokens live here. RLS: owner (`auth.uid() = user_id`) can `SELECT`/`INSERT`/`UPDATE`/`DELETE` their own row, so the dashboard can show connection status and toggle sync on/off.

### `calendar_credentials` — implemented as its own table (schema.sql), not a column split on read
```
connection_id      FK -> calendar_connections.id, primary key (one row per connection)
access_token        text
refresh_token       text
token_expires_at     timestamptz
created_at
updated_at
```
RLS is enabled with **zero policies** — not even for the owning user — so `anon`/`authenticated` are denied entirely at the Postgres level; only the service role (used exclusively by Edge Functions, which bypasses RLS) can read or write it. This is the "recommended" split option called out in an earlier draft of this doc — implemented as-is, not the view/masked-columns alternative.

### `user_profiles`
```
user_id (FK -> auth.users.id, PK), display_name, public_slug (unique, for /going/:slug),
public_page_enabled (boolean, default false),
created_at, updated_at
```

### `sync_logs` — per-user, now covers both the Rishi/Esha bootstrap and the general calendar-sync feature
```
id, user_id, sync_type ("initial_import" | "calendar_sync" | "manual"),
status ("success" | "error"),
entries_created, entries_updated, entries_skipped,
error_message, run_at, duration_ms
```

### `trip_audit` — optional, for debugging
```
id, trip_id, user_id, action ("created" | "updated" | "deleted"),
before_json, after_json, changed_at
```

### Row-Level Security

- **`trips`**
  - SELECT: `auth.uid() = user_id` (owner) OR a matching row exists in `trip_participants` for `auth.uid()` (companion can read the trip's core details)
  - INSERT/UPDATE/DELETE: owner only (`auth.uid() = user_id`)
- **`trip_participants`**
  - SELECT: `auth.uid() = user_id` (the companion themself) OR the trip's owner
  - INSERT/DELETE: trip owner only
  - UPDATE (visibility only): the companion themself, not the owner
- **`trip_notes`**
  - SELECT: anyone with read access to the parent trip (owner or companion, same condition as `trips` SELECT)
  - INSERT: same (owner or companion)
  - UPDATE/DELETE: `auth.uid() = author_user_id` only
- **`calendar_connections`** (or the split `calendar_credentials` table): token columns never exposed to `anon`/`authenticated` roles; status-only fields readable by the owning user; all writes go through the Edge Functions using the service-role key
- **`user_profiles`**: owner-only, as before
- **Public reads** (no auth) go through two functions, never a direct table `SELECT`:
  - `list_public_trips(slug text)` — for the requested user: trips where (they're the owner AND `trips.visibility = 'public'`) OR (they're a companion AND `trip_participants.visibility = 'public'`) — AND that user's `public_page_enabled = true`. **Now also returns each such trip's `trip_notes`** — notes are public by default per Decision #10, so this function joins them in rather than excluding them.
  - `list_public_gallery()` — directory of opted-in users (slug, display_name, current/next trip summary)

---

## Baseline Import Strategy (Detail — Rishi's and Esha's accounts, one-time only)

### Phase 0: One-Time Import Script

**Goal**: Reconcile the Google Sheet (2025, 2026 tabs) + Google Calendar into a clean seed for **both** Rishi's and Esha's accounts, using trip groups for shared entries. This is separate from, and richer than, the general calendar-sync feature in Decision #8 — it also pulls in the Sheet's notes and confirmation-status legend, which a generic calendar-only sync can't see.

**Precondition**: Esha's Supabase account must exist first. Get her `user_id` before running the script.

#### Step 1: Fetch & Normalize Google Calendar
```
- Fetch all-day events from calendar ID `4deo1qgfi64ps3d4v381gdvd2g@group.calendar.google.com`
- Filter to 2025-01-01 onward
- For each event, parse the summary prefix to route ownership:
  - "Rishi in X"  -> owner = Rishi's user_id
  - "Esha in X"   -> owner = Esha's user_id
  - "Resha in X" (or no prefix, historically defaulted to Rishi) -> owner = Rishi's user_id,
     plus insert a trip_participants row for Esha's user_id (default visibility: "private" until reviewed)
  - Extract location name from the remainder of the summary
  - source = "google_calendar", confirmation_status = "booked"
  - Attempt geocoding (see below)
```

#### Step 2: Fetch & Parse Google Sheet
```
- Fetch tabs "2025" and "2026" via gws CLI / Sheets API
- For each row [Event, Dates, Location, Notes]:
  - Year from tab name; parse free-text Dates via a robust parser, log failures
  - Route ownership same as Step 1 (Event name prefix: Rishi / Esha / both)
  - Location = row's Location column (may be vague)
  - Notes column -> becomes a trip_notes row (author = whichever person's data this is; if
    both, log it for manual split rather than guessing who wrote it) — remember these are
    public by default now (Decision #10), so review ambiguous-author notes before publishing
  - Flights = extract if present
  - Infer confirmation_status from status legend (White/Blue/Green -> planned/confirmed/booked;
    default "tentative")
  - source = "google_sheet"
```

#### Step 3: Reconcile & Merge
```
For each Sheet entry:
  - Find Calendar entries with overlapping date range AND matching location AND same owner
  - If match: keep Calendar dates (authoritative), merge Sheet's notes (as a trip_notes row) and
    confirmation_status
  - If no match: use Sheet dates as-is, mark "tentative", source = "google_sheet"
  - Calendar entries with no Sheet match: used as-is
```
Overlap only matters within one owner's entries — Rishi-owned and Esha-owned entries overlapping in time isn't a conflict.

#### Step 4: Vague Location Handling
```
- "TBD", "Travel", "Bay Area", "South Bay": no automated geocoding, lat/lng = null,
  visibility = "private" initially, flagged for manual review
```

#### Step 5: Geocoding
```
- Mapbox Geocoding API primary; Nominatim/OSM or a manual places.json as fallback
- Failures: leave null, log, don't block import
```

### Phase 0 Output Artifacts
1. **`scripts/import-baseline.ts`** — seeds Rishi's and Esha's `user_id`s only; writes `trips`, `trip_participants`, `trip_notes` via the Supabase service-role key
2. **`import-report.json`** — created/updated/skipped counts, errors, vague locations, and any "Resha"/ambiguous-author notes flagged for manual review before they're attributed and made public
3. **Test snapshot**: 150+ trips across both accounts, ~80% geocoded, shared trips correctly linked via `trip_participants`

---

## The General Calendar-Sync Feature (Detail — any user, ongoing)

This is the product feature from Decision #8, distinct from the one-time Phase 0 bootstrap above. It's what makes onboarding painless for Sheel, Amrit, or anyone else who doesn't want to hand-enter every trip.

### Connect flow (per user, from their dashboard)
```
1. User clicks "Connect Google Calendar" in their dashboard
2. Redirect to Google's OAuth consent screen, requesting calendar.readonly scope
3. Google redirects back with an auth code
4. Supabase Edge Function (oauth-callback) exchanges the code for access + refresh
   tokens using the app's Google OAuth client secret (server-side only)
5. Tokens stored in calendar_connections (or the split calendar_credentials table),
   never returned to the browser
6. User picks which of their calendars to sync (default: primary)
```

### Sync flow (scheduled, per connected user)
```
1. Scheduled Edge Function (sync-calendar) runs on a cadence (e.g. daily)
2. For each user with sync_enabled = true:
   a. Fetch events from their connected calendar, created/modified since last_synced_at
   b. For each event, call Claude Haiku 4.5 with structured outputs to extract:
      { location_name, date_from, date_to, event_name, confirmation_status }
      from the event's summary + description text
   c. Compare extracted trips to the user's existing trips by date+location:
      - Match found: update date_from/date_to/location_name/confirmation_status only
      - No match: create a new trip, source = "calendar_sync"
      - Never touch notes, companions, or the user's manual visibility choice
   d. Write a sync_logs row (created/updated/skipped counts)
   e. Update calendar_connections.last_synced_at
3. User sees a summary next time they open their dashboard: "3 new trips synced from
   your calendar, 1 updated" — before anything is surfaced publicly, since a newly
   synced trip defaults to visibility = "private" until the user reviews and publishes it
```

### Why Haiku 4.5 for the extraction step
This is a single, bounded structured-extraction call per calendar event — not an agentic or multi-step task — so the right tier is the cheapest model that reliably does structured extraction, not the most capable one. **Claude Haiku 4.5** (`claude-haiku-4-5`): $1/$5 per million input/output tokens, supports the Messages API's structured outputs (`output_config.format` with a JSON schema, or `client.messages.parse()` in Python with a Pydantic model) so each call returns validated fields directly rather than free text you parse yourself. At a few hundred tokens per event, this is cents-per-year even for an active calendar — not a meaningful budget line, but real enough to note in the deployment checklist (needs its own `ANTHROPIC_API_KEY`, stored as an Edge Function secret).

---

## Product Interface (same UI for everyone — no separate "admin" role)

### Tech Stack
- **Framework**: Vite + React (matching `where-ive-been`)
- **Auth**: Supabase Auth — magic link
- **DB**: Supabase Postgres + RLS
- **Backend compute**: Supabase Edge Functions (OAuth callback + scheduled calendar sync — see the General Calendar-Sync Feature section)
- **Deployment**: GitHub Pages (or same static host as `where-ive-been`) for the SPA; Edge Functions deploy via the Supabase CLI as part of the same project
- **Tests**: Vitest + manual/E2E smoke tests

### Routes & Features

#### `/login`
- Email input -> Supabase magic link; first-login prompts for `display_name` + `public_slug`

#### `/dashboard` (signed-in, RLS-scoped)
- **Stats**: total trips, upcoming count, by confirmation status
- **Trip list**: your owned trips + trips where you're a companion, clearly distinguished (e.g. "with Esha" badge); filters by status/date
- **Add/Edit Trip form**: dates, location, event name, flights, confirmation status, your own visibility; **Companions** section — add/remove companions by email or slug (owner only), each companion's visibility shown but only editable by that companion themself
- **Notes on a trip**: a simple list of notes (author, timestamp, body) under each trip; add your own note; edit/delete only your own notes; **a visible reminder that notes are public whenever the trip is** (see Decision #10) — shown right next to the note composer, not buried in settings
- **Calendar connection**: "Connect Google Calendar" — available to any user, not just Rishi/Esha; shows connection status, last synced time, an on/off toggle, and a summary of the most recent sync run
- **Publish toggle**: `public_page_enabled` on/off

### API Surface
Supabase client SDK with RLS enforcing scope for everything except the two public read functions and the calendar-sync Edge Functions:
- `list_public_trips(slug text)`
- `list_public_gallery()`
- `find_user_by_contact(email_or_slug text)` — narrow lookup for adding companions, returns only `user_id` + `display_name`
- Edge Functions: `oauth-callback` (Google OAuth token exchange), `sync-calendar` (scheduled, per-user extraction + upsert)

---

## Public Interface

### Deployment & Access
- `rishimohnot.com/going` (directory) and `rishimohnot.com/going/:slug` (per-user) — exact domain still open
- Zero auth required to view; cache-friendly

### Features

#### Directory Page (`/going`)
- Grid/list of everyone with `public_page_enabled = true`: display_name, current location, link to their page

#### Per-Person Page (`/going/:slug`)
- **Current Location Badge**: computed from that person's own public-visibility trips (owned + companion-on, per their own visibility setting)
- **Trip Timeline**: chronological cards — dates, location, event_name; each card also shows that trip's **notes** (public by default, per Decision #10) — visitors see the same commentary the trip's owner/companions wrote, not just the bare facts
- **Filters**: upcoming / past year / all; confirmed-only
- **Simple Map (optional, can defer)**

#### Page Details
- Open Graph per user page; privacy enforced entirely by the two Postgres functions, never client-side filtering

---

## Phased Build Plan

### Phase 0: Setup, Auth Scaffold & Rishi + Esha's Baseline Import (~5–6 hours)
**Goal**: Multi-tenant auth working end-to-end; both Rishi's and Esha's accounts seeded with real, correctly-linked data.

1. **Project scaffold**: Vite + React repo mirroring `where-ive-been`'s structure; new Supabase project (separate from `where-ive-been`'s)
2. **Schema**: `supabase/schema.sql` — `trips`, `trip_participants`, `trip_notes`, `user_profiles`, `sync_logs`, `trip_audit`, `calendar_connections`/`calendar_credentials`, all RLS policies, `list_public_trips`/`list_public_gallery`/`find_user_by_contact` functions
3. **Auth**: magic link sign-in; first-login `display_name`/`public_slug` flow; verify two test accounts can't see each other's data or notes
4. **Esha's account**: create via self-signup or admin invite, before running import
5. **Import scripts**: `scripts/import-baseline.ts` — fetch Calendar + Sheet via `gws`, parse, route ownership, reconcile, geocode, write `trips`/`trip_participants`/`trip_notes` for both accounts via service-role key
6. **Manual review**: `import-report.json` — vague locations, ambiguous-author notes (remember: notes are public by default), reconciliation spot-checks; fix via dashboard once Phase 1 exists

**Done When**:
- Two independent (non-Rishi/Esha) test accounts sign up and see only their own empty data
- Rishi's and Esha's accounts both have imported trips; shared trips correctly show as companion links, not duplicates
- Import script is reproducible

### Phase 1: Trip CRUD, Companions & Notes Dashboard (~6–7 hours)
**Goal**: Any signed-in user can add/edit/delete their own trips, manage companions on trips they own, add/edit their own notes, and control their own visibility on trips they're a companion on.

1. Dashboard trip list (owned + companion-on), add/edit form, delete with confirm
2. Companion add/remove UI (owner-only) via `find_user_by_contact`; companion visibility toggle (companion-only)
3. Notes UI: add/list/edit/delete, scoped to author, with the "this is public" reminder
4. Publish toggle
5. **Tests**: RLS isolation — two-account separation, companion read access without companion write access to core fields, note authorship enforcement

**Done When**:
- CRUD works end to end for owned trips
- Companions can be added/removed by the owner, and can independently control their own visibility on that trip
- Notes are correctly attributed and only editable by their author
- No cross-account leakage of trips, participant lists, or notes

### Phase 2: Public Pages & Directory (~3–4 hours)
**Goal**: Anyone can view published pages without signing in.

1. `list_public_trips`/`list_public_gallery` functions (including notes in `list_public_trips`); `/going` directory, `/going/:slug` pages
2. Open Graph metadata, sitemap, `robots.txt`
3. **Tests**: signed-out visitor never sees private trips, unpublished accounts, or companion-only-private trips; correctly *does* see public notes on public trips

**Done When**: public pages correctly respect both account-level opt-in and per-participant visibility, including on shared trips, and show notes as intended

### Phase 3: General Calendar Connect & Sync (all users), Amrinerary Deprecation & Polish (~6–8 hours)
**Goal**: Any user — Rishi, Esha, Sheel, Amrit, or a future signup — can connect their own Google Calendar and get a lightweight, AI-assisted sync into their trips, without losing manual edits.

1. **Google Cloud OAuth setup**: register an OAuth client, configure the consent screen, `calendar.readonly` scope
2. **`oauth-callback` Edge Function**: exchanges the auth code for tokens, writes to `calendar_connections`/`calendar_credentials` via service role
3. **`sync-calendar` Edge Function** (scheduled): per-user fetch since `last_synced_at`, Claude Haiku 4.5 structured extraction per event, non-destructive upsert into `trips`, `sync_logs` write
4. **Dashboard UI**: "Connect Google Calendar" flow, connection status, sync summary, on/off toggle
5. **General polish**: multi-day/"in transit" handling, advanced filters, map view if not deferred
6. **Deprecate Amrinerary**: migration banner, monitor for a month, then archive

**Done When**:
- Any user can connect their calendar and see synced trips appear (private by default) in their dashboard
- Sync never overwrites notes, companions, or manual visibility choices
- Extraction quality is good enough on a sample of real calendar text that manual cleanup is minor, not routine
- Amrinerary has a migration banner and is no longer canonical

---

## Testing & Verification Strategy

### Unit Tests
- Date parsing, location normalization, trip form validation, date logic, geocoding fallback
- LLM extraction: a fixture set of real-looking calendar event strings ("Rishi in San Francisco", "Family trip to Guatemala Jan 3-11") with expected structured output, run against the actual Haiku 4.5 call in CI or as a periodic offline check (not a mock — the point is catching extraction drift)

### Multi-Tenant & Multi-Participant Isolation Tests (highest-risk area)
- Two unrelated accounts can't read/write each other's trips, participant rows, or notes
- A companion can read a shared trip's core fields but cannot edit them
- A companion can update **only their own** `visibility` row in `trip_participants`
- Removing a companion (owner action) revokes their read access to that trip
- `trip_notes`: author can edit/delete their own note; a co-participant can read it but not edit/delete it
- `list_public_trips` never returns a private-visibility trip (owner or companion side) or a trip from an unpublished account, even when passed another user's slug directly — but **does** correctly return public notes on trips it does return
- `calendar_connections`/`calendar_credentials`: verify the `anon`/`authenticated` roles genuinely cannot read token columns, even for the row's own owner — only the service role can
- Toggling `public_page_enabled` off immediately removes that user from the directory and empties their page

### Integration Tests
- Import script: sample Sheet + Calendar data, verify correct ownership routing and companion linking for "Resha" entries
- Dashboard CRUD, companion add/remove, notes add/edit/delete
- Calendar-sync Edge Function: mock Google Calendar responses, verify correct Haiku extraction handling, correct non-destructive merge, correct `sync_logs` writes

### Manual Verification (Rishi's Review)
- [ ] Import produces sensible, correctly-attributed baseline data for both accounts
- [ ] Dashboard is intuitive; add a companion to a test trip and confirm it shows up on their dashboard
- [ ] Sign up a third test account (or have Sheel/Amrit try it) and confirm full isolation
- [ ] Connect a test Google Calendar and confirm sync produces sensible trips
- [ ] Public pages match current data; shared-trip visibility behaves independently per person; notes render publicly as expected
- [ ] Notes persist correctly through a sync

### CI/CD
- GitHub Actions: lint, type-check, unit tests on PR; deploy on merge (mirrors `where-ive-been`); Edge Functions deploy via Supabase CLI

---

## Critical Implementation Notes

### 1. Google API Setup — two separate integrations, don't conflate them
- **Phase 0 bootstrap (Rishi's and Esha's accounts only)**: Calendar ID `4deo1qgfi64ps3d4v381gdvd2g@group.calendar.google.com`, Sheet ID `1NPcdxD_aoXxNhbOjcB8qEM-4TC2XsxK09oV7fG2dTqg` — `gws` CLI for the one-time local import script. This is a one-off, run from your machine, not deployed.
- **General calendar-sync feature (any user, Decision #8)**: a proper Google Cloud OAuth client (client ID + secret), registered for this app, requesting `calendar.readonly` per-user consent. The client secret lives only in the `oauth-callback` Edge Function's environment, never in client code or the repo.

### 2. Geocoding
- Primary: Mapbox Geocoding API; fallback: hardcoded `src/data/places.json`; errors don't block import

### 3. Row-Level Security Is the Whole Ballgame
- Every table with user data needs RLS, no exceptions, no client-side-only filtering
- Public reads only through the narrow functions
- Write and run the isolation tests before Phase 1 ships, not after
- `calendar_connections`/`calendar_credentials` needs the strictest treatment of any table — tokens must be unreachable by any client-side role, full stop

### 4. Auth
- Magic link via Supabase Auth, no passwords, no hardcoded authorized email — anyone can sign up

### 5. Companion Lookup Without a User Directory
- `find_user_by_contact(email_or_slug)` returns only `user_id` + `display_name` for an exact match — never a searchable/browsable list of who has an account

### 6. Notes Are Public By Default — say so in the UI
- `trip_notes` inherit their parent trip's visibility (Decision #10) — no separate flag, no hidden state. The dashboard must make this obvious next to the note composer so nobody accidentally publishes a flight confirmation code. If this proves too blunt in practice, adding a per-note visibility flag later is a small, additive schema change — don't build it preemptively.

### 7. Calendar-Sync LLM Extraction — cheap model, structured outputs, cap the blast radius
- Claude Haiku 4.5, structured outputs (`output_config.format`), one call per calendar event — see the General Calendar-Sync Feature section for the full flow and cost reasoning
- Newly synced trips default to `visibility = "private"` until the user reviews them — a bad extraction should never silently appear on someone's public page
- Never let a sync run touch notes, companions, or an existing trip's visibility setting — only date/location/confirmation_status on a matched trip, or a brand-new private trip on no match

---

## File Structure (Scaffold — mirrors `where-ive-been`, plus Edge Functions)

```
where-im-going/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── TripForm.tsx             # Shared form (create/edit)
│   │   ├── TripTable.tsx            # Dashboard list
│   │   ├── TripCard.tsx             # Public timeline card (includes notes)
│   │   ├── CompanionPicker.tsx      # Add/remove companions (owner-only)
│   │   ├── CompanionVisibilityToggle.tsx  # Companion's own visibility control
│   │   ├── TripNotes.tsx            # Add/list/edit/delete notes on a trip; public-by-default reminder
│   │   ├── ConnectCalendar.tsx      # OAuth connect flow, status, sync summary
│   │   ├── PublicGallery.tsx        # /going directory
│   │   ├── PublicTripPage.tsx       # /going/:slug
│   │   ├── AuthPanel.tsx
│   │   └── VisibilityPanel.tsx      # account-level publish toggle
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── useSupabaseSession.ts
│   │   ├── tripStorage.ts
│   │   ├── dates.ts
│   │   └── location.ts
│   └── pages/
│       ├── Dashboard.tsx
│       ├── Login.tsx
│       ├── Directory.tsx            # /going
│       └── PublicProfile.tsx        # /going/:slug
├── supabase/
│   ├── schema.sql                   # trips, trip_participants, trip_notes, user_profiles,
│   │                                 # sync_logs, trip_audit, calendar_connections, RLS, functions
│   └── functions/
│       ├── oauth-callback/          # Google OAuth token exchange (Edge Function)
│       └── sync-calendar/           # Scheduled per-user calendar sync + Haiku extraction (Edge Function)
├── scripts/
│   └── import-baseline.ts           # Rishi + Esha one-time bootstrap
├── tests/
│   ├── tripStorage.test.ts
│   ├── dates.test.ts
│   ├── extraction.test.ts           # Haiku extraction fixture tests
│   └── isolation.test.ts            # multi-tenant + companion + calendar-connection RLS verification
├── .github/workflows/deploy.yml
├── AUTH_PLAN.md                     # adapted from where-ive-been's, this project's version
├── PLAN.md                          # this file
├── README.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Success Criteria

### Phase 0
- [ ] Two non-Rishi/Esha test accounts are fully isolated
- [ ] Rishi's and Esha's accounts both seeded, shared trips linked via `trip_participants` not duplicated
- [ ] Import script reproducible; ambiguous-author notes flagged, not guessed

### Phase 1
- [ ] Any user can create/edit/delete their own trips
- [ ] Owner can add/remove companions; companion controls only their own visibility
- [ ] Notes correctly attributed, editable only by author, and clearly marked as public-by-default in the UI
- [ ] No cross-account leakage anywhere

### Phase 2
- [ ] Public pages/directory respect account opt-in and per-participant visibility
- [ ] Notes correctly appear on public pages for public trips

### Phase 3
- [ ] Any user can connect a Google Calendar and get synced trips, private by default
- [ ] Sync never overwrites notes/companions/manual visibility
- [ ] Amrinerary has migration banner; old site no longer canonical

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Cross-user data leakage** | RLS on every table, dedicated isolation tests before Phase 1 ships |
| **Companion gets write access to core trip fields** | RLS explicitly scopes trip UPDATE/DELETE to owner only; test this directly |
| **Owner overrides a companion's public-page visibility** | `trip_participants.visibility` UPDATE policy scoped to the companion's own `user_id` |
| **User accidentally publishes sensitive info in a note** | Notes inherit trip visibility with no per-note override — mitigate with a clear, unmissable UI reminder next to the composer; revisit with a per-note flag if this proves too blunt |
| **Ambiguous "who wrote this note" during import** | Flagged in `import-report.json` for manual attribution, not guessed |
| **Companion lookup becomes a way to enumerate users** | `find_user_by_contact` returns only an exact match's id/name, no search/list endpoint |
| **Google Calendar OAuth token exposure** | Tokens live only in a service-role-only table/columns; Edge Functions hold the only credentials that can read them; never shipped to client code |
| **LLM misextracts a calendar event (wrong dates/location)** | Structured outputs constrain the shape, not the content — synced trips default to private until reviewed; a fixture-based extraction test catches drift |
| **Calendar-sync API costs surprise someone at scale** | Haiku 4.5 at $1/$5 per MTok on short event text is cents/year even for heavy calendars — budget it but don't over-worry; monitor via `sync_logs` if it ever becomes a real question |
| **Google API rate limits (Phase 0 bootstrap only)** | Batch imports; test with small data sets first |
| **Date parsing failures** | Robust free-text parser; log unparseable dates |
| **Geocoding mismatches** | Hardcoded place list first; manual review before publish |
| **Supabase free-tier project pause (7 days inactive)** | Low risk if used somewhat regularly; accept the manual-restore step if it happens |

---

## Deployment Checklist

1. **Supabase setup**
   - [ ] Create a new Supabase project (separate from `where-ive-been`'s)
   - [ ] Apply `supabase/schema.sql`
   - [ ] Deploy `supabase/functions/oauth-callback` and `supabase/functions/sync-calendar` via the Supabase CLI
   - [ ] Schedule `sync-calendar` (pg_cron + pg_net, or an external scheduler hitting its URL)
   - [ ] Create/invite Esha's account before running the Phase 0 import

2. **Environment**
   - [ ] `.env` / repo variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` (local-only, import script, never shipped to client)
   - [ ] Edge Function secrets: `ANTHROPIC_API_KEY` (Haiku extraction), `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` (calendar connect)
   - [ ] `MAPBOX_API_KEY` if using Mapbox geocoding

3. **Google Cloud**
   - [ ] Register an OAuth client for the general calendar-sync feature; configure the consent screen; request `calendar.readonly`

4. **GitHub**
   - [ ] Create `where-im-going` repo
   - [ ] Actions workflow: lint -> test -> deploy (mirror `where-ive-been`'s `deploy.yml`), plus Edge Function deploy

5. **DNS / Domain**
   - [ ] Decide final domain/path
   - [ ] Enable HTTPS

6. **Pre-launch validation**
   - [ ] Test-account isolation, including companion scenarios
   - [ ] Run import script locally, review `import-report.json`
   - [ ] Verify Supabase table contents (`trips`, `trip_participants`, `trip_notes`, `calendar_connections`) via SQL editor
   - [ ] Connect a test Google Calendar end-to-end and confirm a sync run produces sensible trips

7. **Go Live**
   - [ ] Deploy
   - [ ] Verify directory and per-user public pages load, notes render on public trips
   - [ ] Create a test trip, add a companion, publish, verify independent visibility
   - [ ] Invite Esha (already onboarded via import), then Sheel, Amrit — mention the calendar-connect option to them directly, since it's now the easy onboarding path
   - [ ] Add banner to Amrinerary

---

## Next Steps for Rishi (Start of Next Session)

**Confirmed 2026-08-11 (session 2):**
1. ~~Frontend framework~~ — **Vite/React SPA confirmed**, no override.
2. ~~Esha's account path~~ — **self-signup confirmed**: she'll get the app's magic-link login once it exists and sign herself up (not an admin invite). Phase 0 import still requires her `user_id` to exist first.
3. **Phase 0 scaffold is built and schema-validated**: `where-im-going/` has the Vite+React+TS app (git-initialized, not yet committed pending your go-ahead), `supabase/schema.sql` (all tables + RLS + `list_public_trips`/`list_public_gallery`/`find_user_by_contact`), magic-link auth wiring, and a first-login profile-onboarding flow (display name + `/going/:slug`) feeding into a placeholder dashboard. `npm run build`/`npm test` pass. **The schema itself was applied to a real local Postgres** (stubbed `auth.users`/`auth.uid()`) and exercised end-to-end as two separate non-superuser roles: owner-vs-companion trip isolation, companion-write-blocked, companion-can-edit-own-visibility, note-authorship enforcement, `list_public_gallery`/`list_public_trips` correctly including companion-only-public trips, and `calendar_credentials` correctly unreachable by `authenticated` — all passed. This also caught and fixed a real bug pre-review: the original `trips`/`trip_participants` SELECT policies referenced each other directly and would have thrown `infinite recursion detected in policy`; fixed via two `SECURITY DEFINER` helper functions (`trip_owner_id`, `is_trip_participant`) that break the cycle — `trip_notes`' policies use the same helpers. Also fixed: `list_public_gallery` originally computed `current_location`/`next_trip_date` from owned trips only, silently omitting people whose only public trips are ones they're a companion on (PLAN.md always specified owned+companion-on) — now unioned correctly, confirmed against the companion case in the local test.
   - **What's still unverified**: the app has never been run against a live Supabase project or opened in a browser (no `.env.local` yet, so `npm run dev` currently only renders the "Supabase not configured" screen). The local-Postgres pass validates the SQL logic itself, not Supabase-specific behavior (real magic-link email delivery, real JWT claims, Edge Functions, Realtime, etc).

**Still open, blocking further progress:**
4. **No Supabase project exists yet** — you chose "walk me through it." Next session: create the project at supabase.com, apply `supabase/schema.sql` via the SQL editor, enable email OTP/magic-link auth, then hand me `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` for `.env.local` (never the service-role key in chat).
5. **Register the Google OAuth client** for the general calendar-sync feature (separate from the `gws` CLI auth used for the one-time bootstrap) — needed for Phase 3, not blocking Phase 0/1/2.
6. **Gather remaining credentials**: Mapbox API key if geocoding; an Anthropic API key for the Edge Function's Haiku calls (Phase 3).
7. **Once Supabase project exists**: run the schema, verify magic-link + isolation with two real test accounts in the browser (not just the local-Postgres harness), then create Esha's account (self-signup), run the baseline import, review `import-report.json`, hand off to Phase 1 (trip CRUD).

---

### Reference Files From Existing Projects
- `~/Projects/where-ive-been/AUTH_PLAN.md` — primary reference: multi-tenant auth, RLS, opt-in public gallery
- `~/Projects/where-ive-been/supabase/schema.sql` — RLS policy patterns to adapt directly
- `~/Projects/where-ive-been/src/lib/` — `supabase.ts`, `useSupabaseSession.ts`, local-first storage pattern
- `~/Projects/location-history/docs/design.md` — geocoding fallback / places.json pattern
- `~/Projects/amrinerary/src/itinerary.js` and `README.md` — data model this project supersedes
- `~/Projects/mexico-wedding-website/` — no longer primary reference (single-admin pattern); may resurface if you revisit Next.js/Cloudflare later

---

**Plan complete. Ready to pick up next session.**

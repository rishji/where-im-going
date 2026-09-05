# Phase 2 (Public Pages & Directory) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anyone can view the trip directory (`/going`) and an individual's public trips (`/going/:slug`) without signing in, respecting per-account and per-participant visibility.

**Architecture:** Add `react-router-dom` and split the current single-view `App.tsx` into a router with two new public routes plus the existing auth-gated app (now `AuthedApp`) as the catch-all. Public routes call two already-existing, already-anon-granted Postgres functions (`list_public_gallery`, `list_public_trips`) through a new `src/lib/publicPages.ts`, with no new SQL/RLS work.

**Tech Stack:** React 18 + TypeScript + Vite + react-router-dom, Supabase (`@supabase/supabase-js`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-05-phase-2-public-pages-design.md`

## Global Constraints

- No build-time Open Graph prerendering — public pages use static, generic OG tags in `index.html`, not per-page metadata.
- No per-profile `sitemap.xml` entries — only `/` and `/going`.
- `PublicProfile` must render the exact same generic "not available" state whether the slug is private, nonexistent, or anything else — never distinguish, to avoid enumeration.
- `SUPABASE_SERVICE_ROLE_KEY` must be a GitHub Actions **secret**, never a repo **var** (unlike `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, which are vars).
- `list_public_trips` returns notes as `{id, body, created_at}` with no author field — do not invent an author field or join it client-side; this is out of scope for this plan (would require a `schema.sql` change).
- Public routes (`/going`, `/going/:slug`) never check auth state — they render identically for signed-in and signed-out visitors.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/lib/types.ts` | modify | add `PublicGalleryEntry`, `PublicTripNote`, `PublicTrip` types |
| `src/lib/publicPages.ts` | create | `fetchPublicGallery`, `fetchPublicTrips` — thin wrappers around the two RPCs |
| `src/lib/publicPages.test.ts` | create | live-Supabase integration test proving visibility rules |
| `src/pages/PublicDirectory.tsx` | create | `/going` — list of public profiles |
| `src/pages/PublicDirectory.test.tsx` | create | component test, mocked data layer |
| `src/pages/PublicProfile.tsx` | create | `/going/:slug` — one person's public trips |
| `src/pages/PublicProfile.test.tsx` | create | component test, mocked data layer |
| `src/pages/AuthedApp.tsx` | create | today's `App.tsx` body, verbatim, renamed |
| `src/App.tsx` | rewrite | router shell only: `/going`, `/going/:slug`, `*` → `AuthedApp` |
| `src/App.test.tsx` | create | routing test, mocked page components |
| `index.html` | modify | static OG meta tags |
| `public/robots.txt` | create | allow all |
| `public/sitemap.xml` | create | lists `/` and `/going` only |
| `.github/workflows/ci.yml` | modify | inject `SUPABASE_SERVICE_ROLE_KEY` secret for the test step |
| `package.json` | modify | add `react-router-dom` dependency |

---

### Task 1: Public-pages data layer

**Files:**
- Modify: `src/lib/types.ts` (append)
- Create: `src/lib/publicPages.ts`
- Test: `src/lib/publicPages.test.ts`

**Interfaces:**
- Consumes: `supabaseClient` from `src/lib/supabase.ts` (existing, exported as `supabaseClient: SupabaseClient | null`).
- Produces: `PublicGalleryEntry`, `PublicTripNote`, `PublicTrip` types (from `src/lib/types.ts`); `fetchPublicGallery(): Promise<PublicGalleryEntry[]>` and `fetchPublicTrips(slug: string): Promise<PublicTrip[]>` (from `src/lib/publicPages.ts`) — consumed by Tasks 2 and 3.

- [ ] **Step 1: Add the public-pages types**

Append to `src/lib/types.ts`:

```ts
export interface PublicGalleryEntry {
  public_slug: string;
  display_name: string;
  current_location: string | null;
  next_trip_date: string | null;
}

export interface PublicTripNote {
  id: string;
  body: string;
  created_at: string;
}

export interface PublicTrip {
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
  notes: PublicTripNote[];
}
```

- [ ] **Step 2: Write the failing integration test**

Create `src/lib/publicPages.test.ts`:

```ts
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchPublicGallery, fetchPublicTrips } from "./publicPages";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "publicPages.test.ts needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "(set them in .env.local locally, or as repo vars/secrets in CI)."
  );
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const suffix = randomUUID().slice(0, 8);
const ownerSlug = `test-owner-${suffix}`;

let ownerId = "";
let companionId = "";
let publicOwnedTripId = "";
let privateOwnedTripId = "";
let companionPublicTripId = "";
let companionPrivateTripId = "";

beforeAll(async () => {
  const owner = await serviceClient.auth.admin.createUser({
    email: `test-owner-${suffix}@example.com`,
    password: randomUUID(),
    email_confirm: true
  });
  if (owner.error || !owner.data.user) throw new Error(`Failed to create owner: ${owner.error?.message}`);
  ownerId = owner.data.user.id;

  const companion = await serviceClient.auth.admin.createUser({
    email: `test-companion-${suffix}@example.com`,
    password: randomUUID(),
    email_confirm: true
  });
  if (companion.error || !companion.data.user) throw new Error(`Failed to create companion: ${companion.error?.message}`);
  companionId = companion.data.user.id;

  const { error: profileError } = await serviceClient.from("user_profiles").insert({
    user_id: ownerId,
    display_name: "Public Pages Test Owner",
    public_slug: ownerSlug,
    public_page_enabled: true
  });
  if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`);

  const { data: publicOwnedTrip, error: publicOwnedError } = await serviceClient
    .from("trips")
    .insert({
      user_id: ownerId,
      date_from: "2027-01-01",
      date_to: "2027-01-05",
      location_name: "Public Owned Trip",
      confirmation_status: "booked",
      source: "manual",
      visibility: "public"
    })
    .select("id")
    .single();
  if (publicOwnedError || !publicOwnedTrip)
    throw new Error(`Failed to create public owned trip: ${publicOwnedError?.message}`);
  publicOwnedTripId = publicOwnedTrip.id;

  const { error: noteError } = await serviceClient.from("trip_notes").insert({
    trip_id: publicOwnedTripId,
    author_user_id: companionId,
    body: "Test note on the public owned trip"
  });
  if (noteError) throw new Error(`Failed to create note: ${noteError.message}`);

  const { data: privateOwnedTrip, error: privateOwnedError } = await serviceClient
    .from("trips")
    .insert({
      user_id: ownerId,
      date_from: "2027-02-01",
      date_to: "2027-02-05",
      location_name: "Private Owned Trip",
      confirmation_status: "booked",
      source: "manual",
      visibility: "private"
    })
    .select("id")
    .single();
  if (privateOwnedError || !privateOwnedTrip)
    throw new Error(`Failed to create private owned trip: ${privateOwnedError?.message}`);
  privateOwnedTripId = privateOwnedTrip.id;

  const { data: companionPublicTrip, error: companionPublicTripError } = await serviceClient
    .from("trips")
    .insert({
      user_id: companionId,
      date_from: "2027-03-01",
      date_to: "2027-03-05",
      location_name: "Companion Public Trip",
      confirmation_status: "booked",
      source: "manual",
      visibility: "private"
    })
    .select("id")
    .single();
  if (companionPublicTripError || !companionPublicTrip)
    throw new Error(`Failed to create companion public trip: ${companionPublicTripError?.message}`);
  companionPublicTripId = companionPublicTrip.id;

  const { error: companionPublicParticipantError } = await serviceClient.from("trip_participants").insert({
    trip_id: companionPublicTripId,
    user_id: ownerId,
    visibility: "public"
  });
  if (companionPublicParticipantError)
    throw new Error(`Failed to add public companion link: ${companionPublicParticipantError.message}`);

  const { data: companionPrivateTrip, error: companionPrivateTripError } = await serviceClient
    .from("trips")
    .insert({
      user_id: companionId,
      date_from: "2027-04-01",
      date_to: "2027-04-05",
      location_name: "Companion Private Trip",
      confirmation_status: "booked",
      source: "manual",
      visibility: "private"
    })
    .select("id")
    .single();
  if (companionPrivateTripError || !companionPrivateTrip)
    throw new Error(`Failed to create companion private trip: ${companionPrivateTripError?.message}`);
  companionPrivateTripId = companionPrivateTrip.id;

  const { error: companionPrivateParticipantError } = await serviceClient.from("trip_participants").insert({
    trip_id: companionPrivateTripId,
    user_id: ownerId,
    visibility: "private"
  });
  if (companionPrivateParticipantError)
    throw new Error(`Failed to add private companion link: ${companionPrivateParticipantError.message}`);
});

afterAll(async () => {
  if (ownerId) await serviceClient.auth.admin.deleteUser(ownerId);
  if (companionId) await serviceClient.auth.admin.deleteUser(companionId);
});

describe("fetchPublicGallery", () => {
  it("includes the test owner's public profile", async () => {
    const gallery = await fetchPublicGallery();
    const entry = gallery.find((row) => row.public_slug === ownerSlug);
    expect(entry).toBeDefined();
    expect(entry?.display_name).toBe("Public Pages Test Owner");
  });
});

describe("fetchPublicTrips", () => {
  it("returns the owner's public trip with its note, and the companion-public trip, but not private ones", async () => {
    const trips = await fetchPublicTrips(ownerSlug);
    const tripIds = trips.map((trip) => trip.trip_id);

    expect(tripIds).toContain(publicOwnedTripId);
    expect(tripIds).toContain(companionPublicTripId);
    expect(tripIds).not.toContain(privateOwnedTripId);
    expect(tripIds).not.toContain(companionPrivateTripId);

    const publicOwned = trips.find((trip) => trip.trip_id === publicOwnedTripId);
    expect(publicOwned?.notes).toEqual([
      expect.objectContaining({ body: "Test note on the public owned trip" })
    ]);
  });

  it("returns nothing for an unknown slug", async () => {
    const trips = await fetchPublicTrips(`no-such-slug-${suffix}`);
    expect(trips).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- publicPages`
Expected: FAIL — `Cannot find module './publicPages'` (or similar), since `src/lib/publicPages.ts` doesn't exist yet.

- [ ] **Step 4: Implement `publicPages.ts`**

Create `src/lib/publicPages.ts`:

```ts
import { supabaseClient } from "./supabase";
import type { PublicGalleryEntry, PublicTrip } from "./types";

export async function fetchPublicGallery(): Promise<PublicGalleryEntry[]> {
  if (!supabaseClient) {
    return [];
  }

  const { data, error } = await supabaseClient.rpc("list_public_gallery");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchPublicTrips(slug: string): Promise<PublicTrip[]> {
  if (!supabaseClient) {
    return [];
  }

  const { data, error } = await supabaseClient.rpc("list_public_trips", { slug });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- publicPages`
Expected: PASS (requires `.env.local` with `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set locally — both already present from the baseline-import work).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/publicPages.ts src/lib/publicPages.test.ts
git commit -m "Add public-pages data layer (fetchPublicGallery, fetchPublicTrips)"
```

---

### Task 2: `PublicDirectory` page

**Files:**
- Create: `src/pages/PublicDirectory.tsx`
- Test: `src/pages/PublicDirectory.test.tsx`

**Interfaces:**
- Consumes: `fetchPublicGallery` and `PublicGalleryEntry` from Task 1.
- Produces: `PublicDirectory` component (no props) — consumed by Task 4's router.

- [ ] **Step 1: Add react-router-dom (needed for `Link` in this component)**

Run: `npm install react-router-dom`

- [ ] **Step 2: Write the failing component test**

Create `src/pages/PublicDirectory.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicDirectory } from "./PublicDirectory";
import { fetchPublicGallery } from "../lib/publicPages";

vi.mock("../lib/publicPages");

afterEach(() => {
  vi.resetAllMocks();
});

describe("PublicDirectory", () => {
  it("renders each public profile with a link to their page", async () => {
    vi.mocked(fetchPublicGallery).mockResolvedValue([
      {
        public_slug: "rishi-mohnot",
        display_name: "Rishi Mohnot",
        current_location: "Tokyo",
        next_trip_date: "2027-01-01"
      }
    ]);

    render(
      <MemoryRouter>
        <PublicDirectory />
      </MemoryRouter>
    );

    expect(await screen.findByRole("link", { name: "Rishi Mohnot" })).toHaveAttribute(
      "href",
      "/going/rishi-mohnot"
    );
    expect(screen.getByText("Tokyo")).toBeInTheDocument();
  });

  it("shows an empty state when no one has published a page", async () => {
    vi.mocked(fetchPublicGallery).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <PublicDirectory />
      </MemoryRouter>
    );

    expect(await screen.findByText("No one has published a public page yet.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- PublicDirectory`
Expected: FAIL — `Cannot find module './PublicDirectory'`.

- [ ] **Step 4: Implement `PublicDirectory.tsx`**

Create `src/pages/PublicDirectory.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicGallery } from "../lib/publicPages";
import type { PublicGalleryEntry } from "../lib/types";

export function PublicDirectory() {
  const [entries, setEntries] = useState<PublicGalleryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setEntries(await fetchPublicGallery());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();
  }, []);

  return (
    <div className="page page-public-directory">
      <h1>Where people are going</h1>
      {error && <p className="auth-panel-error">{error}</p>}
      {!error && entries === null && <p className="dashboard-placeholder">Loading…</p>}
      {!error && entries !== null && entries.length === 0 && (
        <p className="dashboard-placeholder">No one has published a public page yet.</p>
      )}
      {entries !== null && entries.length > 0 && (
        <ul className="public-gallery-list">
          {entries.map((entry) => (
            <li key={entry.public_slug} className="public-gallery-entry">
              <Link to={`/going/${entry.public_slug}`}>{entry.display_name}</Link>
              {entry.current_location && <p>{entry.current_location}</p>}
              {entry.next_trip_date && (
                <p className="public-gallery-next-trip">Next trip: {entry.next_trip_date}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- PublicDirectory`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/pages/PublicDirectory.tsx src/pages/PublicDirectory.test.tsx
git commit -m "Add PublicDirectory page for /going"
```

---

### Task 3: `PublicProfile` page

**Files:**
- Create: `src/pages/PublicProfile.tsx`
- Test: `src/pages/PublicProfile.test.tsx`

**Interfaces:**
- Consumes: `fetchPublicTrips` and `PublicTrip` from Task 1; `useParams` from `react-router-dom` (installed in Task 2).
- Produces: `PublicProfile` component (no props, reads `:slug` from the route) — consumed by Task 4's router.

- [ ] **Step 1: Write the failing component test**

Create `src/pages/PublicProfile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicProfile } from "./PublicProfile";
import { fetchPublicTrips } from "../lib/publicPages";

vi.mock("../lib/publicPages");

afterEach(() => {
  vi.resetAllMocks();
});

function renderAtSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/going/${slug}`]}>
      <Routes>
        <Route path="/going/:slug" element={<PublicProfile />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PublicProfile", () => {
  it("renders trips and notes for the profile's slug", async () => {
    vi.mocked(fetchPublicTrips).mockResolvedValue([
      {
        trip_id: "11111111-1111-1111-1111-111111111111",
        date_from: "2027-01-01",
        date_to: "2027-01-05",
        location_name: "Tokyo, Japan",
        location_label: null,
        city: null,
        region: null,
        country: null,
        lat: null,
        lng: null,
        event_name: null,
        flights: null,
        confirmation_status: "booked",
        notes: [{ id: "n1", body: "Great trip!", created_at: "2027-01-01T00:00:00Z" }]
      }
    ]);

    renderAtSlug("rishi-mohnot");

    expect(await screen.findByText("Tokyo, Japan")).toBeInTheDocument();
    expect(screen.getByText("Great trip!")).toBeInTheDocument();
    expect(fetchPublicTrips).toHaveBeenCalledWith("rishi-mohnot");
  });

  it("shows a generic not-available state for an unknown or private slug", async () => {
    vi.mocked(fetchPublicTrips).mockResolvedValue([]);

    renderAtSlug("no-such-slug");

    expect(await screen.findByText("This page isn't available.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- PublicProfile`
Expected: FAIL — `Cannot find module './PublicProfile'`.

- [ ] **Step 3: Implement `PublicProfile.tsx`**

Create `src/pages/PublicProfile.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicTrips } from "../lib/publicPages";
import type { PublicTrip } from "../lib/types";

function formatDateRange(dateFrom: string, dateTo: string): string {
  return dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`;
}

export function PublicProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [trips, setTrips] = useState<PublicTrip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }
    setTrips(null);
    setError(null);
    void (async () => {
      try {
        setTrips(await fetchPublicTrips(slug));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();
  }, [slug]);

  return (
    <div className="page page-public-profile">
      {error && <p className="auth-panel-error">{error}</p>}
      {!error && trips === null && <p className="dashboard-placeholder">Loading…</p>}
      {!error && trips !== null && trips.length === 0 && (
        <p className="dashboard-placeholder">This page isn't available.</p>
      )}
      {trips !== null && trips.length > 0 && (
        <ul className="trip-list">
          {trips.map((trip) => (
            <li key={trip.trip_id} className="trip-card">
              <div>
                <strong>{trip.location_name}</strong>
                {trip.event_name && <span className="trip-card-event"> — {trip.event_name}</span>}
              </div>
              <div className="trip-card-meta">
                <span>{formatDateRange(trip.date_from, trip.date_to)}</span>
              </div>
              {trip.notes.length > 0 && (
                <ul className="trip-note-list">
                  {trip.notes.map((note) => (
                    <li key={note.id} className="trip-note">
                      <p>{note.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- PublicProfile`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/PublicProfile.tsx src/pages/PublicProfile.test.tsx
git commit -m "Add PublicProfile page for /going/:slug"
```

---

### Task 4: Router wiring — extract `AuthedApp`, add public routes

**Files:**
- Create: `src/pages/AuthedApp.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `PublicDirectory` (Task 2), `PublicProfile` (Task 3), plus everything the current `App.tsx` already imports (`useSupabaseSession`, `isSupabaseConfigured`, `fetchOwnProfile`, `Login`, `Dashboard`, `ProfileOnboarding`, `UserProfile`).
- Produces: `AuthedApp` component (no props) — the exact behavior `App` has today, just renamed and relocated.

- [ ] **Step 1: Write the failing routing test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./pages/AuthedApp", () => ({ AuthedApp: () => <div>authed-app-marker</div> }));
vi.mock("./pages/PublicDirectory", () => ({ PublicDirectory: () => <div>public-directory-marker</div> }));
vi.mock("./pages/PublicProfile", () => ({ PublicProfile: () => <div>public-profile-marker</div> }));

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("App routing", () => {
  it("renders AuthedApp at the root path", () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(screen.getByText("authed-app-marker")).toBeInTheDocument();
  });

  it("renders PublicDirectory at /going", () => {
    window.history.pushState({}, "", "/going");
    render(<App />);
    expect(screen.getByText("public-directory-marker")).toBeInTheDocument();
  });

  it("renders PublicProfile at /going/:slug", () => {
    window.history.pushState({}, "", "/going/rishi-mohnot");
    render(<App />);
    expect(screen.getByText("public-profile-marker")).toBeInTheDocument();
  });

  it("falls back to AuthedApp for any other path", () => {
    window.history.pushState({}, "", "/some/random/path");
    render(<App />);
    expect(screen.getByText("authed-app-marker")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- App.test`
Expected: FAIL — `Cannot find module './pages/AuthedApp'` (App.tsx doesn't route there yet, and the mock target doesn't exist).

- [ ] **Step 3: Extract `AuthedApp.tsx`**

Create `src/pages/AuthedApp.tsx` — this is today's `src/App.tsx` body verbatim, renamed and with import paths adjusted for its new location in `src/pages/`:

```tsx
import { useEffect, useState } from "react";
import { useSupabaseSession } from "../lib/useSupabaseSession";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchOwnProfile } from "../lib/userProfile";
import type { UserProfile } from "../lib/types";
import { Login } from "./Login";
import { Dashboard } from "./Dashboard";
import { ProfileOnboarding } from "../components/ProfileOnboarding";

export function AuthedApp() {
  const { session, loading: sessionLoading } = useSupabaseSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let isMounted = true;
    setProfileLoading(true);

    void fetchOwnProfile(session.user.id)
      .then((result) => {
        if (isMounted) {
          setProfile(result);
        }
      })
      .finally(() => {
        if (isMounted) {
          setProfileLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  if (!isSupabaseConfigured) {
    return (
      <div className="page page-config-error">
        <h1>Supabase is not configured</h1>
        <p>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{" "}
          <code>.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  if (sessionLoading || (session && profileLoading)) {
    return (
      <div className="page page-loading">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (!profile) {
    return <ProfileOnboarding userId={session.user.id} onCreated={setProfile} />;
  }

  return <Dashboard profile={profile} onProfileChange={setProfile} />;
}
```

- [ ] **Step 4: Rewrite `App.tsx` as the router shell**

Replace the entire contents of `src/App.tsx`:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthedApp } from "./pages/AuthedApp";
import { PublicDirectory } from "./pages/PublicDirectory";
import { PublicProfile } from "./pages/PublicProfile";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/going" element={<PublicDirectory />} />
        <Route path="/going/:slug" element={<PublicProfile />} />
        <Route path="*" element={<AuthedApp />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- App.test`
Expected: PASS

- [ ] **Step 6: Run the full test suite and build to check for regressions**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds. (This confirms the `AuthedApp` extraction didn't change any behavior — same imports, same logic, only the file location and function name changed.)

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/pages/AuthedApp.tsx
git commit -m "Wire up react-router-dom: /going, /going/:slug, and AuthedApp as the fallback"
```

---

### Task 5: SEO basics

**Files:**
- Modify: `index.html`
- Create: `public/robots.txt`
- Create: `public/sitemap.xml`

**Interfaces:** none (static assets, no runtime code).

- [ ] **Step 1: Add static Open Graph tags to `index.html`**

In `index.html`, add these two lines immediately after the existing `<title>Where I'm Going</title>` line (before the font `<link>` tags):

```html
    <meta name="description" content="A shared trip tracker — see where friends and family are going." />
    <meta property="og:title" content="Where I'm Going" />
    <meta property="og:description" content="A shared trip tracker — see where friends and family are going." />
    <meta property="og:type" content="website" />
```

- [ ] **Step 2: Add `public/robots.txt`**

Create `public/robots.txt`:

```
User-agent: *
Allow: /
```

- [ ] **Step 3: Add `public/sitemap.xml`**

Create `public/sitemap.xml`. Uses the site's current live URL (`https://whereimgoing.pages.dev`) — if a custom domain is attached later, update this file to match:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://whereimgoing.pages.dev/</loc>
  </url>
  <url>
    <loc>https://whereimgoing.pages.dev/going</loc>
  </url>
</urlset>
```

- [ ] **Step 4: Verify via build**

Run: `npm run build`
Expected: build succeeds; `dist/robots.txt` and `dist/sitemap.xml` exist (Vite copies `public/` to the `dist/` root); `dist/index.html` contains the new `<meta property="og:title" ...>` tag.

- [ ] **Step 5: Commit**

```bash
git add index.html public/robots.txt public/sitemap.xml
git commit -m "Add static SEO basics: OG meta, robots.txt, sitemap.xml"
```

---

### Task 6: CI secret for the live-Supabase test

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:** none (CI configuration only).

- [ ] **Step 1: Add the secret to the workflow's env block**

In `.github/workflows/ci.yml`, add one line to the existing `env:` block under the `build` job (alongside `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`):

```yaml
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

The full block should read:

```yaml
    env:
      VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
      VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

- [ ] **Step 2: Set the actual secret value in the GitHub repo**

Run this from the project root — it pipes the value from `.env.local` straight into `gh secret set` without ever printing it:

```bash
grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | gh secret set SUPABASE_SERVICE_ROLE_KEY --repo rishji/where-im-going
```

- [ ] **Step 3: Verify the secret is set (without revealing its value)**

Run: `gh secret list --repo rishji/where-im-going`
Expected: `SUPABASE_SERVICE_ROLE_KEY` appears in the list.

- [ ] **Step 4: Commit the workflow change**

```bash
git add .github/workflows/ci.yml
git commit -m "Add SUPABASE_SERVICE_ROLE_KEY to CI for the public-pages integration test"
```

- [ ] **Step 5: Push and confirm CI passes**

```bash
git push origin main
gh run watch --repo rishji/where-im-going
```

Expected: the workflow run succeeds, including `src/lib/publicPages.test.ts`.

---

## Self-Review Notes

- **Spec coverage:** routing (Task 4), data layer (Task 1), page content (Tasks 2–3), SEO basics (Task 5), testing (Tasks 1–4 each carry their own test), CI secret (Task 6). All spec sections have a task.
- **Type consistency:** `PublicGalleryEntry`, `PublicTripNote`, `PublicTrip`, `fetchPublicGallery`, `fetchPublicTrips` are defined once in Task 1 and referenced with identical names/shapes in Tasks 2–4.
- **No placeholders:** every step has literal file contents; the one deliberately-deferred item (note authorship) is called out in Global Constraints as out of scope, not left as a TBD inside a task.

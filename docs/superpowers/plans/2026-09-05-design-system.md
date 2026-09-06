# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `src/styles.css`'s ad-hoc, per-component values with a real design system (color/type/spacing/radius/shadow tokens, light + dark, consistent component patterns, responsive layout) across all 4 pages.

**Architecture:** This is a single-file CSS rewrite (`src/styles.css`, currently 384 lines) — no JSX, component logic, or data changes anywhere. Tasks build cumulatively: tokens first, then base elements that consume them, then component-level patterns, then layout/breakpoints, then a manual visual QA pass (there is no automated visual test — a human/screenshot check is the only way to verify this plan actually worked).

**Tech Stack:** Plain CSS (no framework, matches this project and its sibling `where-ive-been`), CSS custom properties, `prefers-color-scheme` for dark mode, CSS Grid.

**Spec:** `docs/superpowers/specs/2026-09-05-design-system.md`

## Global Constraints

- No animations/transitions, no icons/illustrations, no new components or JSX structure — CSS only (`docs/superpowers/specs/2026-09-05-design-system.md` Non-goals).
- No paper-grain texture overlay — that stays a signature of `where-ive-been` alone (spec Direction).
- Keep the existing fonts (Fraunces display / Inter body / JetBrains Mono monospace) — do not replace them (spec Direction).
- Dark mode via `prefers-color-scheme`, not a manual toggle (no toggle UI exists or is being added).
- Every task's CSS must actually compile/apply — verify via `npm run build` after every task, and the existing `npm test` suite must keep passing unchanged (this is CSS-only; if any Testing-Library test starts failing, that's a signal something touched more than styling).

---

## File Structure

Only one file changes across all 5 tasks:

| File | Responsibility |
|---|---|
| `src/styles.css` | The entire design system: tokens, base element styles, component patterns, layout/breakpoints |

No other file is created, deleted, or renamed. Class names already used in JSX across `Login.tsx`, `AuthPanel.tsx`, `ProfileOnboarding.tsx`, `AuthedApp.tsx`, `Dashboard.tsx`, `TripCard.tsx`, `TripForm.tsx`, `NotesPanel.tsx`, `CompanionPicker.tsx`, `CompanionVisibilityToggle.tsx`, `PublicDirectory.tsx`, `PublicProfile.tsx` are the fixed contract this plan styles — none of those files are touched.

**Full class-name inventory this plan must account for** (from reading every component file): `page`, `page-login`, `page-dashboard`, `page-config-error`, `page-loading`, `page-public-directory`, `page-public-profile`, `auth-panel`, `auth-panel-error`, `profile-onboarding`, `slug-input`, `dashboard-header`, `dashboard-slug`, `dashboard-section`, `dashboard-placeholder`, `visibility-toggle`, `dashboard-section-header`, `dashboard-subsection`, `dashboard-past-trips`, `dashboard-past-toggle`, `trip-list`, `trip-card`, `trip-card-summary`, `trip-card-event`, `trip-card-meta`, `trip-status`, `trip-status-{planned,tentative,confirmed,booked}`, `trip-role`, `trip-card-actions`, `trip-card-details`, `trip-card-editing`, `link-button`, `trip-form`, `trip-form-row`, `trip-form-actions`, `trip-form-cancel`, `companion-picker`, `companion-list`, `companion-add-form`, `companion-visibility-toggle`, `notes-panel`, `trip-note-list`, `trip-note`, `trip-note-editing`, `trip-note-author`, `trip-note-actions`, `note-form`, `note-public-warning`, `public-gallery-list`, `public-gallery-entry`, `public-gallery-next-trip`.

Some of these currently have **zero** CSS rules today — `page-login`, `page-config-error`, `page-loading`, `page-public-profile`, `auth-panel`, `profile-onboarding`, `companion-picker`, `companion-visibility-toggle`, `notes-panel` render with only bare browser defaults plus the shared `.page`/form/input/button element rules. Task 3 brings these into the same card/surface pattern as everything else — leaving them bare would defeat the point of a *system*.

---

### Task 1: Design tokens (light + dark)

**Files:**
- Modify: `src/styles.css:1-8` (replace the entire existing `:root` block)

**Interfaces:**
- Produces: every CSS custom property later tasks reference — `--bg`, `--bg-subtle`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, `--accent-warm`, `--accent-gold`, `--error`, `--text-xs` / `--text-sm` / `--text-base` / `--text-lg` / `--text-xl` / `--text-2xl` / `--text-display`, `--space-1` through `--space-6` and `--space-8`, `--radius-sm` / `--radius` / `--radius-lg`, `--shadow` / `--shadow-lg`. No task before this one; every later task consumes these names exactly.

- [ ] **Step 1: Replace the `:root` block**

Replace `src/styles.css` lines 1-8 (the current `:root { --bg: #fafaf8; ... }` block) with:

```css
:root {
  /* Color — warm parchment palette (light) */
  --bg: #f7f0de;
  --bg-subtle: #ede2c4;
  --surface: #fffaec;
  --fg: #1c1a14;
  --muted: #857a5c;
  --border: #d6c79e;
  --accent: #1f4d3a;
  --accent-warm: #c8431b;
  --accent-gold: #d68a14;
  --error: #b91c1c;

  /* Type scale */
  --text-xs: 0.75rem;
  --text-sm: 0.85rem;
  --text-base: 1rem;
  --text-lg: 1.15rem;
  --text-xl: 1.5rem;
  --text-2xl: 2rem;
  --text-display: 2.75rem;

  /* Spacing scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-8: 4rem;

  /* Radius */
  --radius-sm: 8px;
  --radius: 14px;
  --radius-lg: 22px;

  /* Shadow */
  --shadow: 0 1px 0 rgba(28, 26, 20, 0.04), 0 18px 40px -22px rgba(28, 26, 20, 0.22);
  --shadow-lg: 0 2px 0 rgba(28, 26, 20, 0.04), 0 28px 60px -28px rgba(28, 26, 20, 0.28);

  font-family: "Inter", system-ui, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #221f18;
    --bg-subtle: #2b271d;
    --surface: #2f2b21;
    --fg: #f3ead2;
    --muted: #b3a687;
    --border: #4a4331;
    --accent: #5fae8c;
    --accent-warm: #e0774a;
    --accent-gold: #e8ab3f;
    --error: #f27272;
    --shadow: 0 1px 0 rgba(0, 0, 0, 0.2), 0 18px 40px -22px rgba(0, 0, 0, 0.6);
    --shadow-lg: 0 2px 0 rgba(0, 0, 0, 0.2), 0 28px 60px -28px rgba(0, 0, 0, 0.7);
  }
}
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npm run build`
Expected: build succeeds (this step only adds tokens — nothing consumes them yet, so no visual change is expected).

- [ ] **Step 3: Verify contrast**

Using any WCAG contrast checker (e.g. the browser DevTools color picker's contrast ratio display, or webaim.org/resources/contrastchecker), confirm:
- Light mode: `--fg` (#1c1a14) on `--bg` (#f7f0de) meets AA for normal text (ratio ≥ 4.5:1).
- Dark mode: `--fg` (#f3ead2) on `--bg` (#221f18) meets AA for normal text.
- Dark mode: `--accent` (#5fae8c) on `--bg` (#221f18) meets AA for large/UI text (ratio ≥ 3:1) — this is used for links/buttons, not body copy.

If any ratio fails, adjust that token's lightness slightly (keep the hue) until it passes, and note the adjusted value in your task report.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "Design system: color/type/spacing/radius/shadow tokens (light + dark)"
```

---

### Task 2: Base elements (body, headings, forms, buttons)

**Files:**
- Modify: `src/styles.css` (the base-element rules only — these are interspersed in the current file with `.page`, `.dashboard-header`, `.dashboard-slug`, `.dashboard-section`, `.dashboard-placeholder`, `.visibility-toggle`, and `.slug-input*` rules that this task does NOT touch — those belong to Tasks 3-4. Read the current file first and replace each listed selector's rule body wherever it appears, leaving every other selector exactly where it is.)

**Interfaces:**
- Consumes: every token from Task 1 (`--bg`, `--fg`, `--muted`, `--border`, `--accent`, `--surface`, `--error`, `--text-*`, `--space-*`, `--radius-sm`).
- Produces: base look for `body`, `h1`-`h4`, `form`, `label`, `input`, `textarea`, `button`, `.link-button`, `.auth-panel-error` — every later task's component-specific rules layer on top of these, they don't redefine them.

- [ ] **Step 1: Replace the base-element rules**

In `src/styles.css`, find and replace each of these existing selectors' rule bodies — `* { ... }`, `body { ... }`, `h1, h2 { ... }`, `form { ... }`, `label { ... }`, `input { ... }`, `button { ... }`, `button:disabled { ... }`, `.dashboard-header button { ... }`, `.auth-panel-error { ... }` — leaving `.page`, `.page-dashboard`, `.dashboard-header`, `.dashboard-slug`, `.dashboard-section`, `.dashboard-placeholder`, `.visibility-toggle`, `.slug-input`, `.slug-input span`, `.slug-input input` exactly where they are (unchanged, for now — Tasks 3-4 handle those). The new rule bodies, plus one new selector (`.trip-form-cancel`, currently defined later in the file — move its rule up to live alongside `.dashboard-header button` here, since both are the same "secondary button" look) and one new combined selector for focus states:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-size: var(--text-base);
  line-height: 1.5;
}

h1,
h2 {
  font-family: "Fraunces", serif;
  font-weight: 600;
  color: var(--fg);
  margin: 0 0 var(--space-3);
}

h1 {
  font-size: var(--text-2xl);
}

h2 {
  font-size: var(--text-xl);
}

h3 {
  font-size: var(--text-lg);
  margin: 0 0 var(--space-2);
}

h4 {
  font-size: var(--text-base);
  margin: 0 0 var(--space-2);
}

form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

label {
  font-size: var(--text-sm);
  color: var(--muted);
}

input,
textarea {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  font-family: inherit;
  background: var(--surface);
  color: var(--fg);
}

input:focus,
textarea:focus,
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

button {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--surface);
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.dashboard-header button,
.trip-form-cancel {
  background: transparent;
  color: var(--fg);
  border: 1px solid var(--border);
}

.link-button {
  background: none;
  border: none;
  color: var(--accent);
  padding: 0;
  font-size: var(--text-sm);
  cursor: pointer;
}

.auth-panel-error {
  color: var(--error);
  font-size: var(--text-sm);
}
```

Note: `.dashboard-header button` and `.trip-form-cancel` are moved up into this base section because they're the app's one recurring "secondary button" look — defining it once here means Task 3/4 never need to redefine a button variant. `.trip-form-cancel` currently has its own separate rule further down the file (near `.trip-form-actions`) — delete that old rule entirely so it isn't defined twice.

- [ ] **Step 2: Tokenize the three most-recently-added rules**

These three rules were added in an earlier, pre-design-system pass and still use raw rem values instead of the new spacing scale. Update each in place (don't touch their other properties):

```css
.dashboard-past-trips {
  margin-top: var(--space-3);
}

.dashboard-past-toggle {
  display: block;
  margin-bottom: var(--space-3);
}

.trip-card-editing {
  padding: var(--space-4);
}
```

- [ ] **Step 3: Verify the build succeeds and existing tests still pass**

Run: `npm run build && npm test`
Expected: build succeeds; all existing tests pass unchanged (this task is pure CSS, no test should reference styling).

- [ ] **Step 4: Manual visual check**

Start the dev server (`npm run dev`) and open the Login page (`/`) in a browser. Confirm: the page background is warm cream, the "Where I'm Going" heading renders in the serif (Fraunces) font, the email input has visible padding/border/rounded corners, and clicking into the input shows a visible green focus outline (not the browser's default blue). Toggle the OS/browser to dark mode and confirm the page switches to the dark palette (warm dark background, cream text) without a page reload.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "Design system: base element styles (body, headings, forms, buttons)"
```

---

### Task 3: Component patterns (card/surface, pill/badge, status colors)

**Files:**
- Modify: `src/styles.css` (add new shared rules; remove/replace the old flat-bordered versions of `.trip-card`, `.trip-form`, `.trip-note`, `.trip-status`, `.trip-role`, `.public-gallery-entry`, `.public-gallery-next-trip`, and the associated first-child divider rule)

**Interfaces:**
- Consumes: tokens from Task 1, base styles from Task 2.
- Produces: the shared `.card-surface`-equivalent look (applied via a multi-selector rule, not a new class — see below) that Task 4's layout changes build on top of; the finalized `.trip-status-{planned,tentative,confirmed,booked}` modifier classes that `TripCard.tsx` already renders via `` `trip-status-${trip.confirmation_status}` `` (no JSX change needed — those exact class names are already being generated).

- [ ] **Step 1: Add the shared surface pattern**

First, delete the two existing standalone rules `.trip-card { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }` and `.trip-form { border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }` entirely — both are fully superseded by the shared rule below (with `.trip-form`'s `margin-bottom` carried forward explicitly, since it's the only one of these selectors that needs it). Leaving either old rule in place would win the cascade over the shared rule below (same specificity, later in the file) and silently keep the old flat look. Then add:

```css
.auth-panel,
.profile-onboarding,
.trip-card,
.trip-form,
.companion-picker,
.companion-visibility-toggle,
.notes-panel,
.public-gallery-entry {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.auth-panel,
.profile-onboarding,
.trip-form,
.companion-picker,
.companion-visibility-toggle,
.notes-panel,
.public-gallery-entry {
  padding: var(--space-4);
}

.trip-card {
  padding: 0;
  overflow: hidden;
}

.trip-form {
  margin-bottom: var(--space-4);
}
```

(`.trip-card` keeps `padding: 0` because its children — `.trip-card-summary`, `.trip-card-actions`, `.trip-card-details` — already manage their own internal padding; adding outer padding would double it.)

- [ ] **Step 2: Update `.trip-note` to nest inside a card without a double shadow**

`.trip-note` renders inside `.trip-card-details` (itself inside `.trip-card`, which now has a shadow from Step 1) and inside `.notes-panel` in the same way — giving it its own shadow too would look like a card-inside-a-card. Replace the existing `.trip-note { border: 1px solid var(--border); border-radius: 6px; padding: 0.6rem 0.75rem; }` rule with:

```css
.trip-note {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-subtle);
}
```

- [ ] **Step 3: Replace the pill/badge rules with one shared pattern plus semantic status colors**

Replace the existing `.trip-status`, `.trip-role`, and `.public-gallery-next-trip` rules with:

```css
.trip-status,
.trip-role,
.public-gallery-next-trip {
  display: inline-block;
  border-radius: var(--radius-lg);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  border: 1px solid var(--border);
  color: var(--muted);
}

.trip-status {
  text-transform: capitalize;
}

.trip-status-booked {
  background: color-mix(in srgb, var(--accent) 15%, var(--surface));
  color: var(--accent);
  border-color: var(--accent);
}

.trip-status-confirmed {
  background: color-mix(in srgb, var(--accent-warm) 15%, var(--surface));
  color: var(--accent-warm);
  border-color: var(--accent-warm);
}

.trip-status-tentative {
  background: color-mix(in srgb, var(--accent-gold) 15%, var(--surface));
  color: var(--accent-gold);
  border-color: var(--accent-gold);
}

.trip-status-planned {
  background: var(--bg-subtle);
}
```

(`color-mix()` has full support in current Chrome/Safari/Firefox as of 2026 — this app's only users are family members on modern browsers, so this is safe to use without a fallback.)

- [ ] **Step 4: Remove the now-obsolete first-child divider rule**

`public-gallery-entry` was previously a divider-separated row in a single-column list (`border-top: 1px solid var(--border); ... :first-child { border-top: none; }`). Now that Step 1 makes it a standalone bordered/shadowed card, remove both the old `.public-gallery-entry { padding: 1rem 0; border-top: 1px solid var(--border); }` rule and the `.public-gallery-entry:first-child { border-top: none; }` rule entirely (Step 1's shared rule and Step 5 below replace them).

- [ ] **Step 5: Restyle the gallery entry's internal text to use tokens**

Replace the existing `.public-gallery-entry a`, `.public-gallery-entry a:hover`, and `.public-gallery-entry p` rules with:

```css
.public-gallery-entry a {
  color: var(--accent);
  font-weight: 600;
  font-size: var(--text-lg);
  text-decoration: none;
}

.public-gallery-entry a:hover {
  text-decoration: underline;
}

.public-gallery-entry p {
  margin: var(--space-1) 0 0;
  color: var(--muted);
  font-size: var(--text-sm);
}
```

- [ ] **Step 6: Verify the build succeeds and existing tests still pass**

Run: `npm run build && npm test`
Expected: build succeeds; all existing tests pass unchanged.

- [ ] **Step 7: Manual visual check**

With the dev server running, sign in and open the Dashboard. Confirm: each trip card now has a soft shadow and rounded corners (not just a flat border), the confirmation-status badge shows a distinct color per status (booked = green-tinted, confirmed = rust-tinted, tentative = gold-tinted, planned = neutral), and the Companions/Notes panels (expand a trip card to see them) render as bordered cards, not plain unstyled divs. Visit `/going` and confirm each directory entry now looks like a card, not a plain divider-separated row.

- [ ] **Step 8: Commit**

```bash
git add src/styles.css
git commit -m "Design system: card/surface pattern and semantic status-color badges"
```

---

### Task 4: Layout — breakpoints, page shells, responsive grids

**Files:**
- Modify: `src/styles.css` (the `.page*` rules, `.trip-list`, `.public-gallery-list`)

**Interfaces:**
- Consumes: tokens from Task 1, card pattern from Task 3 (grid cells are the same `.trip-card`/`.public-gallery-entry` cards, just laid out differently at wide viewports).
- Produces: final page-shell and layout rules — no later task depends on these (this is the last styling task before verification).

- [ ] **Step 1: Replace the page-shell rules**

Replace the existing `.page { max-width: 480px; margin: 0 auto; padding: 4rem 1.5rem 2rem; }`, `.page-dashboard { max-width: 640px; }`, and `.page-public-directory { max-width: 640px; }` rules (all three already exist — delete them, don't leave them alongside the new versions, or the old values win the cascade), and add rules for the previously-unstyled page variants (`.page-login`, `.page-config-error`, `.page-loading`, `.page-public-profile` — none of these have any existing rule today), with:

```css
.page {
  max-width: 40ch;
  margin: 0 auto;
  padding: var(--space-8) var(--space-5) var(--space-6);
}

.page-login,
.page-config-error,
.page-loading {
  text-align: center;
}

.page-dashboard {
  max-width: 640px;
}

.page-public-directory {
  max-width: 960px;
}

.page-public-profile {
  max-width: 640px;
}

@media (min-width: 640px) {
  .page {
    padding-left: var(--space-6);
    padding-right: var(--space-6);
  }
}

@media (min-width: 960px) {
  .page-dashboard,
  .page-public-directory {
    max-width: 1100px;
  }
}
```

- [ ] **Step 2: Make the dashboard trip list a responsive grid**

Add a media query after the existing `.trip-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }` rule (update that rule's `gap` to `var(--space-3)` while you're there):

```css
.trip-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (min-width: 960px) {
  .trip-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-4);
  }

  .trip-card-editing {
    grid-column: 1 / -1;
  }
}
```

(`.trip-card-editing` spans the full grid row so the inline edit form doesn't get squeezed into one narrow grid cell — matches spec §3's requirement that the inline form "should span its own grid cell's full row width when active, not force the whole grid to single-column.")

- [ ] **Step 3: Make the public directory a responsive grid**

Replace the existing `.public-gallery-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }` rule with:

```css
.public-gallery-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-4);
}
```

- [ ] **Step 4: Verify the build succeeds and existing tests still pass**

Run: `npm run build && npm test`
Expected: build succeeds; all existing tests pass unchanged.

- [ ] **Step 5: Manual visual check at three breakpoints**

With the dev server running, use browser DevTools' device toolbar (or resize the window) to check at approximately 375px (mobile), 768px (tablet), and 1280px (desktop) widths:
- `/going` (PublicDirectory): at 1280px, entries should form a multi-column grid, not a single column.
- `/` while signed in (Dashboard): at 1280px with several trips, the trip list should form a multi-column grid; click Edit on one trip and confirm its inline form spans the full row width rather than being squeezed into one grid cell.
- `/` while signed out (Login) and `/going/rishi-mohnot` (PublicProfile): at all three widths, content should stay comfortably readable (not stretched edge-to-edge at 1280px, not cramped at 375px).

- [ ] **Step 6: Commit**

```bash
git add src/styles.css
git commit -m "Design system: breakpoints and responsive grid layouts"
```

---

### Task 5: Full visual verification pass

**Files:** none (verification only — no code changes expected; if this step finds a real problem, fix it in `src/styles.css` and note the fix in your report, don't silently skip it)

**Interfaces:** none.

- [ ] **Step 1: Run the full automated check**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass. (This should already be true from Task 4's step 4 — re-confirm nothing regressed.)

- [ ] **Step 2: Screenshot every page, at 3 breakpoints, in both color schemes**

Using the dev server and a browser (the `run` skill, or `claude-in-chrome` browser tools, or manual DevTools screenshots — whatever this environment has available), capture and visually inspect:

- Pages: Login (`/`, signed out), Dashboard (`/`, signed in, with at least one upcoming and one past trip so the collapse toggle is visible), PublicDirectory (`/going`), PublicProfile (`/going/rishi-mohnot`)
- Breakpoints: ~375px, ~768px, ~1280px
- Color scheme: light and dark (toggle via OS setting or DevTools' "Emulate CSS prefers-color-scheme" feature)

That's 4 pages × 3 breakpoints × 2 color schemes = 24 checks. This is tedious but is the only real test this plan has — a build that compiles and unit tests that pass do not tell you whether the design actually looks right.

- [ ] **Step 3: Check for the specific failure modes design systems commonly hit**

While reviewing the screenshots, specifically look for: text with insufficient contrast against its background in dark mode (beyond what Task 1's contrast check already covered — check it in context, not just in isolation), a card/shadow that looks wrong when nested inside another card (e.g. a `.trip-note` inside an expanded `.trip-card`), a grid column that's so narrow at 960-1100px that content wraps awkwardly (the `minmax(320px, 1fr))`/`minmax(240px, 1fr)` values from Task 4 are starting points, not guaranteed-correct — adjust them if a screenshot shows cramped or overly sparse columns), and any element that still shows the *old* flat/bare look (a sign that a class was missed in Tasks 1-4).

- [ ] **Step 4: Fix anything found, re-verify, and report**

If Step 3 finds a real issue, fix it directly in `src/styles.css`, re-run Step 1's build/test check, and re-screenshot the affected page/breakpoint/scheme to confirm the fix. In your task report, list exactly what you checked (which of the 24 combinations), what you found, and what (if anything) you changed.

- [ ] **Step 5: Commit (only if Step 4 made changes)**

```bash
git add src/styles.css
git commit -m "Design system: visual QA fixes"
```

If Step 4 found nothing to fix, skip this step — there's nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** §1 tokens → Task 1. §2 component patterns (card/surface, pill/badge, status colors, button variants, form focus states) → Tasks 2-3. §3 layout (breakpoints, grids) → Task 4. "Done When" (all 4 pages consistent, light+dark, uses desktop width) → Task 5 verifies this directly. Non-goals (no animations/icons/grain) are honored by omission throughout.
- **Type/name consistency:** every token name introduced in Task 1 (`--bg`, `--bg-subtle`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, `--accent-warm`, `--accent-gold`, `--error`, `--text-*`, `--space-*`, `--radius-*`, `--shadow*`) is used with that exact name in Tasks 2-4, never renamed. `.trip-status-{status}` class names match exactly what `TripCard.tsx` already generates via template literal (`` `trip-status-${trip.confirmation_status}` ``) against the 4 real `ConfirmationStatus` values (`planned`, `tentative`, `confirmed`, `booked`) from `src/lib/types.ts`.
- **No placeholders:** every step shows complete, real CSS — no "similar to Task N" references, no TBD values. The one deliberately-open judgment call (exact dark-mode token lightness) has a concrete verification method (Step 3 of Task 1) rather than being left vague.

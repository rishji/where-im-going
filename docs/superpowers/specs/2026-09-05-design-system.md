# Design System Pass — Design

**Status:** Approved 2026-09-05.

## Goal

Replace the app's ad-hoc, per-component CSS (arbitrary font sizes, arbitrary spacing, one flat
accent color, no dark mode, single-column layout everywhere) with a real design system: type
scale, spacing scale, an expanded warm color palette (light + dark), and consistent component
patterns — applied across all 4 pages (`Login`, `Dashboard`, `PublicDirectory`, `PublicProfile`).

## Direction

Keep the existing typography (Fraunces display / Inter body / JetBrains Mono for slugs) and
formalize it rather than replace it — it already reads as intentional, it was just never turned
into a system. Borrow the *warm, physical* feel of the sibling project `where-ive-been` (its
"Atlas design system"): a warm parchment/cream palette instead of the current cool near-white,
a richer multi-tone accent system instead of one flat blue, soft shadows and generous rounded
corners instead of flat bordered boxes. `where-ive-been` already shares the exact same three
fonts, so this is a light, deliberate family resemblance, not a clone — explicitly **excluding**
its paper-grain texture overlay, which stays a distinctive signature of that app alone.

## Non-goals

- No animations/transitions, no custom icons or illustrations.
- No new components or data — this is visual system + layout only, nothing about what the app
  does changes.
- No paper-grain texture (see Direction above).

## 1. Design tokens (`src/styles.css` `:root`)

**Color** — warm parchment family, light mode:

```css
--bg: #f7f0de;           /* was #fafaf8 */
--bg-subtle: #ede2c4;    /* new: for subtle section backgrounds */
--surface: #fffaec;      /* new: card/panel backgrounds, lighter than page bg */
--fg: #1c1a14;            /* was #1a1a1a — warm near-black */
--muted: #857a5c;         /* was #6b6b6b — warm muted tone */
--border: #d6c79e;        /* was #e2e2df — warm line color */
--accent: #1f4d3a;        /* was #2b6cb0 — deep green, primary actions/links, "booked" status */
--accent-warm: #c8431b;   /* new: rust — "confirmed" status */
--accent-gold: #d68a14;   /* new: gold — "tentative" status */
--error: #b91c1c;         /* unchanged */
--shadow: 0 1px 0 rgba(28,26,20,0.04), 0 18px 40px -22px rgba(28,26,20,0.22);
--shadow-lg: 0 2px 0 rgba(28,26,20,0.04), 0 28px 60px -28px rgba(28,26,20,0.28);
```

Dark mode (`@media (prefers-color-scheme: dark)`, scoped under `:root`): a parallel warm-dark
palette — deep warm charcoal background (not pure black), the same three accent hues lightened
for contrast against a dark ground, borders/shadows adjusted for a dark surface. Exact dark values
are an implementation-time judgment call (matching contrast ratios, not exact numbers specified
here) — implementer should verify contrast against WCAG AA for text against `--bg`/`--surface`.

**Type scale** (replacing today's scattered `0.75rem`/`0.8rem`/`0.85rem`/`0.9rem`/`1rem`):

```css
--text-xs: 0.75rem;
--text-sm: 0.85rem;
--text-base: 1rem;
--text-lg: 1.15rem;
--text-xl: 1.5rem;
--text-2xl: 2rem;
--text-display: 2.75rem;
```

**Spacing scale** (replacing ad-hoc `0.6rem`/`0.75rem`/`1.25rem` etc.):

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.5rem;
--space-6: 2rem;
--space-8: 4rem;
```

**Radius:**

```css
--radius-sm: 8px;   /* was inline 6px on inputs/badges */
--radius: 14px;      /* was inline 8px on trip-card */
--radius-lg: 22px;   /* new: larger surfaces */
```

Every existing class in `styles.css` that currently hardcodes a font-size, spacing, radius, or
color value should be migrated to reference these tokens instead — this is the actual "make it a
system" work, not just adding new tokens alongside the old hardcoded values.

## 2. Component patterns

Formalize the patterns that already exist inconsistently:

- **Pill/badge** (`.trip-status`, `.trip-role`, `.public-gallery-next-trip` today): one shared
  pattern — `var(--radius-lg)` full-pill radius, `var(--text-xs)` type, consistent padding from
  the spacing scale. `.trip-status` gets its color from the semantic status mapping below;
  `.trip-role` and similar informational pills use `--muted`/`--border` only (they're not status
  indicators).
- **Status color mapping** — `confirmation_status` gets a real semantic color instead of today's
  plain bordered text, one accent per state from most to least certain: `booked` → `--accent`
  (green), `confirmed` → `--accent-warm` (rust), `tentative` → `--accent-gold` (gold), `planned`
  → `--muted` (neutral). (`visibility: public` badge stays a neutral pill, it's not a status.)
- **Card/surface** (`.trip-card`, `.trip-form`, `.trip-note` today, all separately-defined flat
  bordered boxes): one shared surface pattern — `var(--surface)` background, `var(--shadow)`,
  `var(--radius)`, replacing the flat `1px solid var(--border)`-only look.
- **Button:** primary (filled `--accent`) vs. secondary (`.trip-form-cancel`,
  `.dashboard-header button` today — bordered/transparent) become one consistent two-variant
  system instead of each context redefining its own secondary-button look.
- **Form inputs:** consistent focus states (currently none defined at all — inputs have no
  `:focus` style) using `--accent` for the focus ring/border.

## 3. Layout

- **`PublicDirectory` (`/going`):** `.public-gallery-list` becomes a responsive CSS grid
  (`repeat(auto-fill, minmax(240px, 1fr))` or similar) of card-style entries instead of a
  single-column bordered-row list, using the new card/surface pattern from §2.
- **`Dashboard`:** trip lists (`.trip-list`) become a responsive grid on wide viewports
  (e.g. 2-3 columns above a breakpoint) instead of always one 640px-wide column. The edit-inline
  form (added in the last dashboard pass) should span its own grid cell's full row width when
  active, not force the whole grid to single-column.
- **`PublicProfile` / `Login`:** narrower content, so these stay closer to single-column, but
  replace the fixed `max-width: 480px` with a real breakpoint-based approach (e.g. comfortable
  reading width via `ch`-based max-width, centered, with proper padding at both mobile and desktop
  breakpoints — not just one hardcoded pixel value).
- Introduce real breakpoints (e.g. `640px`, `960px`) — today's CSS has zero media queries.

## Done When

All 4 pages read as one consistent, warm, physically-textured system (soft shadows, generous
radius, real type/spacing scale, semantic status colors) in both light and dark mode, with layouts
that use available width on desktop instead of one fixed narrow column everywhere. No animations,
icons, illustrations, or new components/data were added.

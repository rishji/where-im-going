// Phase 0 baseline import — Rishi-only pass, calendar source.
//
// Scope: this pass imports only from the Google Calendar (structured start/end
// dates, no parsing ambiguity). The Google Sheet pass (free-text dates, notes,
// color-coded confirmation status) is deliberately deferred — see PLAN.md and
// the memory note for why. Esha's account doesn't exist yet, so:
//   - "Esha in X" events are Esha-owned: skipped entirely, logged in the report.
//   - "Resha in X" and unprefixed events are Rishi-owned per the historical
//     convention (PLAN.md), with an intended Esha-companion link logged for a
//     follow-up pass once her account exists — no trip_participants row is
//     written now, since that would reference a user_id that doesn't exist.
//
// Safe by default: dry-run unless --apply is passed. Idempotent: re-running
// (dry-run or apply) matches existing trips on (user_id, date_from, date_to,
// location_name) and skips ones already imported.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const CALENDAR_ID = "4deo1qgfi64ps3d4v381gdvd2g@group.calendar.google.com";
const TIME_MIN = "2025-01-01T00:00:00Z";
const RISHI_SLUG = "rishi-mohnot";
const APPLY = process.argv.includes("--apply");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "Add SUPABASE_SERVICE_ROLE_KEY (Supabase Dashboard -> Project Settings -> API -> service_role secret)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface CalendarEvent {
  id: string;
  summary: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

interface ParsedTrip {
  eventId: string;
  rawSummary: string;
  dateFrom: string;
  dateTo: string;
  locationName: string;
  companionIntended: boolean;
  flags: string[];
}

function fetchCalendarPage(pageToken?: string): { items: CalendarEvent[]; nextPageToken?: string } {
  const params: Record<string, unknown> = {
    calendarId: CALENDAR_ID,
    timeMin: TIME_MIN,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250
  };
  if (pageToken) params.pageToken = pageToken;

  const out = execFileSync("gws", ["calendar", "events", "list", "--params", JSON.stringify(params), "--format", "json"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  const data = JSON.parse(out);
  return { items: data.items ?? [], nextPageToken: data.nextPageToken };
}

function fetchAllCalendarEvents(): CalendarEvent[] {
  const all: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const page = fetchCalendarPage(pageToken);
    all.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return all;
}

// Google all-day event `end.date` is exclusive (the day after the trip's last
// day) — verified empirically against this calendar: sequential trips'
// end.date consistently equals the next trip's start.date.
function exclusiveEndToInclusive(endDate: string): string {
  const d = new Date(`${endDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function classify(summary: string): { owner: "rishi" | "esha"; companionIntended: boolean; location: string } {
  const trimmed = summary.trim();
  const m = trimmed.match(/^(Rishi|Esha|Resha)\b\s*(.*)$/i);
  if (!m) {
    // No name prefix: historical convention (PLAN.md) is Rishi-owned with Esha as companion.
    return { owner: "rishi", companionIntended: true, location: trimmed };
  }
  const [, name, restRaw] = m;
  let rest = restRaw
    .replace(/^'s\s+/i, "")
    .replace(/^(?:in|at|on)\s+/i, "")
    .replace(/^:\s*/, "")
    .trim();
  if (!rest) rest = trimmed;

  const lname = name.toLowerCase();
  if (lname === "esha") return { owner: "esha", companionIntended: false, location: rest };
  if (lname === "resha") return { owner: "rishi", companionIntended: true, location: rest };
  return { owner: "rishi", companionIntended: false, location: rest };
}

function parseEvents(events: CalendarEvent[]): { trips: ParsedTrip[]; skippedEsha: { summary: string; dateFrom: string }[] } {
  const trips: ParsedTrip[] = [];
  const skippedEsha: { summary: string; dateFrom: string }[] = [];

  for (const event of events) {
    if (!event.start.date || !event.end.date) continue; // skip timed (non-all-day) events, e.g. reminders

    const { owner, companionIntended, location } = classify(event.summary ?? "");
    const dateFrom = event.start.date;
    let dateTo = exclusiveEndToInclusive(event.end.date);

    const flags: string[] = [];
    if (dateTo < dateFrom) {
      flags.push("zero-length or malformed date range; clamped date_to to date_from");
      dateTo = dateFrom;
    }
    if (location.length > 60) {
      flags.push("unusually long location name; review before publishing");
    }

    if (owner === "esha") {
      skippedEsha.push({ summary: event.summary, dateFrom });
      continue;
    }

    trips.push({
      eventId: event.id,
      rawSummary: event.summary,
      dateFrom,
      dateTo,
      locationName: location,
      companionIntended,
      flags
    });
  }

  return { trips, skippedEsha };
}

async function getRishiUserId(): Promise<string> {
  const { data, error } = await supabase.from("user_profiles").select("user_id").eq("public_slug", RISHI_SLUG).single();
  if (error || !data) {
    throw new Error(`Could not find user_profiles row for public_slug="${RISHI_SLUG}": ${error?.message ?? "not found"}`);
  }
  return data.user_id;
}

async function getExistingTripKeys(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("trips").select("date_from,date_to,location_name").eq("user_id", userId);
  if (error) throw new Error(`Failed to fetch existing trips: ${error.message}`);
  return new Set((data ?? []).map((t) => `${t.date_from}|${t.date_to}|${t.location_name}`));
}

async function main() {
  console.log(APPLY ? "Running in APPLY mode — will write to Supabase." : "Running in DRY-RUN mode (default). Pass --apply to write.");

  const rishiUserId = await getRishiUserId();
  console.log(`Rishi user_id: ${rishiUserId}`);

  console.log("Fetching calendar events...");
  const events = fetchAllCalendarEvents();
  console.log(`Fetched ${events.length} events (all-day + timed).`);

  const { trips, skippedEsha } = parseEvents(events);
  console.log(`Parsed ${trips.length} Rishi-owned candidate trips; ${skippedEsha.length} Esha-owned events skipped.`);

  const existingKeys = await getExistingTripKeys(rishiUserId);

  const toCreate: ParsedTrip[] = [];
  const alreadyExists: ParsedTrip[] = [];
  for (const trip of trips) {
    const key = `${trip.dateFrom}|${trip.dateTo}|${trip.locationName}`;
    if (existingKeys.has(key)) {
      alreadyExists.push(trip);
    } else {
      toCreate.push(trip);
    }
  }

  const created: { id: string; dateFrom: string; dateTo: string; locationName: string }[] = [];
  const errors: { trip: ParsedTrip; error: string }[] = [];

  if (APPLY) {
    for (const trip of toCreate) {
      const { data, error } = await supabase
        .from("trips")
        .insert({
          user_id: rishiUserId,
          date_from: trip.dateFrom,
          date_to: trip.dateTo,
          location_name: trip.locationName,
          confirmation_status: "booked",
          source: "google_calendar",
          visibility: "private"
        })
        .select("id")
        .single();

      if (error) {
        errors.push({ trip, error: error.message });
      } else {
        created.push({ id: data.id, dateFrom: trip.dateFrom, dateTo: trip.dateTo, locationName: trip.locationName });
      }
    }
  }

  const companionIntendedPending = trips.filter((t) => t.companionIntended);
  const flagged = trips.filter((t) => t.flags.length > 0);

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    ranAt: new Date().toISOString(),
    rishiUserId,
    counts: {
      totalCalendarEvents: events.length,
      parsedRishiTrips: trips.length,
      skippedEshaOwned: skippedEsha.length,
      alreadyExisting: alreadyExists.length,
      toCreate: toCreate.length,
      created: created.length,
      errors: errors.length,
      companionIntendedPending: companionIntendedPending.length,
      flaggedForReview: flagged.length
    },
    toCreate: APPLY ? undefined : toCreate,
    created: APPLY ? created : undefined,
    errors,
    alreadyExisting: alreadyExists.map((t) => ({ dateFrom: t.dateFrom, dateTo: t.dateTo, locationName: t.locationName })),
    skippedEshaOwned: skippedEsha,
    companionIntendedPending: companionIntendedPending.map((t) => ({
      dateFrom: t.dateFrom,
      dateTo: t.dateTo,
      locationName: t.locationName,
      rawSummary: t.rawSummary
    })),
    flaggedForReview: flagged.map((t) => ({
      dateFrom: t.dateFrom,
      dateTo: t.dateTo,
      locationName: t.locationName,
      rawSummary: t.rawSummary,
      flags: t.flags
    }))
  };

  writeFileSync("import-report.json", JSON.stringify(report, null, 2));

  console.log("\n=== Summary ===");
  console.log(JSON.stringify(report.counts, null, 2));
  console.log("\nFull report written to import-report.json");
  if (!APPLY) {
    console.log("\nThis was a dry run — nothing was written. Review import-report.json, then re-run with --apply.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

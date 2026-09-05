import { randomUUID } from "node:crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchPublicGallery, fetchPublicTrips } from "./publicPages";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (set them in .env.local locally, or as
// repo vars/secrets in CI). Skipped gracefully — rather than crashing the whole suite's collection
// — when they're absent, e.g. a contributor without a service-role key or a PR from a fork.
describe.skipIf(!SUPABASE_URL || !SERVICE_ROLE_KEY)("publicPages (live Supabase)", () => {
  let serviceClient: SupabaseClient;

  const suffix = randomUUID().slice(0, 8);
  const ownerSlug = `test-owner-${suffix}`;

  let ownerId = "";
  let companionId = "";
  let publicOwnedTripId = "";
  let privateOwnedTripId = "";
  let companionPublicTripId = "";
  let companionPrivateTripId = "";

  beforeAll(async () => {
    serviceClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

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
});

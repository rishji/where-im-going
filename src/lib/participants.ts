import { supabaseClient } from "./supabase";
import type { TripPerson, Visibility } from "./types";

export async function listTripPeople(tripId: string): Promise<TripPerson[]> {
  if (!supabaseClient) {
    return [];
  }

  const { data, error } = await supabaseClient.rpc("list_trip_people", {
    p_trip_id: tripId
  });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function addCompanion(
  tripId: string,
  currentUserId: string,
  emailOrSlug: string
): Promise<void> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  const { data: matches, error: lookupError } = await supabaseClient.rpc("find_user_by_contact", {
    email_or_slug: emailOrSlug.trim().toLowerCase()
  });

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const match = matches?.[0];
  if (!match) {
    throw new Error("No account found with that email or public URL.");
  }

  if (match.user_id === currentUserId) {
    throw new Error("You can't add yourself as a companion on your own trip.");
  }

  const { error: insertError } = await supabaseClient
    .from("trip_participants")
    .insert({ trip_id: tripId, user_id: match.user_id });

  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error(`${match.display_name} is already a companion on this trip.`);
    }
    throw new Error(insertError.message);
  }
}

export async function removeCompanion(tripId: string, userId: string): Promise<void> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabaseClient
    .from("trip_participants")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateOwnParticipantVisibility(
  tripId: string,
  userId: string,
  visibility: Visibility
): Promise<void> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabaseClient
    .from("trip_participants")
    .update({ visibility })
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

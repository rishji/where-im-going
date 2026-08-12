import { supabaseClient } from "./supabase";
import type { ConfirmationStatus, Trip, Visibility } from "./types";

export interface TripInput {
  date_from: string;
  date_to: string;
  location_name: string;
  location_label?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  event_name?: string | null;
  flights?: string | null;
  confirmation_status: ConfirmationStatus;
  visibility: Visibility;
}

export function isValidTripInput(input: TripInput): string | null {
  if (!input.location_name.trim()) {
    return "Location is required.";
  }
  if (!input.date_from || !input.date_to) {
    return "Both dates are required.";
  }
  if (input.date_to < input.date_from) {
    return "End date can't be before the start date.";
  }
  return null;
}

export async function fetchTrips(): Promise<Trip[]> {
  if (!supabaseClient) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("trips")
    .select("*")
    .order("date_from", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createTrip(userId: string, input: TripInput): Promise<Trip> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  const validationError = isValidTripInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const { data, error } = await supabaseClient
    .from("trips")
    .insert({ user_id: userId, ...input })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateTrip(tripId: string, input: TripInput): Promise<Trip> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  const validationError = isValidTripInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const { data, error } = await supabaseClient
    .from("trips")
    .update(input)
    .eq("id", tripId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteTrip(tripId: string): Promise<void> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabaseClient.from("trips").delete().eq("id", tripId);

  if (error) {
    throw new Error(error.message);
  }
}

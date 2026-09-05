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

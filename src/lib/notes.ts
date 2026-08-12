import { supabaseClient } from "./supabase";
import type { TripNote } from "./types";

export async function fetchNotes(tripId: string): Promise<TripNote[]> {
  if (!supabaseClient) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("trip_notes")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function addNote(tripId: string, authorUserId: string, body: string): Promise<TripNote> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  if (!body.trim()) {
    throw new Error("Note can't be empty.");
  }

  const { data, error } = await supabaseClient
    .from("trip_notes")
    .insert({ trip_id: tripId, author_user_id: authorUserId, body: body.trim() })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateNote(noteId: string, body: string): Promise<TripNote> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  if (!body.trim()) {
    throw new Error("Note can't be empty.");
  }

  const { data, error } = await supabaseClient
    .from("trip_notes")
    .update({ body: body.trim() })
    .eq("id", noteId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteNote(noteId: string): Promise<void> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabaseClient.from("trip_notes").delete().eq("id", noteId);

  if (error) {
    throw new Error(error.message);
  }
}

import { supabaseClient } from "./supabase";
import type { UserProfile } from "./types";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchOwnProfile(userId: string): Promise<UserProfile | null> {
  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createProfile(
  userId: string,
  displayName: string,
  publicSlug: string
): Promise<UserProfile> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  if (!isValidSlug(publicSlug)) {
    throw new Error("Slug must be 3-50 lowercase letters, numbers, or hyphens.");
  }

  const { data, error } = await supabaseClient
    .from("user_profiles")
    .insert({ user_id: userId, display_name: displayName.trim(), public_slug: publicSlug })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, "display_name" | "public_slug" | "public_page_enabled">>
): Promise<UserProfile> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabaseClient
    .from("user_profiles")
    .update(updates)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

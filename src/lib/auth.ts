import { supabaseClient } from "./supabase";

export async function sendMagicLink(email: string): Promise<void> {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured.");
  }

  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true
    }
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOut(): Promise<void> {
  if (!supabaseClient) {
    return;
  }

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

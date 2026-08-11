import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

const env = import.meta.env as ImportMetaEnv & SupabaseEnv;

export const isSupabaseConfigured =
  Boolean(env.VITE_SUPABASE_URL?.trim()) && Boolean(env.VITE_SUPABASE_ANON_KEY?.trim());

export const supabaseClient: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.VITE_SUPABASE_URL!.trim(), env.VITE_SUPABASE_ANON_KEY!.trim(), {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

export type { Session };

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "./supabase";

export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabaseClient));

  useEffect(() => {
    if (!supabaseClient) {
      setLoading(false);
      setSession(null);
      return;
    }

    let isMounted = true;

    void supabaseClient.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

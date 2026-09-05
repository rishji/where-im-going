import { useEffect, useState } from "react";
import { useSupabaseSession } from "../lib/useSupabaseSession";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchOwnProfile } from "../lib/userProfile";
import type { UserProfile } from "../lib/types";
import { Login } from "./Login";
import { Dashboard } from "./Dashboard";
import { ProfileOnboarding } from "../components/ProfileOnboarding";

export function AuthedApp() {
  const { session, loading: sessionLoading } = useSupabaseSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let isMounted = true;
    setProfileLoading(true);

    void fetchOwnProfile(session.user.id)
      .then((result) => {
        if (isMounted) {
          setProfile(result);
        }
      })
      .finally(() => {
        if (isMounted) {
          setProfileLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  if (!isSupabaseConfigured) {
    return (
      <div className="page page-config-error">
        <h1>Supabase is not configured</h1>
        <p>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{" "}
          <code>.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  if (sessionLoading || (session && profileLoading)) {
    return (
      <div className="page page-loading">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (!profile) {
    return <ProfileOnboarding userId={session.user.id} onCreated={setProfile} />;
  }

  return <Dashboard profile={profile} onProfileChange={setProfile} />;
}

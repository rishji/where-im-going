import { signOut } from "../lib/auth";
import { updateProfile } from "../lib/userProfile";
import type { UserProfile } from "../lib/types";

export function Dashboard({
  profile,
  onProfileChange
}: {
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
}) {
  async function togglePublicPage() {
    const updated = await updateProfile(profile.user_id, {
      public_page_enabled: !profile.public_page_enabled
    });
    onProfileChange(updated);
  }

  return (
    <div className="page page-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Hey, {profile.display_name}</h1>
          {profile.public_slug && <p className="dashboard-slug">/going/{profile.public_slug}</p>}
        </div>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <section className="dashboard-section">
        <label className="visibility-toggle">
          <input
            type="checkbox"
            checked={profile.public_page_enabled}
            onChange={() => void togglePublicPage()}
          />
          Publish my public page
        </label>
      </section>

      <section className="dashboard-section">
        <p className="dashboard-placeholder">
          Trip list, add/edit form, companions, and notes land next (Phase 1).
        </p>
      </section>
    </div>
  );
}

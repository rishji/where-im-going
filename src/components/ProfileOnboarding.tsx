import { FormEvent, useState } from "react";
import { createProfile, isValidSlug, slugify } from "../lib/userProfile";
import type { UserProfile } from "../lib/types";

export function ProfileOnboarding({
  userId,
  onCreated
}: {
  userId: string;
  onCreated: (profile: UserProfile) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleDisplayNameChange(value: string) {
    setDisplayName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isValidSlug(slug)) {
      setError("Slug must be 3-50 lowercase letters, numbers, or hyphens.");
      return;
    }

    setSubmitting(true);
    try {
      const profile = await createProfile(userId, displayName, slug);
      onCreated(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="profile-onboarding" onSubmit={handleSubmit}>
      <h2>Set up your profile</h2>
      <label htmlFor="display-name">Display name</label>
      <input
        id="display-name"
        required
        value={displayName}
        onChange={(event) => handleDisplayNameChange(event.target.value)}
        placeholder="Rishi"
      />
      <label htmlFor="public-slug">Public page URL</label>
      <div className="slug-input">
        <span>/going/</span>
        <input
          id="public-slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugify(event.target.value));
          }}
          placeholder="rishi"
        />
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Continue"}
      </button>
      {error && <p className="auth-panel-error">{error}</p>}
    </form>
  );
}

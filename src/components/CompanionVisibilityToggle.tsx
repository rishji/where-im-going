import { useState } from "react";
import { updateOwnParticipantVisibility } from "../lib/participants";
import type { Visibility } from "../lib/types";

export function CompanionVisibilityToggle({
  tripId,
  currentUserId,
  visibility,
  onChange
}: {
  tripId: string;
  currentUserId: string;
  visibility: Visibility;
  onChange: (visibility: Visibility) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const next: Visibility = visibility === "public" ? "private" : "public";
    setError(null);
    setSaving(true);
    try {
      await updateOwnParticipantVisibility(tripId, currentUserId, next);
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="companion-visibility-toggle">
      <label className="visibility-toggle">
        <input type="checkbox" checked={visibility === "public"} disabled={saving} onChange={() => void handleToggle()} />
        Show this trip on my public page
      </label>
      {error && <p className="auth-panel-error">{error}</p>}
    </div>
  );
}

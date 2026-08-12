import { FormEvent, useState } from "react";
import { addCompanion, removeCompanion } from "../lib/participants";
import type { TripPerson } from "../lib/types";

export function CompanionPicker({
  tripId,
  currentUserId,
  companions,
  onChange
}: {
  tripId: string;
  currentUserId: string;
  companions: TripPerson[];
  onChange: () => void;
}) {
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await addCompanion(tripId, currentUserId, contact);
      setContact("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(userId: string) {
    setError(null);
    try {
      await removeCompanion(tripId, userId);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="companion-picker">
      <h4>Companions</h4>
      {companions.length === 0 && <p className="dashboard-placeholder">No companions yet.</p>}
      <ul className="companion-list">
        {companions.map((person) => (
          <li key={person.user_id}>
            <span>{person.display_name}</span>
            <button type="button" className="link-button" onClick={() => void handleRemove(person.user_id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form className="companion-add-form" onSubmit={handleAdd}>
        <input
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="Email or public URL"
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p className="auth-panel-error">{error}</p>}
    </div>
  );
}

import { useState } from "react";
import { listTripPeople } from "../lib/participants";
import { fetchNotes } from "../lib/notes";
import type { TripInput } from "../lib/trips";
import type { Trip, TripNote, TripPerson } from "../lib/types";
import { CompanionPicker } from "./CompanionPicker";
import { CompanionVisibilityToggle } from "./CompanionVisibilityToggle";
import { NotesPanel } from "./NotesPanel";
import { TripForm } from "./TripForm";

function formatDateRange(dateFrom: string, dateTo: string): string {
  return dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`;
}

export function TripCard({
  trip,
  currentUserId,
  isEditing,
  onEdit,
  onDelete,
  onFormSubmit,
  onFormCancel
}: {
  trip: Trip;
  currentUserId: string;
  isEditing: boolean;
  onEdit: (trip: Trip) => void;
  onDelete: (tripId: string) => Promise<void>;
  onFormSubmit: (input: TripInput) => Promise<void>;
  onFormCancel: () => void;
}) {
  const isOwner = trip.user_id === currentUserId;
  const [expanded, setExpanded] = useState(false);
  const [people, setPeople] = useState<TripPerson[] | null>(null);
  const [notes, setNotes] = useState<TripNote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isEditing) {
    return (
      <li className="trip-card trip-card-editing">
        <TripForm trip={trip} onSubmit={onFormSubmit} onCancel={onFormCancel} />
      </li>
    );
  }

  async function loadDetails() {
    setLoading(true);
    setError(null);
    try {
      const [peopleResult, notesResult] = await Promise.all([
        listTripPeople(trip.id),
        fetchNotes(trip.id)
      ]);
      setPeople(peopleResult);
      setNotes(notesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleToggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && people === null) {
      void loadDetails();
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await onDelete(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const ownParticipant = people?.find((person) => person.user_id === currentUserId && person.role === "companion");
  const owner = people?.find((person) => person.role === "owner");
  const nameByUserId = new Map((people ?? []).map((person) => [person.user_id, person.display_name]));

  return (
    <li className="trip-card">
      <button type="button" className="trip-card-summary" onClick={handleToggleExpand}>
        <div>
          <strong>{trip.location_name}</strong>
          {trip.event_name && <span className="trip-card-event"> — {trip.event_name}</span>}
        </div>
        <div className="trip-card-meta">
          <span>{formatDateRange(trip.date_from, trip.date_to)}</span>
          <span className={`trip-status trip-status-${trip.confirmation_status}`}>{trip.confirmation_status}</span>
          {!isOwner && <span className="trip-role">{owner ? `${owner.display_name}'s trip` : "companion"}</span>}
          {isOwner && trip.visibility === "public" && <span className="trip-role">public</span>}
        </div>
      </button>

      {isOwner && (
        <div className="trip-card-actions">
          {confirmingDelete ? (
            <>
              <span>Really delete?</span>
              <button type="button" className="link-button" onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button type="button" className="link-button" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="link-button" onClick={() => onEdit(trip)}>
                Edit
              </button>
              <button type="button" className="link-button" onClick={() => void handleDelete()}>
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {expanded && (
        <div className="trip-card-details">
          {loading && <p className="dashboard-placeholder">Loading…</p>}
          {error && <p className="auth-panel-error">{error}</p>}
          {!loading && people && (
            <>
              {isOwner && (
                <CompanionPicker
                  tripId={trip.id}
                  currentUserId={currentUserId}
                  companions={people.filter((person) => person.role === "companion")}
                  onChange={() => void loadDetails()}
                />
              )}
              {!isOwner && ownParticipant && (
                <CompanionVisibilityToggle
                  tripId={trip.id}
                  currentUserId={currentUserId}
                  visibility={ownParticipant.visibility}
                  onChange={() => void loadDetails()}
                />
              )}
            </>
          )}
          {!loading && notes && (
            <NotesPanel
              tripId={trip.id}
              currentUserId={currentUserId}
              notes={notes}
              authorNames={nameByUserId}
              onChange={() => void loadDetails()}
            />
          )}
        </div>
      )}
    </li>
  );
}

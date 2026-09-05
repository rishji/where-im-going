import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "../lib/auth";
import { updateProfile } from "../lib/userProfile";
import { createTrip, deleteTrip, fetchTrips, updateTrip, type TripInput } from "../lib/trips";
import type { Trip, UserProfile } from "../lib/types";
import { TripCard } from "../components/TripCard";
import { TripForm } from "../components/TripForm";

export function Dashboard({
  profile,
  onProfileChange
}: {
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
}) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  useEffect(() => {
    void loadTrips();
  }, []);

  async function loadTrips() {
    setTripsLoading(true);
    setTripsError(null);
    try {
      setTrips(await fetchTrips());
    } catch (err) {
      setTripsError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setTripsLoading(false);
    }
  }

  async function togglePublicPage() {
    const updated = await updateProfile(profile.user_id, {
      public_page_enabled: !profile.public_page_enabled
    });
    onProfileChange(updated);
  }

  function startCreate() {
    setEditingTrip(null);
    setFormMode("create");
  }

  function startEdit(trip: Trip) {
    setEditingTrip(trip);
    setFormMode("edit");
  }

  function cancelForm() {
    setFormMode("none");
    setEditingTrip(null);
  }

  async function handleFormSubmit(input: TripInput) {
    if (formMode === "edit" && editingTrip) {
      await updateTrip(editingTrip.id, input);
    } else {
      await createTrip(profile.user_id, input);
    }
    cancelForm();
    await loadTrips();
  }

  async function handleDelete(tripId: string) {
    setTripsError(null);
    try {
      await deleteTrip(tripId);
      await loadTrips();
    } catch (err) {
      setTripsError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const ownedTrips = trips.filter((trip) => trip.user_id === profile.user_id);
  const companionTrips = trips.filter((trip) => trip.user_id !== profile.user_id);

  return (
    <div className="page page-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Hey, {profile.display_name}</h1>
          {profile.public_slug && (
            <Link className="dashboard-slug" to={`/going/${profile.public_slug}`}>
              /going/{profile.public_slug}
            </Link>
          )}
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
        <div className="dashboard-section-header">
          <h2>Your trips</h2>
          {formMode === "none" && (
            <button type="button" onClick={startCreate}>
              Add trip
            </button>
          )}
        </div>

        {formMode !== "none" && (
          <TripForm trip={editingTrip} onSubmit={handleFormSubmit} onCancel={cancelForm} />
        )}

        {tripsLoading && <p className="dashboard-placeholder">Loading…</p>}
        {tripsError && <p className="auth-panel-error">{tripsError}</p>}

        {!tripsLoading && !tripsError && ownedTrips.length === 0 && companionTrips.length === 0 && (
          <p className="dashboard-placeholder">No trips yet.</p>
        )}

        {ownedTrips.length > 0 && (
          <ul className="trip-list">
            {ownedTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} currentUserId={profile.user_id} onEdit={startEdit} onDelete={handleDelete} />
            ))}
          </ul>
        )}

        {companionTrips.length > 0 && (
          <>
            <h3 className="dashboard-subsection">Trips you're joining</h3>
            <ul className="trip-list">
              {companionTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} currentUserId={profile.user_id} onEdit={startEdit} onDelete={handleDelete} />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

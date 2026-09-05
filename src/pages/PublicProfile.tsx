import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicTrips } from "../lib/publicPages";
import type { PublicTrip } from "../lib/types";

function formatDateRange(dateFrom: string, dateTo: string): string {
  return dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`;
}

export function PublicProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [trips, setTrips] = useState<PublicTrip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }
    setTrips(null);
    setError(null);
    void (async () => {
      try {
        setTrips(await fetchPublicTrips(slug));
      } catch {
        setError("Something went wrong. Try again later.");
      }
    })();
  }, [slug]);

  return (
    <div className="page page-public-profile">
      {error && <p className="auth-panel-error">{error}</p>}
      {!error && trips === null && <p className="dashboard-placeholder">Loading…</p>}
      {!error && trips !== null && trips.length === 0 && (
        <p className="dashboard-placeholder">This page isn't available.</p>
      )}
      {trips !== null && trips.length > 0 && (
        <ul className="trip-list">
          {trips.map((trip) => (
            <li key={trip.trip_id} className="trip-card">
              <div>
                <strong>{trip.location_name}</strong>
                {trip.event_name && <span className="trip-card-event"> — {trip.event_name}</span>}
              </div>
              <div className="trip-card-meta">
                <span>{formatDateRange(trip.date_from, trip.date_to)}</span>
              </div>
              {trip.notes.length > 0 && (
                <ul className="trip-note-list">
                  {trip.notes.map((note) => (
                    <li key={note.id} className="trip-note">
                      <p>{note.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

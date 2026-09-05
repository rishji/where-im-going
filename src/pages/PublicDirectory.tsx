import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicGallery } from "../lib/publicPages";
import type { PublicGalleryEntry } from "../lib/types";

export function PublicDirectory() {
  const [entries, setEntries] = useState<PublicGalleryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setEntries(await fetchPublicGallery());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();
  }, []);

  return (
    <div className="page page-public-directory">
      <h1>Where people are going</h1>
      {error && <p className="auth-panel-error">{error}</p>}
      {!error && entries === null && <p className="dashboard-placeholder">Loading…</p>}
      {!error && entries !== null && entries.length === 0 && (
        <p className="dashboard-placeholder">No one has published a public page yet.</p>
      )}
      {entries !== null && entries.length > 0 && (
        <ul className="public-gallery-list">
          {entries.map((entry) => (
            <li key={entry.public_slug} className="public-gallery-entry">
              <Link to={`/going/${entry.public_slug}`}>{entry.display_name}</Link>
              {entry.current_location && <p>{entry.current_location}</p>}
              {entry.next_trip_date && (
                <p className="public-gallery-next-trip">Next trip: {entry.next_trip_date}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

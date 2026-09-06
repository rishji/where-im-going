import { FormEvent, useState } from "react";
import { isValidTripInput, type TripInput } from "../lib/trips";
import type { ConfirmationStatus, Trip, Visibility } from "../lib/types";

const CONFIRMATION_OPTIONS: ConfirmationStatus[] = ["tentative", "planned", "confirmed", "booked"];

function toInput(trip: Trip | null): TripInput {
  return {
    date_from: trip?.date_from ?? "",
    date_to: trip?.date_to ?? "",
    location_name: trip?.location_name ?? "",
    event_name: trip?.event_name ?? "",
    flights: trip?.flights ?? "",
    confirmation_status: trip?.confirmation_status ?? "tentative",
    visibility: trip?.visibility ?? "public"
  };
}

export function TripForm({
  trip,
  onSubmit,
  onCancel
}: {
  trip: Trip | null;
  onSubmit: (input: TripInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<TripInput>(() => toInput(trip));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof TripInput>(key: K, value: TripInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const validationError = isValidTripInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <label htmlFor="location-name">Where</label>
      <input
        id="location-name"
        required
        value={input.location_name}
        onChange={(event) => update("location_name", event.target.value)}
        placeholder="Tokyo, Japan"
      />

      <div className="trip-form-row">
        <div>
          <label htmlFor="date-from">From</label>
          <input
            id="date-from"
            type="date"
            required
            value={input.date_from}
            onChange={(event) => update("date_from", event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="date-to">To</label>
          <input
            id="date-to"
            type="date"
            required
            value={input.date_to}
            onChange={(event) => update("date_to", event.target.value)}
          />
        </div>
      </div>

      <label htmlFor="event-name">Event (optional)</label>
      <input
        id="event-name"
        value={input.event_name ?? ""}
        onChange={(event) => update("event_name", event.target.value)}
        placeholder="Sheel's wedding"
      />

      <label htmlFor="flights">Flights (optional)</label>
      <input
        id="flights"
        value={input.flights ?? ""}
        onChange={(event) => update("flights", event.target.value)}
        placeholder="UA123 SFO->NRT"
      />

      <label htmlFor="confirmation-status">Status</label>
      <select
        id="confirmation-status"
        value={input.confirmation_status}
        onChange={(event) => update("confirmation_status", event.target.value as ConfirmationStatus)}
      >
        {CONFIRMATION_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <label className="visibility-toggle">
        <input
          type="checkbox"
          checked={input.visibility === "public"}
          onChange={(event) => update("visibility", (event.target.checked ? "public" : "private") as Visibility)}
        />
        Show on my public page
      </label>

      <div className="trip-form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : trip ? "Save changes" : "Add trip"}
        </button>
        <button type="button" className="trip-form-cancel" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
      {error && <p className="auth-panel-error">{error}</p>}
    </form>
  );
}

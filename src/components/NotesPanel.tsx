import { FormEvent, useState } from "react";
import { addNote, deleteNote, updateNote } from "../lib/notes";
import type { TripNote } from "../lib/types";

function NoteRow({
  note,
  isAuthor,
  authorName,
  onChange
}: {
  note: TripNote;
  isAuthor: boolean;
  authorName: string;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await updateNote(note.id, body);
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteNote(note.id);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (editing) {
    return (
      <li className="trip-note trip-note-editing">
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={2} />
        <div className="trip-note-actions">
          <button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="link-button" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </button>
        </div>
        {error && <p className="auth-panel-error">{error}</p>}
      </li>
    );
  }

  return (
    <li className="trip-note">
      <p className="trip-note-author">{isAuthor ? "You" : authorName}</p>
      <p>{note.body}</p>
      {isAuthor && (
        <div className="trip-note-actions">
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className="link-button" onClick={() => void handleDelete()}>
            Delete
          </button>
        </div>
      )}
      {error && <p className="auth-panel-error">{error}</p>}
    </li>
  );
}

export function NotesPanel({
  tripId,
  currentUserId,
  notes,
  authorNames,
  onChange
}: {
  tripId: string;
  currentUserId: string;
  notes: TripNote[];
  authorNames: Map<string, string>;
  onChange: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await addNote(tripId, currentUserId, draft);
      setDraft("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="notes-panel">
      <h4>Notes</h4>
      <ul className="trip-note-list">
        {notes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            isAuthor={note.author_user_id === currentUserId}
            authorName={authorNames.get(note.author_user_id) ?? "A companion"}
            onChange={onChange}
          />
        ))}
      </ul>
      <form className="note-form" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a note…"
          rows={2}
        />
        <p className="note-public-warning">
          Notes are public whenever this trip is — don't include private logistics here.
        </p>
        <button type="submit" disabled={submitting}>
          {submitting ? "Posting…" : "Add note"}
        </button>
      </form>
      {error && <p className="auth-panel-error">{error}</p>}
    </div>
  );
}

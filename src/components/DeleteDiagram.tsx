import { useEffect, useState } from "react";

import { engine, EngineFailure, type DocumentRef } from "../lib/engine";

// Deleting a diagram, after seeing what goes with it.
//
// What goes is the diagram itself — its boxes, its lines, where they were put — and the picture
// line that shows it in each page that does. A page's own writing is not touched. Which pages
// those are is asked for before anything is deleted, and said here, because a page that shows a
// diagram would otherwise be changed behind the back of the person reading it.

export function DeleteDiagram({
  id,
  title,
  onDeleted,
  onCancel,
}: {
  id: string;
  title: string;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [shown, setShown] = useState<DocumentRef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    engine.diagram
      .deletePlan(id)
      .then((pages) => live && setShown(pages))
      .catch((thrown: unknown) => {
        if (live) setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
    return () => {
      live = false;
    };
  }, [id]);

  async function remove() {
    setBusy(true);
    try {
      await engine.diagram.delete(id);
      onDeleted();
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      setBusy(false);
    }
  }

  return (
    <div className="delete-confirm delete-diagram">
      <h2>Delete “{title}”?</h2>
      {error && <p className="error">{error}</p>}
      {shown === null ? (
        !error && <p className="quiet">Looking at what shows it…</p>
      ) : shown.length === 0 ? (
        <p>No page shows it. Its boxes and lines are deleted; nothing you wrote is touched.</p>
      ) : (
        <>
          <p>
            {shown.length === 1 ? "This page shows" : "These pages show"} it. The picture is taken
            out of {shown.length === 1 ? "it" : "them"}; the rest of what you wrote stays exactly as
            it is.
          </p>
          <ul>
            {shown.map((p) => (
              <li key={p.id}>{p.title}</li>
            ))}
          </ul>
        </>
      )}
      <p className="actions">
        <button className="danger" disabled={busy || shown === null} onClick={() => void remove()}>
          Delete
        </button>
        <button className="secondary" onClick={onCancel}>
          Keep it
        </button>
      </p>
    </div>
  );
}

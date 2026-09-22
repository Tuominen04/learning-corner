import { useCallback, useEffect, useState } from "react";

import {
  engine,
  EngineFailure,
  type DocumentRef,
  type Field,
  type Source,
  type SourceType,
} from "../lib/engine";
import { contributorName, missingLabel, SOURCE_TYPES } from "../lib/sources";
import { SourceForm } from "./SourceForm";

// Everything the library has been built on, in one place.
//
// The list is deliberately **not** APA-formatted. Formatting lives in the engine and is
// computed against the whole library at once, so drawing a formatted line per row would mean
// one call per source and the disambiguation pass repeated for every one of them. APA appears
// where it is read: in the text as you write, and in each document's reference list.

type Pending = { source: Source; citing: DocumentRef[] };

export function Sources({ onOpenDocument }: { onOpenDocument: (id: string) => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [editing, setEditing] = useState<Source | null | "new">(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);

  /** Ask for the list again. Bumping a counter, so every reload goes down one path. */
  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  // The list is read here and nowhere else, so a save, a delete and the first paint all reach
  // it the same way. The `live` flag matters: leaving this screen while the read is in flight
  // would otherwise set state on a component that is gone.
  useEffect(() => {
    let live = true;
    engine.source
      .list()
      .then((list) => {
        if (!live) return;
        setSources(list);
        setError(null);
      })
      .catch((thrown: unknown) => {
        if (!live) return;
        setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [reloads]);

  async function guard(work: () => Promise<void>) {
    setError(null);
    try {
      await work();
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  function saved(missing: Field[], type: SourceType) {
    setEditing(null);
    setNote(
      missing.length === 0
        ? "Saved."
        : `Saved, and still missing ${missing
            .map((f) => missingLabel(f, type))
            .join(", ")}. It will cite, with the gap shown plainly.`,
    );
    refresh();
  }

  if (editing !== null) {
    const existing = editing === "new" ? null : editing;
    return (
      <SourceForm
        key={existing?.id ?? "new"}
        existing={existing}
        onSaved={(_id, missing, type) => saved(missing, type)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <section className="sources">
      <header>
        <h2>Sources</h2>
        <button onClick={() => setEditing("new")}>New source</button>
      </header>

      {note && <p className="saved-note">{note}</p>}
      {error && <p className="error">{error}</p>}

      {pending && (
        <DeleteConfirmation
          pending={pending}
          onOpenDocument={onOpenDocument}
          onCancel={() => setPending(null)}
          onConfirm={() =>
            void guard(async () => {
              const id = pending.source.id;
              if (id) await engine.source.delete(id);
              setPending(null);
              setNote("Deleted.");
              refresh();
            })
          }
        />
      )}

      {loading ? (
        <p className="empty">Reading the library…</p>
      ) : sources.length === 0 ? (
        <p className="empty">
          No sources yet. Save one when you find it, not when you need to cite it — the web
          page you meant to come back to has a way of not being there.
        </p>
      ) : (
        <ul className="source-list">
          {sources.map((source) => (
            <li key={source.id ?? source.title}>
              <div className="source-row">
                <div>
                  <strong>{source.title || "Untitled"}</strong>
                  <span className="source-meta">
                    {describe(source)}
                  </span>
                </div>
                <span className="source-actions">
                  {source.file && (
                    // Reading the paper is the point of keeping it, so it is one click from
                    // the list rather than something you go into an edit form to reach.
                    <button
                      className="ghost paper-open"
                      title={`Open ${source.file}`}
                      onClick={() => void guard(async () => {
                        if (source.id) await engine.source.open(source.id);
                      })}
                    >
                      PDF
                    </button>
                  )}
                  <button className="ghost" onClick={() => setEditing(source)}>
                    Edit
                  </button>
                  <button
                    className="ghost"
                    onClick={() =>
                      void guard(async () => {
                        const id = source.id;
                        if (!id) return;
                        // Two-phase without exception: what would be orphaned is shown
                        // before anything is removed, never after.
                        setPending({ source, citing: await engine.source.deletePlan(id) });
                      })
                    }
                  >
                    Delete
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="note">
        Sources live in the library, not in a document. Save a book once and cite it from fifty
        documents; correct a typo once and every one of them is right.
      </p>
    </section>
  );
}

/** The plain facts of a source, for browsing. Not a citation — see the note at the top. */
function describe(source: Source): string {
  const kind = SOURCE_TYPES.find((t) => t.value === source.type)?.label ?? source.type;
  const who = source.contributors.map(contributorName).filter(Boolean);
  const named =
    who.length === 0
      ? "nobody listed"
      : who.length <= 2
        ? who.join(" and ")
        : `${who[0]} and ${who.length - 1} others`;
  const when = source.date.kind === "no-date" ? "no date" : String(source.date.year);
  return `${kind} · ${named} · ${when}`;
}

/**
 * Deleting a source orphans every citation of it, so the documents that would break are named
 * first. This is the screen you are glad of when a study is retracted and you need to find the
 * eleven places you leaned on it.
 */
function DeleteConfirmation({
  pending,
  onOpenDocument,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  onOpenDocument: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { source, citing } = pending;
  return (
    <div className="confirm">
      <h3>Delete “{source.title || "Untitled"}”?</h3>

      {citing.length === 0 ? (
        <p>No document cites this source. Deleting it changes nothing else.</p>
      ) : (
        <>
          <p className="warning">
            {citing.length} document{citing.length === 1 ? "" : "s"} cite
            {citing.length === 1 ? "s" : ""} this source. Deleting it leaves those citations
            pointing at nothing.
          </p>
          <ul>
            {citing.map((doc) => (
              <li key={doc.id}>
                <button className="ghost" onClick={() => onOpenDocument(doc.id)}>
                  {doc.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="row">
        <button className="secondary" onClick={onCancel}>
          Keep it
        </button>
        <button onClick={onConfirm}>Delete anyway</button>
      </div>
    </div>
  );
}

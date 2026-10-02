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

/** As the sidebar's search: long enough not to query per letter, short enough to feel live. */
const SEARCH_AFTER_IDLE_MS = 180;

export function Sources({ onOpenDocument }: { onOpenDocument: (id: string) => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [editing, setEditing] = useState<Source | null | "new">(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);

  // Searching the list. The index the sidebar searches holds sources too; this is where they
  // are shown, so this is where they are looked for. `matches` is the ids that matched, best
  // first, or `null` while nothing is being looked for — and it is deliberately not cleared
  // while the next answer is in flight, so the list does not empty under somebody typing.
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<string[] | null>(null);

  // Which sources are showing where they are used, and what came back.
  //
  // Asked for one source at a time, when somebody asks. The alternative — a count on every
  // row — would be one call per source on every paint, which is the same objection the note
  // at the top of this file makes about formatting the list.
  //
  // Kept for as long as this screen is open, and no longer: editing a document means leaving
  // here, which unmounts this and throws the answers away. Navigating away and back *is* the
  // invalidation, exactly as it is for the rendered citations in the editor.
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [citing, setCiting] = useState<Map<string, DocumentRef[]>>(new Map());

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

  // Asked again after a save or a delete as well as on typing, so a source just added can be
  // found by the search that is already showing.
  useEffect(() => {
    const looking = query.trim();
    if (looking === "") return;
    let live = true;
    const timer = setTimeout(() => {
      engine
        .search(looking)
        .then((hits) => {
          if (live) setMatches(hits.filter((hit) => hit.kind === "source").map((hit) => hit.id));
        })
        .catch((thrown: unknown) => {
          if (live) setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
        });
    }, SEARCH_AFTER_IDLE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, reloads]);

  function search(text: string) {
    setQuery(text);
    // An empty box shows the whole list whatever `matches` holds. Forgetting them here is for
    // the next search, which should start from the whole list rather than flash the results
    // of the last one while its own answer is on the way.
    if (text.trim() === "") setMatches(null);
  }

  // What the list shows: everything, or the matches in the order the search ranked them.
  const byId = new Map(sources.map((source) => [source.id ?? "", source]));
  const shown =
    query.trim() === "" || matches === null
      ? sources
      : matches.flatMap((id) => byId.get(id) ?? []);

  async function guard(work: () => Promise<void>) {
    setError(null);
    try {
      await work();
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  /**
   * Show, or stop showing, the documents citing one source.
   *
   * Closing keeps what was fetched. Reopening a source you just looked at should not make
   * you wait again for an answer that has not changed.
   */
  function toggleUses(source: Source) {
    const id = source.id;
    if (!id) return;

    const closing = opened.has(id);
    setOpened((open) => {
      const next = new Set(open);
      if (closing) next.delete(id);
      else next.add(id);
      return next;
    });

    // Only an opening needs an answer, and only if we do not already have one. Closing while
    // a lookup is still in flight would otherwise start a second.
    if (closing || citing.has(id)) return;

    setError(null);
    engine.source
      .citingDocuments(id)
      .then((found) => setCiting((had) => new Map(had).set(id, found)))
      .catch((thrown: unknown) => {
        // Collapse, rather than sit on "Looking…" for a question that is not going to be
        // answered. The error is then the only thing on screen making a claim — which beats
        // a panel implying an answer is still coming, and beats an empty list implying the
        // source is cited nowhere.
        setOpened((open) => {
          const next = new Set(open);
          next.delete(id);
          return next;
        });
        setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
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

      {sources.length > 0 && (
        <div className="find source-find">
          <input
            className="find-input"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Search your sources — a title, an author, a journal"
            aria-label="Search your sources"
          />
          {query !== "" && (
            <button
              className="ghost"
              onClick={() => search("")}
              title="Clear the search"
              aria-label="Clear the search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="empty">Reading the library…</p>
      ) : sources.length === 0 ? (
        <p className="empty">
          No sources yet. Save one when you find it, not when you need to cite it — the web
          page you meant to come back to has a way of not being there.
        </p>
      ) : shown.length === 0 ? (
        <p className="empty">No source matches “{query.trim()}”.</p>
      ) : (
        <ul className="source-list">
          {shown.map((source) => (
            <li key={source.id ?? source.title}>
              <div className="source-row">
                <div>
                  <strong>{source.title || "Untitled"}</strong>
                  <span className="source-meta">
                    {describe(source)}
                  </span>
                </div>
                <span className="source-actions">
                  {/* Not hidden until hover, unlike Edit and Delete. "Which of these am I
                      actually using" is a question you ask of the whole list, by looking down
                      it — the same reason the PDF marker stays visible. */}
                  <button
                    className="ghost used-in"
                    aria-expanded={source.id ? opened.has(source.id) : false}
                    title="Which documents cite this"
                    onClick={() => toggleUses(source)}
                  >
                    Used in
                  </button>
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

              {source.id && opened.has(source.id) && (
                <Uses
                  citing={citing.get(source.id)}
                  onOpenDocument={onOpenDocument}
                />
              )}
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

/**
 * Where a source is used, in the list where the source is.
 *
 * The question this answers is the one that makes a library of sources worth keeping: a study
 * is retracted, or you find out the second edition says something different, and you need the
 * eleven places you leaned on it. Until now the only way to ask was to start deleting the
 * source and read the warning — which is a terrible way to find out, because the answer
 * arrives attached to a destructive action.
 */
function Uses({
  citing,
  onOpenDocument,
}: {
  citing: DocumentRef[] | undefined;
  onOpenDocument: (id: string) => void;
}) {
  if (citing === undefined) return <p className="uses empty">Looking…</p>;

  if (citing.length === 0) {
    return (
      <p className="uses empty">
        Nothing cites this yet. Not a problem — a source saved before you need it is the whole
        point of saving it when you find it.
      </p>
    );
  }

  return (
    <div className="uses">
      <p className="uses-count">
        Cited in {citing.length} document{citing.length === 1 ? "" : "s"}.
      </p>
      <CitingList citing={citing} onOpenDocument={onOpenDocument} />
    </div>
  );
}

/** Documents citing a source, each one a way in. Shared, because both places that name them
 *  want the same thing: the title, and a click that takes you there. */
function CitingList({
  citing,
  onOpenDocument,
}: {
  citing: DocumentRef[];
  onOpenDocument: (id: string) => void;
}) {
  return (
    <ul>
      {citing.map((doc) => (
        <li key={doc.id}>
          <button className="ghost" onClick={() => onOpenDocument(doc.id)}>
            {doc.title}
          </button>
        </li>
      ))}
    </ul>
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
 * first — and named as a warning rather than as information, which is the difference between
 * this and `Uses` above. Asking where a source is used is not something anybody should have to
 * do by starting to delete it.
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
          <CitingList citing={citing} onOpenDocument={onOpenDocument} />
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

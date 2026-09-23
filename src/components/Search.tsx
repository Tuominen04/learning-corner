import { useEffect, useState } from "react";

import { engine, EngineFailure, type SearchHit } from "../lib/engine";

// Finding something you half-remember.
//
// One index holds topics, documents and sources, which is deliberate — you should not have to
// decide what kind of thing you are looking for before you can look for it. This screen shows
// the writing half: topics and documents. Sources have their own screen, where they can be
// shown with their authors and their papers, and a bare title in a list here would be the
// least useful way to present one.

/** Long enough that typing a word does not run a query per letter; short enough to feel live. */
const SEARCH_AFTER_IDLE_MS = 180;

export function Search({
  query,
  onOpenDocument,
}: {
  /**
   * What to look for. Never blank: an empty box means the tree is shown instead, so App
   * unmounts this rather than asking it to render nothing.
   */
  query: string;
  onOpenDocument: (id: string) => void;
}) {
  // `null` until the first answer comes back, and deliberately *not* cleared while a new
  // query is in flight — the previous results stay on screen for the moment it takes, rather
  // than the list emptying and refilling under somebody who is still typing.
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      engine
        .search(query.trim())
        .then((found) => {
          if (!live) return;
          // Sources are dropped here rather than in the query: the engine searching everything
          // is the right behaviour, and which kinds a screen shows is the screen's business.
          setHits(found.filter((hit) => hit.kind !== "source"));
          setError(null);
        })
        .catch((thrown: unknown) => {
          if (!live) return;
          setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
          setHits([]);
        });
    }, SEARCH_AFTER_IDLE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (hits === null) return null;

  return (
    <div className="results">
      {error && <p className="error">{error}</p>}

      {hits.length === 0 ? (
        <p className="empty">
          Nothing matches that. Searching looks inside what you wrote, not only at titles.
        </p>
      ) : (
        <ul>
          {hits.map((hit) => (
            <li key={hit.id}>
              {hit.kind === "document" ? (
                <button className="hit" onClick={() => onOpenDocument(hit.id)}>
                  <strong>{hit.title}</strong>
                  {hit.excerpt && <span className="excerpt">{hit.excerpt}</span>}
                </button>
              ) : (
                // A topic is not a place you can open — there is no topic view, only the tree.
                // Shown rather than hidden because knowing a topic matched is worth something,
                // and a row that quietly did nothing when clicked would be worse than one that
                // plainly is not a button.
                <div className="hit topic-hit">
                  <strong>{hit.title}</strong>
                  <span className="excerpt">
                    <em className="kind">Topic</em>
                    {hit.excerpt && ` · ${hit.excerpt}`}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

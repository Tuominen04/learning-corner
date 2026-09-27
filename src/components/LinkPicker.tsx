import { useMemo, useState } from "react";

import { linkable, type Linkable } from "../lib/links";
import type { Topic } from "../lib/engine";

// Choosing which document to link to.
//
// The list comes from the topic tree the application already holds, so this costs nothing and
// cannot be out of date with the sidebar beside it. Each document carries the path to it,
// because two documents called "Notes" in different topics are two different things and a
// list that shows them as one line repeated twice is asking somebody to guess.
//
// The document being written is not in the list. A document linking to itself is not a
// connection, and offering it is offering a mistake.

export function LinkPicker({
  topics,
  exclude,
  onChoose,
  onCancel,
}: {
  topics: Topic[];
  exclude: string;
  onChoose: (id: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const all = useMemo(() => linkable(topics, exclude), [topics, exclude]);

  // Matching on the title and on the path, so "protein notes" finds the one under Protein.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return all;
    return all.filter((doc) =>
      `${doc.title} ${doc.where}`.toLowerCase().includes(needle),
    );
  }, [all, query]);

  return (
    <div className="cite-picker">
      <header>
        <h3>Link to a document</h3>
        <button className="ghost" onClick={onCancel} title="Close">
          ×
        </button>
      </header>

      {all.length === 0 ? (
        <p className="empty">
          There is nothing else to link to yet. Write a second document and this is how the two
          find each other.
        </p>
      ) : (
        <>
          <input
            className="cite-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or topic"
            autoFocus
          />

          {matches.length === 0 ? (
            <p className="empty">Nothing matches that.</p>
          ) : (
            <ul className="cite-list">
              {matches.map((doc) => (
                <li key={doc.id}>
                  <button className="cite-option" onClick={() => onChoose(doc.id)}>
                    <strong>{doc.title}</strong>
                    <span className="source-meta">{doc.where}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <small className="hint">
            The link is stored as the document's identifier, never its name — so rename either
            document afterwards and the link still reads correctly.
          </small>
        </>
      )}
    </div>
  );
}

/** Re-exported for the tests, which care about the flattening and not about the dialog. */
export type { Linkable };

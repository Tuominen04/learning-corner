import { useMemo, useState } from "react";

import { linkable } from "../lib/links";
import type { Page } from "../lib/engine";

// Choosing a page for a diagram's box to point at.
//
// The list comes from the tree of pages the application already holds, each with the path to it,
// as for a link: two pages called "Notes" under different pages are two different things.

export function PagePicker({
  pages,
  title,
  onChoose,
  onCancel,
}: {
  pages: Page[];
  /** What choosing it does, as the heading says: "Add a box for a page". */
  title: string;
  onChoose: (id: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const all = useMemo(() => linkable(pages), [pages]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return all;
    return all.filter((p) => `${p.title} ${p.where}`.toLowerCase().includes(needle));
  }, [all, query]);

  return (
    <div className="cite-picker page-picker">
      <header>
        <h3>{title}</h3>
        <button className="ghost" onClick={onCancel} title="Close">
          ×
        </button>
      </header>

      {all.length === 0 ? (
        <p className="empty">There are no pages yet. Write one and it can be on a diagram.</p>
      ) : (
        <>
          <input
            className="cite-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, or the page it is under"
            aria-label="Search pages"
            autoFocus
          />
          {matches.length === 0 ? (
            <p className="empty">Nothing matches that.</p>
          ) : (
            <ul className="cite-list">
              {matches.map((p) => (
                <li key={p.id}>
                  <button className="cite-option" onClick={() => onChoose(p.id)}>
                    <strong>{p.title}</strong>
                    <span className="source-meta">{p.where}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

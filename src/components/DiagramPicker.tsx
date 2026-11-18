import { useEffect, useState } from "react";

import { engine, EngineFailure, type DiagramSummary } from "../lib/engine";

// Choosing a diagram to show in the page being written.
//
// What goes into the page is one line, `![Title](diagram:<id>)`, with the diagram's title for
// its words — which is what anything that cannot draw a diagram reads. The words are the page's
// to change: renaming the diagram afterwards does not rewrite the pages that show it.

const KIND: Record<DiagramSummary["layout"], string> = {
  layered: "Layered",
  timeline: "Timeline",
  free: "Free",
};

export function DiagramPicker({
  onChoose,
  onCancel,
}: {
  onChoose: (id: string, title: string) => void;
  onCancel: () => void;
}) {
  const [list, setList] = useState<DiagramSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    engine.diagram
      .list()
      .then((found) => live && setList(found ?? []))
      .catch((thrown: unknown) => {
        if (live) setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="cite-picker diagram-picker">
      <header>
        <h3>Show a diagram here</h3>
        <button className="ghost" onClick={onCancel} title="Close">
          ×
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      {list !== null &&
        (list.length === 0 ? (
          <p className="empty">
            There are no diagrams yet. Make one on the Diagrams screen, and this is how a page
            shows it.
          </p>
        ) : (
          <ul className="cite-list">
            {list.map((d) => (
              <li key={d.id}>
                <button className="cite-option" onClick={() => onChoose(d.id, d.title)}>
                  <strong>{d.title}</strong>
                  <span className="source-meta">{KIND[d.layout]}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
      <small className="hint">
        The page keeps one line naming the diagram, never a copy of it — so a diagram corrected
        once is right on every page that shows it.
      </small>
    </div>
  );
}

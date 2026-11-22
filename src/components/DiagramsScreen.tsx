import { useEffect, useState } from "react";

import {
  engine,
  EngineFailure,
  type DiagramLayout,
  type DiagramSummary,
  type Page,
} from "../lib/engine";
import { DeleteDiagram } from "./DeleteDiagram";
import { DiagramEditor } from "./DiagramEditor";

// The diagrams in a library, and making one (ADR 0011).
//
// A diagram is a picture somebody builds on purpose: a family tree, a historical path, a map of
// a network. It has a layout — how its boxes come to be where they are — chosen when it is made
// and changeable afterwards without losing anything.

export const KINDS: { value: DiagramLayout; label: string; hint: string }[] = [
  {
    value: "layered",
    label: "Layered",
    hint: "A family tree, or any hierarchy: laid out in layers, following the lines you draw.",
  },
  {
    value: "timeline",
    label: "Timeline",
    hint: "A historical path: boxes in order of when, in your own words — 1850, c. 1200, the late Bronze Age.",
  },
  {
    value: "free",
    label: "Free",
    hint: "A map of a network, or anything you want to arrange yourself: boxes stay where you drag them.",
  },
];

export function DiagramsScreen({
  pages,
  open,
  onOpen,
  onBeside,
  besideOpen,
  link,
}: {
  pages: Page[];
  /** The diagram being edited, if one is. Held above, so a search result can open one. */
  open: string | null;
  onOpen: (id: string | null) => void;
  /** Show a box's page beside the diagram, or none (`null`) when the box has no page. */
  onBeside: (box: string, page: string | null) => void;
  /** A page chosen for a box from beside the diagram, to be written into the diagram. */
  link: { n: number; box: string; page: string } | null;
  /** A page is open beside it, so the diagram gives up room. */
  besideOpen: boolean;
}) {
  const [list, setList] = useState<DiagramSummary[] | null>(null);
  const [title, setTitle] = useState("");
  const [layout, setLayout] = useState<DiagramLayout>("layered");
  const [deleting, setDeleting] = useState<DiagramSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // Read again whenever this is what is showing: a diagram renamed or deleted in the editor
  // changes the list, and the list never holds a copy.
  useEffect(() => {
    if (open !== null) return;
    let live = true;
    engine.diagram
      .list()
      .then((found) => live && setList(found))
      .catch((thrown: unknown) => {
        if (live) setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
    return () => {
      live = false;
    };
  }, [open, version]);

  if (open !== null) {
    return (
      <DiagramEditor
        key={open}
        id={open}
        pages={pages}
        onBack={() => onOpen(null)}
        onBeside={onBeside}
        link={link}
        besideOpen={besideOpen}
        onDeleted={() => onOpen(null)}
      />
    );
  }

  if (deleting) {
    return (
      <DeleteDiagram
        id={deleting.id}
        title={deleting.title}
        onDeleted={() => {
          setDeleting(null);
          setVersion((v) => v + 1);
        }}
        onCancel={() => setDeleting(null)}
      />
    );
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim() === "") return;
    try {
      const made = await engine.diagram.create(title, layout);
      setTitle("");
      onOpen(made.id);
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  return (
    <div className="diagrams">
      <h2>Diagrams</h2>
      <p className="quiet">
        Pictures you build yourself — a family tree, a historical path, a map of a network. A
        box can point at one of your pages.
      </p>
      {error && <p className="error">{error}</p>}

      <form className="diagram-new" onSubmit={(e) => void create(e)}>
        <h3>New diagram</h3>
        <label className="diagram-field">
          <span>Name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Family tree, Timeline of ideas, Network…"
            aria-label="Name of the new diagram"
          />
        </label>
        <div role="radiogroup" aria-label="Kind of diagram">
          {KINDS.map((k) => (
            <label className="choice" key={k.value}>
              <input
                type="radio"
                name="diagram-kind"
                checked={layout === k.value}
                onChange={() => setLayout(k.value)}
              />
              <span>
                <strong>{k.label}</strong>
                {k.hint}
              </span>
            </label>
          ))}
        </div>
        <p className="actions">
          <button type="submit" disabled={title.trim() === ""}>
            Make it
          </button>
        </p>
      </form>

      {list !== null &&
        (list.length === 0 ? (
          <p className="empty">No diagrams yet.</p>
        ) : (
          <ul className="diagram-list-screen">
            {list.map((d) => (
              <li key={d.id}>
                <button className="hit" onClick={() => onOpen(d.id)}>
                  <strong>{d.title}</strong>
                  <span className="excerpt">
                    <em className="kind">{KINDS.find((k) => k.value === d.layout)?.label}</em>
                  </span>
                </button>
                <button
                  className="ghost danger-text"
                  title={`Delete “${d.title}”`}
                  onClick={() => setDeleting(d)}
                >
                  Delete…
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

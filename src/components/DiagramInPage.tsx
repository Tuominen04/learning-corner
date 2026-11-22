import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { draw, pageTitles, PALETTE, toEdit, type Drawing } from "../lib/diagram";
import { isId } from "../lib/ids";
import { engine, EngineFailure, type DiagramView, type Page } from "../lib/engine";

// A diagram, shown in the page that has its picture line (ADR 0011).
//
// The line in the page is `![Family tree](diagram:<id>)` and nothing else: no copy of the
// diagram is in the page, so one corrected once is right on every page that shows it. What is
// drawn here is drawn from the diagram's file each time the page is opened, by the same code that
// draws a saved picture. Boxes for a page that is there open it; **Edit** goes to the diagram.

/** What a diagram in a page needs from the screen it is on. */
export type DiagramsAround = {
  pages: Page[];
  onOpenDocument: (id: string) => void;
  onOpenDiagram: (id: string) => void;
};

export const DiagramsInPages = createContext<DiagramsAround | null>(null);

type Shown =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "failed"; message: string }
  | { state: "there"; view: DiagramView };

export function DiagramInPage({ id, alt }: { id: string; alt: string }) {
  const around = useContext(DiagramsInPages);
  const [fetched, setFetched] = useState<Shown>({ state: "loading" });

  // Not an identifier: nothing to ask the engine, and nothing it could answer.
  const valid = isId(id);
  const shown = useMemo<Shown>(() => (valid ? fetched : { state: "missing" }), [valid, fetched]);

  useEffect(() => {
    if (!valid) return;
    let live = true;
    engine.diagram
      .read(id)
      .then((view) => live && setFetched({ state: "there", view }))
      .catch((thrown: unknown) => {
        if (!live) return;
        // A line that names a diagram that is not there — deleted by hand, or typed — is not an
        // error: it reads as a picture whose file is gone, which is what it is.
        if (thrown instanceof EngineFailure && thrown.kind === "NotFound") setFetched({ state: "missing" });
        else setFetched({ state: "failed", message: thrown instanceof EngineFailure ? thrown.message : String(thrown) });
      });
    return () => {
      live = false;
    };
  }, [id, valid]);

  const drawing = useMemo<Drawing | null>(() => {
    if (shown.state !== "there" || !around) return null;
    return draw(toEdit(shown.view), pageTitles(around.pages));
  }, [shown, around]);

  if (shown.state === "loading") return <span className="picture-pending">[Diagram: {alt || id}]</span>;
  if (shown.state === "missing") {
    return <span className="picture-missing">[diagram missing: {alt || id}]</span>;
  }
  if (shown.state === "failed") return <span className="picture-missing">[diagram: {shown.message}]</span>;
  if (!drawing || !around) return null;

  const marker = `arrow-${id}`;
  return (
    <figure className="diagram-in-page">
      <figcaption>
        <strong>{shown.view.title}</strong>
        <button className="secondary" onClick={() => around.onOpenDiagram(id)}>
          Edit
        </button>
      </figcaption>
      {drawing.boxes.length === 0 ? (
        <p className="quiet">This diagram is empty so far.</p>
      ) : (
        <svg
          viewBox={`0 0 ${drawing.width} ${drawing.height}`}
          style={{ width: "100%", maxWidth: drawing.width }}
          role="img"
          aria-label={`Diagram: ${shown.view.title}`}
          data-boxes={drawing.boxes.length}
          data-lines={drawing.lines.length}
        >
          <defs>
            <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill={PALETTE.line} />
            </marker>
          </defs>
          {drawing.lines.map((l) => (
            <line key={l.index} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={PALETTE.line} strokeWidth={1.5} markerEnd={`url(#${marker})`} />
          ))}
          {drawing.lines.map(
            (l) =>
              l.label && (
                <text key={`label-${l.index}`} x={l.lx} y={l.ly - 5} fill={PALETTE.ink} textAnchor="middle" fontSize={11} stroke={PALETTE.ground} strokeWidth={3} paintOrder="stroke">
                  {l.label}
                </text>
              ),
          )}
          {drawing.boxes.map((b) => {
            const opens = b.page !== null && !b.gone;
            const open = () => opens && around.onOpenDocument(b.page!);
            return (
              <g
                key={b.id}
                className={opens ? "diagram-box-link" : undefined}
                role={opens ? "link" : undefined}
                tabIndex={opens ? 0 : undefined}
                aria-label={opens ? `Open ${b.text}` : undefined}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                }}
              >
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={6}
                  fill={PALETTE.box}
                  stroke={b.gone ? PALETTE.gone : PALETTE.boxLine}
                  strokeWidth={1.5}
                  strokeDasharray={b.gone ? "4 3" : undefined}
                >
                  <title>{b.text}</title>
                </rect>
                {b.when && (
                  <text x={b.x + b.w / 2} y={b.y + 19} fill={PALETTE.line} textAnchor="middle" fontSize={11}>
                    {b.when}
                  </text>
                )}
                <text x={b.x + b.w / 2} y={b.when ? b.y + 40 : b.y + b.h / 2 + 4.5} fill={PALETTE.ink} textAnchor="middle" fontSize={13}>
                  {b.text}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </figure>
  );
}

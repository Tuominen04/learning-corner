import { save } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { engine, EngineFailure, shell, type Graph, type GraphNode } from "../lib/engine";
import {
  base64,
  beside,
  colours,
  degrees,
  fit,
  GROUND,
  LABEL,
  labelled,
  layout,
  LINE_STYLE,
  neighbours,
  nodeAt,
  radius,
  SHOW_EVERYTHING,
  showingFrom,
  toSvg,
  towards,
  visible,
  type Point,
  type Reach,
  type Showing,
  type View,
} from "../lib/graph";

const EMPTY: Graph = { nodes: [], lines: [] };

const REACHES: { value: Reach; label: string }[] = [
  { value: "1", label: "1 step" },
  { value: "2", label: "2 steps" },
  { value: "3", label: "3 steps" },
  { value: "under", label: "Pages under it" },
];

/**
 * The library graph (ADR 0010): every page, how the pages link, and how the tree branches.
 *
 * Nothing here is kept in the library. The graph is read each time the screen is shown, laid
 * out, and drawn on a canvas — which is what lets a few thousand pages pan and zoom. The
 * canvas says nothing to a keyboard or a screen reader, so everything it can do is also in
 * the panel beside it: finding a node, what it is joined to, opening it.
 */
export function GraphScreen({ onOpenDocument }: { onOpenDocument: (id: string) => void }) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [showing, setShowing] = useState<Showing | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const canvas = useRef<HTMLCanvasElement | null>(null);
  const area = useRef<HTMLDivElement | null>(null);
  // Where nodes were put, kept while the screen is open so that reading the graph again —
  // sources switched on, say — adds to the picture rather than rearranging it.
  const [places, setPlaces] = useState(() => new Map<string, Point>());
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // How the screen was last left, once, as it opens.
  useEffect(() => {
    let live = true;
    shell
      .remembered()
      .then((kept) => live && setShowing(showingFrom(kept.graph)))
      .catch(() => live && setShowing(SHOW_EVERYTHING));
    return () => {
      live = false;
    };
  }, []);

  const withSources = showing?.sources ?? null;
  useEffect(() => {
    if (withSources === null) return;
    let live = true;
    engine.library
      .graph(withSources)
      .then((read) => {
        if (!live) return;
        setPlaces((placed) => layout(read, placed));
        setGraph(read);
      })
      .catch((thrown: unknown) => {
        if (live) setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
    return () => {
      live = false;
    };
  }, [withSources]);

  /** Change what is shown, and remember it for next time. Forgetting is not worth a word. */
  const show = useCallback((change: Partial<Showing>) => {
    setShowing((now) => {
      const next = { ...(now ?? SHOW_EVERYTHING), ...change };
      void shell.rememberGraphView(next).catch(() => {});
      return next;
    });
    setView(null); // fitted again to what is now shown
  }, []);

  const whole = graph ?? EMPTY;
  const shown = useMemo(() => visible(whole, showing ?? SHOW_EVERYTHING), [whole, showing]);
  const count = useMemo(() => degrees(shown.lines), [shown]);
  const colour = useMemo(() => colours(whole), [whole]);
  const byId = useMemo(() => new Map(whole.nodes.map((n) => [n.id, n])), [whole]);
  const shownIds = useMemo(() => new Set(shown.nodes.map((n) => n.id)), [shown]);

  // The area's size, kept current: the canvas is drawn at exactly the pixels it has.
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Fitted to what is shown whenever that changes; panning and zooming then hold until it
  // changes again.
  const fitted = useMemo(
    () => fit(shown.nodes, places, size.width, size.height),
    [shown, places, size.width, size.height],
  );
  const at = view ?? fitted;

  const lit = hovered ?? (selected !== null && shownIds.has(selected) ? selected : null);
  const around = useMemo(() => (lit === null ? null : beside(shown.lines, lit)), [shown, lit]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || size.width === 0 || size.height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(size.width * ratio);
    element.height = Math.round(size.height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(context, shown, places, colour, count, at, size, lit, around, selected);
  }, [shown, places, colour, count, at, size, lit, around, selected]);

  const select = useCallback((id: string | null) => {
    setSelected(id);
    setSaved(null);
  }, []);

  const open = useCallback(
    (id: string) => {
      if (byId.get(id)?.kind === "page") onOpenDocument(id);
    },
    [byId, onOpenDocument],
  );

  const pointAt = (event: { clientX: number; clientY: number }) => {
    const box = canvas.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const under = (event: { clientX: number; clientY: number }) => {
    const p = pointAt(event);
    return nodeAt(shown.nodes, places, count, at, p.x, p.y);
  };

  const zoom = useCallback(
    (factor: number, about = { x: size.width / 2, y: size.height / 2 }) => {
      const k = Math.min(8, Math.max(0.02, at.k * factor));
      const scale = k / at.k;
      setView({ k, x: about.x - (about.x - at.x) * scale, y: about.y - (about.y - at.y) * scale });
    },
    [at, size.width, size.height],
  );

  // Wheel to zoom, about the pointer. Attached by hand: React's own wheel listener is passive
  // and cannot stop the page scrolling instead.
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoom]);

  function onKeyDown(event: React.KeyboardEvent) {
    const arrows = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const;
    if (event.key in arrows && selected !== null) {
      event.preventDefault();
      const next = towards(shown.lines, places, selected, arrows[event.key as keyof typeof arrows]);
      if (next !== null) select(next);
    } else if (event.key === "Enter" && selected !== null) {
      open(selected);
    } else if (event.key === "+" || event.key === "=") {
      zoom(1.25);
    } else if (event.key === "-") {
      zoom(0.8);
    } else if (event.key === "0") {
      setView(null);
    } else if (event.key === "Escape") {
      select(null);
    }
  }

  async function savePicture(kind: "svg" | "png") {
    setError(null);
    setSaved(null);
    try {
      const path = await save({
        defaultPath: `graph.${kind}`,
        filters: [{ name: kind === "svg" ? "SVG picture" : "PNG picture", extensions: [kind] }],
      });
      if (path === null) return;
      const data =
        kind === "svg"
          ? base64(toSvg(shown, places, colour, at, size.width, size.height))
          : png(shown, places, colour, count, at, size);
      await shell.saveGraphPicture(path, data);
      setSaved(path);
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  const found = useMemo(() => {
    const wanted = query.trim().toLowerCase();
    if (wanted === "") return [];
    return whole.nodes.filter((n) => n.title.toLowerCase().includes(wanted)).slice(0, 12);
  }, [whole, query]);

  const chosen = selected !== null ? (byId.get(selected) ?? null) : null;
  const joined = useMemo(
    () => (chosen ? neighbours(whole.lines, chosen.id) : null),
    [whole, chosen],
  );
  const focused = showing?.focus != null ? (byId.get(showing.focus) ?? null) : null;
  const pages = shown.nodes.filter((n) => n.kind === "page").length;

  return (
    <div className="graph">
      <div className="graph-area" ref={area}>
        <canvas
          ref={canvas}
          className={hovered !== null ? "graph-canvas over-node" : "graph-canvas"}
          style={{ width: size.width, height: size.height }}
          tabIndex={0}
          role="img"
          aria-label={`The library as a graph: ${count_(pages, "page")}${
            shown.nodes.length > pages ? `, ${count_(shown.nodes.length - pages, "source")}` : ""
          } and ${count_(shown.lines.length, "line")}. Use Find, beside it, to choose a page; arrow keys then move along its lines, and Enter opens it.`}
          data-nodes={shown.nodes.length}
          data-lines={shown.lines.length}
          data-selected={selected ?? ""}
          onKeyDown={onKeyDown}
          onMouseDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY, moved: false };
          }}
          onMouseMove={(event) => {
            const held = drag.current;
            if (held) {
              const dx = event.clientX - held.x;
              const dy = event.clientY - held.y;
              if (held.moved || Math.hypot(dx, dy) > 3) {
                drag.current = { x: event.clientX, y: event.clientY, moved: true };
                setView({ ...at, x: at.x + dx, y: at.y + dy });
              }
            } else {
              setHovered(under(event));
            }
          }}
          onMouseUp={(event) => {
            const held = drag.current;
            drag.current = null;
            // A press and release in one place is a click; a drag only moved the picture.
            if (held && !held.moved) select(under(event));
          }}
          onMouseLeave={() => {
            drag.current = null;
            setHovered(null);
          }}
          onDoubleClick={(event) => {
            const id = under(event);
            if (id !== null) open(id);
          }}
        />
        {graph !== null && whole.nodes.length === 0 && (
          <p className="empty graph-empty">
            Nothing to draw yet. Pages appear here as you write them, joined by the links between
            them.
          </p>
        )}
        <div className="graph-zoom">
          <button className="ghost" onClick={() => zoom(1.25)} title="Zoom in (+)" aria-label="Zoom in">
            +
          </button>
          <button className="ghost" onClick={() => zoom(0.8)} title="Zoom out (−)" aria-label="Zoom out">
            −
          </button>
          <button className="ghost" onClick={() => setView(null)} title="Show everything that is on the graph (0)">
            Fit
          </button>
        </div>
      </div>

      <div className="graph-panel">
        {error && <p className="error">{error}</p>}

        {/* First in the panel, above everything else: while the picture is narrowed, the way
            back to the whole of it is the thing to find. */}
        {focused && showing && (
          <div className="graph-focus">
            <button className="graph-back" onClick={() => show({ focus: null })}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path
                  d="M7 3 2 8l5 5M2.5 8H14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to the whole library
            </button>
            <p role="status">
              Showing only “{focused.title}” and{" "}
              {showing.reach === "under"
                ? "the pages under it"
                : `what is within ${REACHES.find((r) => r.value === showing.reach)!.label} of it`}
              .
            </p>
          </div>
        )}

        <div className="find">
          <input
            className="find-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find on the graph"
            aria-label="Find a page or source on the graph, by title"
          />
          {query !== "" && (
            <button className="ghost" onClick={() => setQuery("")} title="Clear">
              ×
            </button>
          )}
        </div>
        {query.trim() !== "" && (
          <ul className="graph-found">
            {found.length === 0 && <li className="quiet">Nothing with that in its title.</li>}
            {found.map((n) => (
              <li key={n.id}>
                <NodeButton
                  node={n}
                  colour={colour.get(n.id)}
                  onClick={() => {
                    // Something outside the focus is found by leaving the focus.
                    if (!shownIds.has(n.id)) show({ focus: null });
                    select(n.id);
                    setQuery("");
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <label className="graph-toggle">
          <input
            type="checkbox"
            checked={showing?.tree ?? true}
            onChange={(event) => show({ tree: event.target.checked })}
          />
          Show the tree
          <span className="quiet"> — each page joined to the page it is under</span>
        </label>
        <label className="graph-toggle">
          <input
            type="checkbox"
            checked={showing?.sources ?? false}
            onChange={(event) => show({ sources: event.target.checked })}
          />
          Show sources
          <span className="quiet"> — and which pages cite them</span>
        </label>

        {chosen && joined ? (
          <div className="graph-chosen">
            <h3>
              <span className="graph-dot" style={{ background: colour.get(chosen.id) }} />
              {chosen.title}
            </h3>
            <p className="quiet">{chosen.kind === "page" ? "A page" : "A source"}</p>
            {chosen.kind === "page" && (
              <button onClick={() => open(chosen.id)}>Open this page</button>
            )}

            <div className="graph-reach" role="group" aria-label="Show only this and">
              <span className="quiet">Show only this and</span>
              {REACHES.filter((r) => r.value !== "under" || chosen.kind === "page").map((r) => (
                <button
                  key={r.value}
                  className={
                    showing?.focus === chosen.id && showing.reach === r.value ? "view selected" : "view"
                  }
                  onClick={() => show({ focus: chosen.id, reach: r.value })}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <Joined title="Links to" ids={joined.linksTo} byId={byId} colour={colour} onSelect={select} />
            <Joined title="Linked from" ids={joined.linkedFrom} byId={byId} colour={colour} onSelect={select} />
            <Joined title="Under" ids={joined.parent} byId={byId} colour={colour} onSelect={select} />
            <Joined title="Pages under it" ids={joined.children} byId={byId} colour={colour} onSelect={select} />
            <Joined title="Cites" ids={joined.cites} byId={byId} colour={colour} onSelect={select} />
            <Joined title="Cited by" ids={joined.citedBy} byId={byId} colour={colour} onSelect={select} />
            {Object.values(joined).every((ids) => ids.length === 0) && (
              <p className="quiet">Joined to nothing{showing?.sources ? "" : " — sources are not shown"}.</p>
            )}
          </div>
        ) : (
          <p className="quiet graph-hint">
            {count_(pages, "page")} and {count_(shown.lines.length, "line")}. Bigger means more
            lines; a colour is one subject — a page at the top and everything under it. Click a
            page to see what it is joined to, double-click to open it. Drag to move the picture,
            scroll to zoom.
          </p>
        )}

        <div className="graph-save">
          <span className="quiet">Save as a picture</span>
          <button className="secondary" onClick={() => void savePicture("svg")}>
            SVG…
          </button>
          <button className="secondary" onClick={() => void savePicture("png")}>
            PNG…
          </button>
        </div>
        {saved && (
          <p className="folder-note" role="status">
            Saved to {saved}
          </p>
        )}
      </div>
    </div>
  );
}

function count_(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function NodeButton({ node, colour, onClick }: { node: GraphNode; colour: string | undefined; onClick: () => void }) {
  return (
    <button className="ghost graph-node" onClick={onClick}>
      <span className={node.kind === "source" ? "graph-dot square" : "graph-dot"} style={{ background: colour }} />
      {node.title}
    </button>
  );
}

function Joined({
  title,
  ids,
  byId,
  colour,
  onSelect,
}: {
  title: string;
  ids: string[];
  byId: Map<string, GraphNode>;
  colour: Map<string, string>;
  onSelect: (id: string) => void;
}) {
  const nodes = ids.map((id) => byId.get(id)).filter((n): n is GraphNode => n !== undefined);
  if (nodes.length === 0) return null;
  return (
    <section className="graph-joined">
      <h4>
        {title} <span className="quiet">{nodes.length}</span>
      </h4>
      <ul>
        {nodes.map((n) => (
          <li key={n.id}>
            <NodeButton node={n} colour={colour.get(n.id)} onClick={() => onSelect(n.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Draw what is shown. With a node lit, it and what it is joined to stand out and the rest dims. */
function draw(
  context: CanvasRenderingContext2D,
  shown: Graph,
  places: Map<string, Point>,
  colour: Map<string, string>,
  count: Map<string, number>,
  view: View,
  size: { width: number; height: number },
  lit: string | null,
  around: Set<string> | null,
  selected: string | null,
) {
  context.fillStyle = GROUND;
  context.fillRect(0, 0, size.width, size.height);
  const at = (id: string) => {
    const p = places.get(id) ?? { x: 0, y: 0 };
    return { x: p.x * view.k + view.x, y: p.y * view.k + view.y };
  };
  const bright = (id: string) => lit === null || id === lit || (around?.has(id) ?? false);

  for (const l of shown.lines) {
    const style = LINE_STYLE[l.kind];
    const a = at(l.from);
    const b = at(l.to);
    const touches = lit !== null && (l.from === lit || l.to === lit);
    context.globalAlpha = lit === null ? 0.8 : touches ? 1 : 0.12;
    context.strokeStyle = touches ? LABEL : style.colour;
    context.lineWidth = touches ? style.width + 0.6 : style.width;
    context.setLineDash(style.dash);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  }
  context.setLineDash([]);

  for (const n of shown.nodes) {
    const p = at(n.id);
    const r = Math.max(radius(count.get(n.id) ?? 0) * view.k, 1.5);
    context.globalAlpha = bright(n.id) ? 1 : 0.3;
    context.fillStyle = colour.get(n.id) ?? LABEL;
    context.beginPath();
    if (n.kind === "source") context.rect(p.x - r, p.y - r, 2 * r, 2 * r);
    else context.arc(p.x, p.y, r, 0, 2 * Math.PI);
    context.fill();
    if (n.id === selected) {
      context.strokeStyle = LABEL;
      context.lineWidth = 2;
      context.stroke();
    }
  }

  context.font = "12px system-ui, sans-serif";
  context.fillStyle = LABEL;
  context.strokeStyle = GROUND;
  context.lineWidth = 3;
  context.lineJoin = "round";
  for (const n of shown.nodes) {
    const degree = count.get(n.id) ?? 0;
    const named = lit !== null ? bright(n.id) : labelled(degree, view.k);
    if (!named) continue;
    const p = at(n.id);
    context.globalAlpha = 1;
    // Outlined in the ground's colour first, so a title crossing a line can still be read.
    context.strokeText(n.title, p.x + radius(degree) * view.k + 4, p.y + 4);
    context.fillText(n.title, p.x + radius(degree) * view.k + 4, p.y + 4);
  }
  context.globalAlpha = 1;
}

/** What is on screen as a PNG, at twice the size so it prints cleanly: its bytes in base64. */
function png(
  shown: Graph,
  places: Map<string, Point>,
  colour: Map<string, string>,
  count: Map<string, number>,
  view: View,
  size: { width: number; height: number },
): string {
  const picture = document.createElement("canvas");
  picture.width = size.width * 2;
  picture.height = size.height * 2;
  const context = picture.getContext("2d")!;
  context.setTransform(2, 0, 0, 2, 0, 0);
  draw(context, shown, places, colour, count, view, size, null, null, null);
  return picture.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}

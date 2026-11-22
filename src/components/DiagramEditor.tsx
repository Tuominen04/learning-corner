import "@xyflow/react/dist/style.css";

import { save } from "@tauri-apps/plugin-dialog";
import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnect,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  GONE,
  addLabelBox,
  addLine,
  addPageBox,
  arrange,
  arrangeAgain,
  begin,
  boxText,
  diagramPictureName,
  draw,
  isGone,
  moveBoxes,
  pageTitles,
  record,
  redo,
  removeBox,
  removeLine,
  reorderBox,
  reverseLine,
  setDirection,
  setLabel,
  setLayout,
  setLineLabel,
  setPage,
  setTitle,
  setWhen,
  sides,
  toEdit,
  toSvg,
  undo,
  type History,
  type Side,
} from "../lib/diagram";
import {
  engine,
  EngineFailure,
  shell,
  type DiagramEdit,
  type DiagramLayout,
  type DiagramView,
  type Page,
} from "../lib/engine";
import { base64, svgToPng } from "../lib/picture";
import { holdUntilSaved } from "../lib/saving";
import { DeleteDiagram } from "./DeleteDiagram";
import { PagePicker } from "./PagePicker";
import { RenameableName } from "./RenameableName";

// Making and changing one diagram (ADR 0011).
//
// The editor holds the diagram — every state it has been in, for undo — and saves it whole a
// moment after each change, with the revision it last saw. If the file changed meanwhile, in a
// text editor or on another computer, the save is refused and the person is asked, rather than
// one of the two being lost without a word.
//
// The canvas is React Flow. It says nothing to a keyboard or a screen reader, so everything it
// can do is also in the panel beside it: every box and line as a list, and each one's words,
// page and place in order.

const LAYOUTS: { value: DiagramLayout; label: string; hint: string }[] = [
  { value: "layered", label: "Layered", hint: "A family tree or hierarchy, in layers along its lines" },
  { value: "timeline", label: "Timeline", hint: "Events in order, by when they happened" },
  { value: "free", label: "Free", hint: "Arranged by hand: boxes stay where you drag them" },
];

const POSITION: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

type BoxData = {
  text: string;
  when: string | null;
  gone: boolean;
  linked: boolean;
  w: number;
  h: number;
};
type BoxNode = Node<BoxData, "box">;

function BoxView({ data, selected }: NodeProps<BoxNode>) {
  return (
    <div
      className={`diagram-box${selected ? " selected" : ""}${data.gone ? " gone" : ""}`}
      style={{ width: data.w, height: data.h }}
    >
      {data.when && <span className="when">{data.when}</span>}
      <span className="text">{data.text}</span>
      {data.linked && (
        <span className="page-mark" title="Points at a page. Double-click to open it." aria-hidden="true">
          ↗
        </span>
      )}
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Handle key={side} id={side} type="source" position={POSITION[side]} />
      ))}
    </div>
  );
}

// Stable, or React Flow redraws every box on every render.
const NODE_TYPES = { box: BoxView };

type Selected = { kind: "box"; id: string } | { kind: "line"; index: number } | null;
type Picking = null | "add" | { box: string };
type Status = "saved" | "saving" | "unsaved" | "conflict";

/** Text typed into a field, kept as one change when it is done and not one per letter. */
function Field({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  // What is being typed, or none while the field just shows what it stands for — so another
  // box chosen, or an undo, is shown as soon as it happens, with nothing to keep in step.
  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? value;
  const cancelled = useRef(false);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (typed !== null && typed !== value) onCommit(typed);
    setTyped(null);
  };
  return (
    <label className="diagram-field">
      <span>{label}</span>
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Leaving the field is what keeps what was typed: Enter just leaves it.
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            cancelled.current = true;
            setTyped(null);
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function DiagramEditor(props: {
  id: string;
  pages: Page[];
  onBack: () => void;
  onBeside: (box: string, page: string | null) => void;
  besideOpen: boolean;
  link: { n: number; box: string; page: string } | null;
  onDeleted: () => void;
}) {
  return (
    <ReactFlowProvider>
      <Workspace {...props} />
    </ReactFlowProvider>
  );
}

function Workspace({
  id,
  pages,
  onBack,
  onBeside,
  besideOpen,
  link,
  onDeleted,
}: {
  id: string;
  pages: Page[];
  onBack: () => void;
  onBeside: (box: string, page: string | null) => void;
  besideOpen: boolean;
  link: { n: number; box: string; page: string } | null;
  onDeleted: () => void;
}) {
  // The side panel gives its room to a page opened beside the diagram, and can be brought back.
  // The person's choice only counts for the state it was made in, so opening or closing a page
  // starts over from the sensible default: hidden while a page is beside, shown otherwise.
  const [panelChoice, setPanelChoice] = useState<{ beside: boolean; hidden: boolean } | null>(null);
  const panelHidden = panelChoice && panelChoice.beside === besideOpen ? panelChoice.hidden : besideOpen;
  const titles = useMemo(() => pageTitles(pages), [pages]);
  const [history, setHistory] = useState<History | null>(null);
  const [status, setStatus] = useState<Status>("saved");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [deleting, setDeleting] = useState(false);

  const flow = useReactFlow();
  const area = useRef<HTMLDivElement | null>(null);

  // What the engine has, what is on screen, and the revision to save over.
  const revision = useRef<DiagramView["revision"] | null>(null);
  const saved = useRef<DiagramEdit | null>(null);
  const latest = useRef<DiagramEdit | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const conflicted = useRef(false);

  const draft = history?.present ?? null;

  // ---- loading ---------------------------------------------------------------------------

  const load = useCallback(() => {
    let live = true;
    engine.diagram
      .read(id)
      .then((view) => {
        if (!live) return;
        const edit = toEdit(view);
        revision.current = view.revision;
        saved.current = edit;
        latest.current = edit;
        conflicted.current = false;
        setHistory(begin(edit));
        setStatus("saved");
        setError(null);
        setSelected(null);
      })
      .catch((thrown: unknown) => {
        if (live) setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => load(), [load]);

  // ---- saving ----------------------------------------------------------------------------

  const flush = useCallback((): Promise<void> => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const run = async (): Promise<void> => {
      const draft = latest.current;
      if (!draft || draft === saved.current || conflicted.current || revision.current === null) return;
      setStatus("saving");
      try {
        const view = await engine.diagram.write(id, draft, revision.current);
        revision.current = view.revision;
        saved.current = draft;
        setError(null);
        setStatus(latest.current === draft ? "saved" : "unsaved");
      } catch (thrown) {
        if (thrown instanceof EngineFailure && thrown.kind === "Conflict") {
          conflicted.current = true;
          setStatus("conflict");
          return;
        }
        setStatus("unsaved");
        setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
        throw thrown;
      }
      // Changed while that was being written: write that too, so nothing waits behind it.
      if (latest.current !== draft) await run();
    };
    chain.current = chain.current.catch(() => undefined).then(run);
    return chain.current;
  }, [id]);

  useEffect(() => {
    if (!history) return;
    latest.current = history.present;
    if (history.present === saved.current) return;
    setStatus(conflicted.current ? "conflict" : "unsaved");
    if (conflicted.current) return;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush().catch(() => undefined), 600);
  }, [history, flush]);

  // Closing the library, or leaving this screen, writes what is waiting first.
  useEffect(() => {
    const release = holdUntilSaved(flush);
    return () => {
      release();
      void flush().catch(() => undefined);
    };
  }, [flush]);

  // ---- changing --------------------------------------------------------------------------

  const edit = useCallback((change: (d: DiagramEdit) => DiagramEdit) => {
    setHistory((h) => (h ? record(h, change(h.present)) : h));
    setNote(null);
  }, []);

  // Show a box's page beside the diagram — or, for a box with no page (or one that is gone),
  // let the right half ask what to do.
  const openBeside = (boxId: string) => {
    const found = draft?.nodes.find((b) => b.id === boxId);
    onBeside(boxId, found?.page && !isGone(found, titles) ? found.page : null);
  };

  // A page chosen beside the diagram for a box with none: write it into the diagram, once per
  // choice, as the same edit the panel's own "point this box at a page" makes.
  const linked = useRef(0);
  useEffect(() => {
    if (!link || link.n === linked.current) return;
    linked.current = link.n;
    edit((d) => setPage(d, link.box, link.page, titles.get(link.page) ?? GONE));
  }, [link, edit, titles]);

  const doUndo = useCallback(() => setHistory((h) => (h ? undo(h) : h)), []);
  const doRedo = useCallback(() => setHistory((h) => (h ? redo(h) : h)), []);

  // A selection that no longer exists — a box taken away, an undo — is no selection.
  const current = useMemo<Selected>(() => {
    if (!draft || !selected) return null;
    const there =
      selected.kind === "box"
        ? draft.nodes.some((n) => n.id === selected.id)
        : selected.index < draft.lines.length;
    return there ? selected : null;
  }, [draft, selected]);

  // ---- what the canvas shows -------------------------------------------------------------

  const arranged = useMemo(() => (draft ? arrange(draft, titles) : null), [draft, titles]);

  const wanted = useMemo<BoxNode[]>(() => {
    if (!draft || !arranged) return [];
    return draft.nodes.map((n) => {
      const at = arranged.boxes.get(n.id)!;
      return {
        id: n.id,
        type: "box",
        position: { x: at.x - at.w / 2, y: at.y - at.h / 2 },
        width: at.w,
        height: at.h,
        draggable: draft.layout === "free",
        selected: current?.kind === "box" && current.id === n.id,
        data: {
          text: boxText(n, titles),
          when: n.when,
          gone: isGone(n, titles),
          linked: n.page !== null,
          w: at.w,
          h: at.h,
        },
      };
    });
  }, [draft, arranged, titles, current]);

  const [nodes, setNodes, onNodesChange] = useNodesState<BoxNode>([]);
  useEffect(() => setNodes(wanted), [wanted, setNodes]);

  const edges = useMemo<Edge[]>(() => {
    if (!draft || !arranged) return [];
    return draft.lines.map((l, index) => {
      const from = arranged.boxes.get(l.from)!;
      const to = arranged.boxes.get(l.to)!;
      const at = sides(draft, from, to);
      return {
        id: `line-${index}`,
        source: l.from,
        target: l.to,
        sourceHandle: at.source,
        targetHandle: at.target,
        label: l.label ?? undefined,
        // Layers and branches are drawn as a tree grows: out, across and down. Only a free
        // diagram's lines are straight, because there they run where the person put the boxes.
        type: draft.layout === "free" ? "straight" : "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        selected: current?.kind === "line" && current.index === index,
        interactionWidth: 24,
      };
    });
  }, [draft, arranged, current]);

  // Fitted to the diagram when it opens, and when the way it is laid out changes. Not after
  // every edit: a picture that moves under the hand that is changing it is hard to work in.
  const loaded = draft !== null;
  const layout = draft?.layout;
  const direction = draft?.direction;
  useEffect(() => {
    if (!loaded) return;
    const frame = requestAnimationFrame(() => void flow.fitView({ padding: 0.25, duration: 0, maxZoom: 1.1 }));
    return () => cancelAnimationFrame(frame);
  }, [loaded, layout, direction, flow]);

  const onConnect: OnConnect = useCallback(
    (c) => {
      if (c.source && c.target) edit((d) => addLine(d, c.source, c.target));
    },
    [edit],
  );

  /** The middle of what is on screen, in the diagram's own space: where a new box goes. */
  const middle = useCallback(() => {
    const box = area.current?.getBoundingClientRect();
    if (!box) return undefined;
    return flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  }, [flow]);

  // ---- the picture -----------------------------------------------------------------------

  async function savePictureAs(kind: "svg" | "png") {
    if (!draft) return;
    setError(null);
    setNote(null);
    try {
      const path = await save({
        defaultPath: diagramPictureName(draft.title, kind),
        filters: [{ name: kind === "svg" ? "SVG picture" : "PNG picture", extensions: [kind] }],
      });
      if (path === null) return;
      const drawing = draw(draft, titles);
      const svg = toSvg(drawing);
      const data = kind === "svg" ? base64(svg) : await svgToPng(svg, drawing.width, drawing.height);
      await shell.savePicture(path, data);
      setNote(`Saved to ${path}`);
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  // ---- conflict --------------------------------------------------------------------------

  /** Take what is on disk now, and drop what was changed here. */
  const takeTheirs = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    load();
  }, [load]);

  /** Keep what was changed here, over what is on disk now. Only ever asked for by the person. */
  async function keepMine() {
    const mine = latest.current;
    if (!mine) return;
    try {
      const theirs = await engine.diagram.read(id);
      revision.current = theirs.revision;
      conflicted.current = false;
      saved.current = null;
      setStatus("unsaved");
      await flush();
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  // ---- keyboard --------------------------------------------------------------------------

  function onKeyDown(event: React.KeyboardEvent) {
    const typing = (event.target as HTMLElement).closest("input, textarea");
    if (typing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) doRedo();
      else doUndo();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      doRedo();
    }
  }

  if (error && !draft) {
    return (
      <div className="diagrams">
        <p className="error">{error}</p>
        <button className="secondary" onClick={onBack}>
          Back to diagrams
        </button>
      </div>
    );
  }
  if (!draft || !arranged) return null;

  if (deleting) {
    return (
      <DeleteDiagram
        id={id}
        title={draft.title}
        onDeleted={() => {
          // Nothing to write now: the file is gone, and a save would only say so.
          saved.current = latest.current;
          onDeleted();
        }}
        onCancel={() => setDeleting(false)}
      />
    );
  }

  const box = current?.kind === "box" ? draft.nodes.find((n) => n.id === current.id) : undefined;
  const line = current?.kind === "line" ? draft.lines[current.index] : undefined;
  const nameOf = (boxId: string) => {
    const found = draft.nodes.find((n) => n.id === boxId);
    return found ? boxText(found, titles) || "(empty box)" : "";
  };

  return (
    <div className="diagram-editor" onKeyDown={onKeyDown}>
      <div className="diagram-bar">
        <button className="ghost" onClick={() => void flush().catch(() => undefined).then(onBack)}>
          ← Diagrams
        </button>
        <h2>
          <RenameableName
            name={draft.title}
            label="diagram"
            onRename={(title) => edit((d) => setTitle(d, title))}
          />
        </h2>
        <button
          className="secondary"
          onClick={() => setPanelChoice({ beside: besideOpen, hidden: !panelHidden })}
        >
          {panelHidden ? "Show panel" : "Hide panel"}
        </button>
        <span className={`diagram-status ${status}`} role="status">
          {status === "saved" && "Saved"}
          {status === "saving" && "Saving…"}
          {status === "unsaved" && "Not saved yet"}
          {status === "conflict" && "Changed somewhere else"}
        </span>
      </div>

      {status === "conflict" && (
        <div className="diagram-conflict" role="alert">
          <p>
            This diagram was changed somewhere else — in a text editor, or on another computer —
            since you opened it. Nothing has been overwritten. Which one do you want?
          </p>
          <p className="actions">
            <button onClick={takeTheirs}>Use the changed one</button>
            <button className="secondary" onClick={() => void keepMine()}>
              Keep mine, over it
            </button>
          </p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {note && <p className="folder-note">{note}</p>}

      <div className="diagram-tools">
        <div className="diagram-layouts" role="radiogroup" aria-label="Layout">
          {LAYOUTS.map((l) => (
            <button
              key={l.value}
              role="radio"
              aria-checked={draft.layout === l.value}
              className={draft.layout === l.value ? "view selected" : "view"}
              title={l.hint}
              onClick={() => edit((d) => setLayout(d, l.value, titles))}
            >
              {l.label}
            </button>
          ))}
        </div>
        {draft.layout === "layered" && (
          <button
            className="secondary"
            title="Which way the layers run"
            onClick={() => edit((d) => setDirection(d, d.direction === "down" ? "right" : "down"))}
          >
            {draft.direction === "down" ? "Running down" : "Running right"}
          </button>
        )}
        <span className="diagram-sep" />
        <button
          onClick={() => {
            const made = addLabelBox(draft, "New box", draft.layout === "free" ? middle() : undefined);
            edit(() => made.diagram);
            setSelected({ kind: "box", id: made.id });
          }}
        >
          + Box
        </button>
        <button className="secondary" onClick={() => setPicking("add")}>
          + Page…
        </button>
        <span className="diagram-sep" />
        <button className="ghost" disabled={!history || history.past.length === 0} onClick={doUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button className="ghost" disabled={!history || history.future.length === 0} onClick={doRedo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
        {draft.layout === "free" && (
          <button
            className="ghost"
            title="Forget where the boxes were put and lay them out again"
            onClick={() => edit(arrangeAgain)}
          >
            Arrange again
          </button>
        )}
      </div>

      <div className={panelHidden ? "diagram-body no-panel" : "diagram-body"}>
        <div className="diagram-canvas" ref={area}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            colorMode="dark"
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            connectionMode={ConnectionMode.Loose}
            onNodeClick={(_, n) => {
              setSelected({ kind: "box", id: n.id });
              // While a page is beside the diagram, the box in focus is the one it shows.
              if (besideOpen) openBeside(n.id);
            }}
            onEdgeClick={(_, e) => setSelected({ kind: "line", index: Number(e.id.replace("line-", "")) })}
            onPaneClick={() => setSelected(null)}
            zoomOnDoubleClick={false}
            onNodeDoubleClick={(_, n) => {
              openBeside(n.id);
            }}
            onNodeDragStop={(_, __, dragged) => {
              edit((d) =>
                moveBoxes(
                  d,
                  new Map(
                    dragged.map((n) => [
                      n.id,
                      { x: n.position.x + (n.width ?? 0) / 2, y: n.position.y + (n.height ?? 0) / 2 },
                    ]),
                  ),
                ),
              );
            }}
            onNodesDelete={(gone) =>
              edit((d) => gone.reduce((next, n) => removeBox(next, n.id), d))
            }
            onEdgesDelete={(gone) =>
              edit((d) =>
                gone
                  .map((e) => Number(e.id.replace("line-", "")))
                  .sort((a, b) => b - a)
                  .reduce((next, index) => removeLine(next, index), d),
              )
            }
            deleteKeyCode={["Backspace", "Delete"]}
            nodesConnectable
            proOptions={{ hideAttribution: true }}
            minZoom={0.1}
            maxZoom={3}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
          {draft.nodes.length === 0 && (
            <p className="empty diagram-empty">
              An empty diagram. Add a box, or a page, and draw a line from one to another by
              dragging from its edge.
            </p>
          )}
        </div>

        {!panelHidden && (
        <div className="diagram-panel">
          {picking !== null && (
            <PagePicker
              pages={pages}
              title={picking === "add" ? "Add a box for a page" : "Point this box at a page"}
              onCancel={() => setPicking(null)}
              onChoose={(page) => {
                if (picking === "add") {
                  const made = addPageBox(draft, page, draft.layout === "free" ? middle() : undefined);
                  edit(() => made.diagram);
                  setSelected({ kind: "box", id: made.id });
                } else {
                  const target = picking.box;
                  edit((d) => setPage(d, target, page, titles.get(page) ?? GONE));
                }
                setPicking(null);
              }}
            />
          )}

          {box && (
            <section className="diagram-inspector" aria-label="The chosen box">
              <h3>Box</h3>
              <Field
                label="Says"
                value={box.label ?? ""}
                placeholder={box.page ? (titles.get(box.page) ?? GONE) : "What this box says"}
                onCommit={(text) => edit((d) => setLabel(d, box.id, text))}
              />
              {box.page ? (
                <p className="diagram-page">
                  Points at{" "}
                  <strong>{isGone(box, titles) ? "a page that is gone" : titles.get(box.page)}</strong>
                  <span className="actions">
                    {!isGone(box, titles) && (
                      <button className="secondary" onClick={() => openBeside(box.id)}>
                        Open the page
                      </button>
                    )}
                    <button className="secondary" onClick={() => setPicking({ box: box.id })}>
                      Another page…
                    </button>
                    <button
                      className="secondary"
                      onClick={() => edit((d) => setPage(d, box.id, null, boxText(box, titles)))}
                    >
                      Unlink
                    </button>
                  </span>
                </p>
              ) : (
                <p className="diagram-page">
                  Only a label.{" "}
                  <button className="secondary" onClick={() => setPicking({ box: box.id })}>
                    Point at a page…
                  </button>
                </p>
              )}
              {draft.layout === "timeline" && (
                <Field
                  label="When"
                  value={box.when ?? ""}
                  placeholder="1850, c. 1200, the late Bronze Age…"
                  onCommit={(text) => edit((d) => setWhen(d, box.id, text))}
                />
              )}
              {draft.layout === "layered" && (
                <p className="actions" role="group" aria-label="Place among its neighbours">
                  <button className="secondary" onClick={() => edit((d) => reorderBox(d, box.id, -1))}>
                    Earlier
                  </button>
                  <button className="secondary" onClick={() => edit((d) => reorderBox(d, box.id, 1))}>
                    Later
                  </button>
                </p>
              )}
              <p className="actions">
                <button className="danger" onClick={() => edit((d) => removeBox(d, box.id))}>
                  Delete the box
                </button>
              </p>
            </section>
          )}

          {line && current?.kind === "line" && (
            <section className="diagram-inspector" aria-label="The chosen line">
              <h3>Line</h3>
              <p>
                {nameOf(line.from)} → {nameOf(line.to)}
              </p>
              <Field
                label="Says"
                value={line.label ?? ""}
                placeholder="parent of, led to, connects to…"
                onCommit={(text) => edit((d) => setLineLabel(d, current.index, text))}
              />
              <p className="actions">
                <button className="secondary" onClick={() => edit((d) => reverseLine(d, current.index))}>
                  Reverse
                </button>
                <button className="danger" onClick={() => edit((d) => removeLine(d, current.index))}>
                  Delete the line
                </button>
              </p>
            </section>
          )}

          <section className="diagram-list" aria-label="Boxes and lines">
            <h3>
              Boxes <span className="quiet">{draft.nodes.length}</span>
            </h3>
            {draft.nodes.length === 0 ? (
              <p className="quiet">None yet.</p>
            ) : (
              <ul>
                {draft.nodes.map((n) => (
                  <li key={n.id}>
                    <button
                      className={current?.kind === "box" && current.id === n.id ? "ghost chosen" : "ghost"}
                      onClick={() => setSelected({ kind: "box", id: n.id })}
                    >
                      {isGone(n, titles) && <span title="Its page is gone">⚠ </span>}
                      {boxText(n, titles) || "(empty box)"}
                      {n.when && <span className="quiet"> · {n.when}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {draft.lines.length > 0 && (
              <>
                <h3>
                  Lines <span className="quiet">{draft.lines.length}</span>
                </h3>
                <ul>
                  {draft.lines.map((l, index) => (
                    <li key={`${l.from}:${l.to}:${index}`}>
                      <button
                        className={current?.kind === "line" && current.index === index ? "ghost chosen" : "ghost"}
                        onClick={() => setSelected({ kind: "line", index })}
                      >
                        {nameOf(l.from)} → {nameOf(l.to)}
                        {l.label && <span className="quiet"> · {l.label}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <div className="graph-save">
            <span className="quiet">Save as a picture</span>
            <button className="secondary" onClick={() => void savePictureAs("svg")}>
              SVG…
            </button>
            <button className="secondary" onClick={() => void savePictureAs("png")}>
              PNG…
            </button>
          </div>
          <p className="actions">
            <button className="ghost danger-text" onClick={() => setDeleting(true)}>
              Delete this diagram…
            </button>
          </p>
        </div>
        )}
      </div>
    </div>
  );
}

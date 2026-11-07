import { useEffect, useRef, useState } from "react";

import {
  engine,
  EngineFailure,
  shell,
  type EditionContents,
  type EditionKind,
  type ResegmentPlan,
  type Source,
  type Work,
  type WorkContents,
  type WorkEdition,
  type WorkRevision,
  type WorkUnit,
} from "../lib/engine";
import {
  editionName,
  LANGUAGES,
  longest,
  misaligned,
  misalignmentMessage,
  noteFor,
  repeatOf,
  repeatedBy,
  resegmentLines,
  rowCount,
  rowText,
  UNITS,
} from "../lib/works";
import { RenameableName } from "./RenameableName";

// A work: its editions lined up row by row — `parallel-texts.md`, on screen.
//
// The engine keeps the rows lined up and says when they are not; this shows them, lets a row
// be written, and offers the operations that keep or put the alignment right. Which editions
// show, the layout, and the panes hidden for practice are this window's and nobody else's —
// they are how somebody is reading today, not part of the text.

type Layout = "side" | "stacked" | "separate";

type Editing = { edition: string; row: number; text: string };

type Panel =
  | { kind: "add"; edition: Exclude<EditionKind, "original"> }
  | { kind: "edition"; edition: WorkEdition }
  | { kind: "remove-edition"; plan: EditionContents }
  | { kind: "resegment"; unit: WorkUnit; plan: ResegmentPlan | null }
  | { kind: "delete"; plan: WorkContents }
  | { kind: "note"; row: number; text: string }
  | { kind: "repeat"; row: number };

export function WorkView({
  initial,
  onBack,
  onDeleted,
}: {
  initial: Work;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [work, setWork] = useState<Work>(initial);
  const [hiddenPanes, setHiddenPanes] = useState<Set<string>>(new Set());
  const [practising, setPractising] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<Layout>("side");
  const [selected, setSelected] = useState<number | null>(null);
  // The rows, so a click anywhere else can put the row bar away.
  const rowsRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  // Scrolling separately: the pane a row was chosen in, which the others line up with.
  const columnsRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Clicking outside the rows, or Esc, closes the selected row and its tools: done with the
  // row, rather than only done writing it.
  useEffect(() => {
    function away(e: MouseEvent) {
      if (rowsRef.current && e.target instanceof Node && !rowsRef.current.contains(e.target)) {
        setSelected(null);
      }
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  // The panes this work was showing when it was last left, as this computer remembers them.
  // A choice made before the answer arrives wins; an edition no longer in the work is ignored.
  const panesChosen = useRef(false);
  useEffect(() => {
    let live = true;
    shell
      .remembered()
      .then((kept) => {
        if (!live || panesChosen.current) return;
        const hidden = kept.hidden_panes[initial.id] ?? [];
        setHiddenPanes(new Set(hidden.filter((id) => initial.editions.some((e) => e.id === id))));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [initial]);

  // Scrolling separately, choosing a row brings it level in every pane: each scrolls so the row
  // sits where it sits in the pane it was chosen in, which itself does not move.
  useEffect(() => {
    if (layout !== "separate" || selected === null || columnsRef.current === null) return;
    const columns = [...columnsRef.current.querySelectorAll<HTMLElement>(".column-rows")];
    const rowIn = (column: HTMLElement) =>
      column.querySelector<HTMLElement>(`[data-row="${selected}"]`);
    const lead = columns.find((c) => c.dataset.edition === anchor.current) ?? columns[0];
    const leadRow = lead ? rowIn(lead) : null;
    const at = lead && leadRow ? leadRow.offsetTop - lead.scrollTop : 0;
    for (const column of columns) {
      if (column === lead) continue;
      const row = rowIn(column);
      if (row) column.scrollTop = Math.max(0, row.offsetTop - at);
    }
  }, [layout, selected]);

  function togglePane(id: string) {
    panesChosen.current = true;
    const next = new Set(hiddenPanes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHiddenPanes(next);
    const kept = work.editions.map((e) => e.id).filter((e) => next.has(e));
    void shell.rememberHiddenPanes(work.id, kept).catch(() => {});
  }

  useEffect(() => {
    engine.source
      .list()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  /**
   * Run a change and show the work as it now is. A `Conflict` means a file of the work was
   * changed elsewhere — in a text editor, say — so it is read again rather than overwritten.
   */
  async function act(change: (revision: WorkRevision) => Promise<Work>, done?: string): Promise<boolean> {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      setWork(await change(work.revision));
      if (done) setNote(done);
      return true;
    } catch (thrown) {
      if (thrown instanceof EngineFailure && thrown.kind === "Conflict") {
        try {
          setWork(await engine.work.read(work.id));
        } catch {
          // Reading again failed too; the message below still says what happened.
        }
        setError(
          "This work was changed on disk, perhaps in another program, so it has been read again. Make the change once more.",
        );
        setEditing(null);
      } else {
        setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function ask<T>(question: () => Promise<T>, then: (answer: T) => void) {
    setError(null);
    try {
      then(await question());
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  function save() {
    if (!editing) return;
    const { edition, row, text } = editing;
    const before = rowText(work.editions.find((e) => e.id === edition)?.rows[row - 1]);
    setEditing(null);
    if (text === before) return;
    void act((rev) => engine.work.writeRow(work.id, edition, row, text, rev));
  }

  const visible = work.editions.filter((e) => !hiddenPanes.has(e.id));
  const unaligned = misaligned(work);
  const rows = longest({ ...work, editions: visible.length > 0 ? visible : work.editions });
  const original = work.editions.find((e) => e.kind === "original");

  function cell(edition: WorkEdition, row: number) {
    const lines = edition.rows[row - 1];
    const key = `${edition.id}:${row}`;
    const isEditing = editing?.edition === edition.id && editing.row === row;
    const hidden = practising.has(edition.id) && !revealed.has(key);
    const classes = ["work-cell"];
    // How a text is said is set apart from what it says, so the eye finds each.
    if (edition.kind === "pronunciation") classes.push("pronunciation");
    if (unaligned.has(edition.id)) classes.push("unaligned");
    if (lines === undefined) classes.push("beyond");
    if (hidden) classes.push("practising");

    if (isEditing) {
      return (
        <div className={classes.join(" ")} key={key}>
          <CellEditor
            value={editing.text}
            onChange={(text) => setEditing({ ...editing, text })}
            onSave={save}
            onCancel={() => {
              setEditing(null);
              setSelected(null);
            }}
            label={`${editionName(edition)}, row ${row}`}
          />
        </div>
      );
    }
    return (
      <button
        type="button"
        className={classes.join(" ")}
        key={key}
        aria-label={`${editionName(edition)}, row ${row}${hidden ? ", hidden" : ""}`}
        title={hidden ? "Click to reveal this row" : undefined}
        onClick={() => {
          setSelected(row);
          if (hidden) {
            setRevealed((was) => new Set(was).add(key));
            return;
          }
          if (lines === undefined) return;
          setEditing({ edition: edition.id, row, text: rowText(lines) });
        }}
      >
        {/* Hidden to practise: nothing drawn, so there is nothing to read through. */}
        {hidden ? null : lines === undefined ? (
          <span className="beyond-end">—</span>
        ) : lines.length === 0 ? (
          <span className="empty-row" title="Deliberately empty — a ~ in the file">
            empty
          </span>
        ) : (
          lines.map((line, i) => (
            <span key={i} className={i === 0 ? "line" : "line joined"}>
              {line || " "}
            </span>
          ))
        )}
      </button>
    );
  }

  function rowMarks(row: number) {
    const of = repeatOf(work, row);
    const by = repeatedBy(work, row);
    const hasNote = noteFor(work, row) !== null;
    return (
      <span className="row-marks">
        <span className="row-number">{row}</span>
        {of !== null && (
          <span className="mark repeat" title={`The same text as row ${of}`}>
            = {of}
          </span>
        )}
        {by > 0 && (
          <span className="mark repeat" title={`Repeated ${by} time${by === 1 ? "" : "s"} later`}>
            ×{by + 1}
          </span>
        )}
        {hasNote && (
          <span className="mark note" title={noteFor(work, row) ?? ""}>
            note
          </span>
        )}
      </span>
    );
  }

  function paneHead(e: WorkEdition) {
    const at = work.editions.findIndex((x) => x.id === e.id) + 1;
    return (
      <PaneHead
        key={e.id}
        edition={e}
        unaligned={unaligned.has(e.id)}
        practising={practising.has(e.id)}
        onPractise={() => {
          setPractising((was) => {
            const next = new Set(was);
            if (next.has(e.id)) next.delete(e.id);
            else next.add(e.id);
            return next;
          });
          setRevealed(new Set());
        }}
        onEdit={() => setPanel({ kind: "edition", edition: e })}
        onMove={(by) => void act((rev) => engine.work.moveEdition(work.id, e.id, at + by, rev))}
        first={at === 1}
        last={at === work.editions.length}
        busy={busy}
      />
    );
  }

  const editingEdition = editing ? work.editions.find((e) => e.id === editing.edition) : null;
  // Words typed and not yet saved. The tools that move rows wait for them, rather than
  // throwing them away.
  const unsaved =
    editing !== null &&
    editingEdition !== null &&
    editingEdition !== undefined &&
    editing.text !== rowText(editingEdition.rows[editing.row - 1]);

  /** What can be done at the selected row: across every edition, and in the one being edited. */
  function rowTools(row: number) {
    return (
      <div
        className="row-tools"
        role="toolbar"
        aria-label={`Row ${row}`}
        // Pressing a tool must not take focus from the row being written: losing it closes the
        // editor, and with it the tools for that edition, before the click arrives.
        onMouseDown={(e) => e.preventDefault()}
      >
        <span className="tools-label">Row {row}:</span>
        <button className="ghost" disabled={busy} onClick={() => void act((rev) => engine.work.insertRow(work.id, row, rev))}>
          Add a row above
        </button>
        <button className="ghost" disabled={busy} onClick={() => void act((rev) => engine.work.insertRow(work.id, row + 1, rev))}>
          Add a row below
        </button>
        {row <= rowCount(work) && (
          <>
            <button className="ghost" disabled={busy} onClick={() => setPanel({ kind: "note", row, text: noteFor(work, row) ?? "" })}>
              {noteFor(work, row) === null ? "Add a note" : "Edit the note"}
            </button>
            <button className="ghost" disabled={busy || row < 2} onClick={() => setPanel({ kind: "repeat", row })}>
              {repeatOf(work, row) === null ? "Same text as…" : "Repeat…"}
            </button>
          </>
        )}
        {editing && editingEdition && editing.row === row && (
          <>
            <span className="tools-label">
              In {editionName(editingEdition)}
              {unsaved ? " — press Enter to save first" : ":"}
            </span>
            <button
              className="ghost"
              disabled={busy || unsaved}
              title="Put a deliberately empty row here, moving this edition's later rows down"
              onClick={() => {
                setEditing(null);
                void act((rev) => engine.work.markEmpty(work.id, editingEdition.id, row, rev));
              }}
            >
              Mark empty here
            </button>
            <button
              className="ghost"
              disabled={busy || unsaved || row < 2}
              title="Make this row part of the row above, moving this edition's later rows up"
              onClick={() => {
                setEditing(null);
                void act((rev) => engine.work.join(work.id, editingEdition.id, row, rev));
              }}
            >
              Join to the row above
            </button>
            {(() => {
              // Two lines can only split one way, so it stays one button. More, and the
              // question is where: everything from the chosen line on becomes the next row.
              const lines = editingEdition.rows[row - 1] ?? [];
              const split = (line: number) => {
                setEditing(null);
                void act((rev) => engine.work.split(work.id, editingEdition.id, row, line, rev));
              };
              if (lines.length <= 2) {
                return (
                  <button
                    className="ghost"
                    disabled={busy || unsaved || lines.length < 2}
                    title="Make this row's last line a row of its own, moving this edition's later rows down"
                    onClick={() => split(2)}
                  >
                    Split off the last line
                  </button>
                );
              }
              // Buttons rather than a list to choose from: the tools must not take focus from
              // the row being written, and a list box cannot open without taking it.
              return (
                <span className="split-at" role="group" aria-label="Split before line">
                  <span className="tools-label">Split before line</span>
                  {lines.slice(1).map((text, i) => (
                    <button
                      key={i + 2}
                      className="ghost"
                      disabled={busy || unsaved}
                      aria-label={`Split before line ${i + 2}`}
                      title={`A new row from line ${i + 2}: ${opening(text)}`}
                      onClick={() => split(i + 2)}
                    >
                      {i + 2}
                    </button>
                  ))}
                </span>
              );
            })()}
            <button
              className="ghost danger-text"
              disabled={busy || unsaved}
              title="Remove this row from every edition — only while no other edition has text in it"
              onClick={() => {
                setEditing(null);
                void act((rev) => engine.work.removeRow(work.id, editingEdition.id, row, rev));
              }}
            >
              Remove the row
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="work-view">
      <header className="work-head">
        <button className="ghost back" onClick={onBack} title="Back to the list of works">
          ← Works
        </button>
        <h2>
          <RenameableName
            name={work.title}
            label="work"
            onRename={(title) =>
              void act((rev) => engine.work.update(work.id, title, work.sources, rev))
            }
          />
        </h2>
        <span className="unit">
          {UNITS.find((u) => u.value === work.unit)?.label ?? work.unit} · {rowCount(work)} row
          {rowCount(work) === 1 ? "" : "s"}
        </span>
      </header>

      <div className="work-actions row">
        <button className="secondary" onClick={() => setPanel({ kind: "add", edition: "translation" })}>
          Add translation
        </button>
        <button className="secondary" onClick={() => setPanel({ kind: "add", edition: "pronunciation" })}>
          Add pronunciation
        </button>
        <button className="ghost" onClick={() => setPanel({ kind: "resegment", unit: work.unit, plan: null })}>
          Divide differently…
        </button>
        <button
          className="ghost danger-text"
          onClick={() => void ask(() => engine.work.deletePlan(work.id), (plan) => setPanel({ kind: "delete", plan }))}
        >
          Delete work…
        </button>
      </div>

      <WorkSources
        work={work}
        sources={sources}
        busy={busy}
        onChange={(ids) => void act((rev) => engine.work.update(work.id, work.title, ids, rev))}
      />

      <div className="panes-bar" role="group" aria-label="What to show">
        <span className="tools-label">Show:</span>
        {work.editions.map((e) => (
          <label key={e.id} className="pane-toggle">
            <input
              type="checkbox"
              checked={!hiddenPanes.has(e.id)}
              onChange={() => togglePane(e.id)}
            />
            {editionName(e)}
          </label>
        ))}
        <span className="layout-switch" role="radiogroup" aria-label="Layout">
          <button className={layout === "side" ? "view selected" : "view"} onClick={() => setLayout("side")}>
            Side by side
          </button>
          <button className={layout === "stacked" ? "view selected" : "view"} onClick={() => setLayout("stacked")}>
            Stacked
          </button>
          <button
            className={layout === "separate" ? "view selected" : "view"}
            onClick={() => setLayout("separate")}
            title="Each pane scrolls on its own, for long prose; choosing a row lines the others up with it"
          >
            Scroll separately
          </button>
        </span>
      </div>

      {error && <p className="error">{error}</p>}
      {note && (
        <p className="folder-note" role="status">
          {note}
        </p>
      )}
      {work.misalignments.map((m) => (
        <p className="warning misaligned" key={m.edition} role="alert">
          {misalignmentMessage(work, m.edition)}
        </p>
      ))}
      {work.editions
        .filter((e) => e.missing)
        .map((e) => (
          <p className="warning" key={`missing:${e.id}`}>
            The file for {editionName(e)} is missing from the work's folder.
          </p>
        ))}

      {panel && (
        <WorkPanel
          panel={panel}
          work={work}
          sources={sources}
          busy={busy}
          onClose={() => setPanel(null)}
          onPanel={setPanel}
          act={act}
          ask={ask}
          onDeleted={onDeleted}
        />
      )}

      {layout === "side" ? (
        <div
          ref={rowsRef}
          className="work-grid"
          style={{ gridTemplateColumns: `3.4rem repeat(${Math.max(visible.length, 1)}, minmax(10rem, 1fr))` }}
        >
          <div className="work-corner" />
          {visible.map(paneHead)}
          {Array.from({ length: rows }, (_, i) => i + 1).map((row) => (
            <div className={`work-row${selected === row ? " selected" : ""}`} key={row} style={{ display: "contents" }}>
              {rowMarks(row)}
              {visible.map((e) => cell(e, row))}
              {selected === row && <div className="row-tools-wrap" style={{ gridColumn: "1 / -1" }}>{rowTools(row)}</div>}
            </div>
          ))}
        </div>
      ) : layout === "separate" ? (
        <div className="work-separate" ref={rowsRef}>
          {selected !== null && <div className="row-tools-wrap">{rowTools(selected)}</div>}
          <div
            className="work-columns"
            ref={columnsRef}
            style={{ gridTemplateColumns: `repeat(${Math.max(visible.length, 1)}, minmax(10rem, 1fr))` }}
          >
            {visible.map((e) => (
              <div className="work-column" key={e.id}>
                {paneHead(e)}
                <div
                  className="column-rows"
                  data-edition={e.id}
                  onClickCapture={() => {
                    anchor.current = e.id;
                  }}
                >
                  {Array.from({ length: rows }, (_, i) => i + 1).map((row) => (
                    <div className={`column-row${selected === row ? " selected" : ""}`} key={row} data-row={row}>
                      <span className="row-marks">
                        <span className="row-number">{row}</span>
                      </span>
                      {cell(e, row)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="work-stacked" ref={rowsRef}>
          <div className="stacked-heads">{visible.map(paneHead)}</div>
          {Array.from({ length: rows }, (_, i) => i + 1).map((row) => (
            <div className={`stacked-row${selected === row ? " selected" : ""}`} key={row}>
              {rowMarks(row)}
              <div className="stacked-cells">
                {visible.map((e) => (
                  <div key={e.id} className={e.id === original?.id ? "stacked-cell lead" : "stacked-cell"}>
                    {cell(e, row)}
                  </div>
                ))}
              </div>
              {selected === row && rowTools(row)}
            </div>
          ))}
        </div>
      )}

      {rows === 0 && (
        <div className="row">
          <button onClick={() => void act((rev) => engine.work.insertRow(work.id, 1, rev))}>Add the first row</button>
        </div>
      )}
    </div>
  );
}

/** A row being written. Enter saves; Shift+Enter starts a new line within the row. */
function CellEditor({
  value,
  onChange,
  onSave,
  onCancel,
  label,
}: {
  value: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <textarea
      ref={ref}
      className="cell-editor"
      aria-label={label}
      value={value}
      rows={Math.max(1, value.split("\n").length)}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSave}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSave();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

function PaneHead({
  edition,
  unaligned,
  practising,
  onPractise,
  onEdit,
  onMove,
  first,
  last,
  busy,
}: {
  edition: WorkEdition;
  unaligned: boolean;
  practising: boolean;
  onPractise: () => void;
  onEdit: () => void;
  /** -1 a place to the left, +1 a place to the right. */
  onMove: (by: -1 | 1) => void;
  first: boolean;
  last: boolean;
  busy: boolean;
}) {
  return (
    <div className={unaligned ? "pane-head unaligned" : "pane-head"}>
      <strong title={unaligned ? "Not lined up with the original" : undefined}>
        {unaligned && "⚠ "}
        {editionName(edition)}
      </strong>
      <span className="pane-buttons">
        <button
          className="ghost"
          onClick={() => onMove(-1)}
          disabled={busy || first}
          aria-label={`Move ${editionName(edition)} left`}
          title="Move this pane a place to the left"
        >
          ‹
        </button>
        <button
          className="ghost"
          onClick={() => onMove(1)}
          disabled={busy || last}
          aria-label={`Move ${editionName(edition)} right`}
          title="Move this pane a place to the right"
        >
          ›
        </button>
        <button
          className="ghost"
          onClick={onPractise}
          title={practising ? "Show this pane again" : "Hide this pane's text to test yourself; click a row to reveal it"}
        >
          {practising ? "Show" : "Hide"}
        </button>
        <button className="ghost" onClick={onEdit} title="Who it is by, how it is written, or remove it">
          …
        </button>
      </span>
    </div>
  );
}

function WorkSources({
  work,
  sources,
  busy,
  onChange,
}: {
  work: Work;
  sources: Source[];
  busy: boolean;
  onChange: (ids: string[]) => void;
}) {
  const cited = work.sources
    .map((id) => sources.find((s) => s.id === id))
    .filter((s): s is Source => s !== undefined);
  const others = sources.filter((s) => s.id !== null && !work.sources.includes(s.id));
  return (
    <div className="work-sources">
      <span className="tools-label">Sources:</span>
      {cited.length === 0 && <span className="hint">none cited</span>}
      {cited.map((s) => (
        <span className="chip" key={s.id}>
          {s.title}
          <button
            className="ghost"
            aria-label={`Stop citing ${s.title}`}
            disabled={busy}
            onClick={() => onChange(work.sources.filter((id) => id !== s.id))}
          >
            ×
          </button>
        </span>
      ))}
      {others.length > 0 && (
        <select
          aria-label="Cite a source"
          value=""
          disabled={busy}
          onChange={(e) => {
            if (e.target.value) onChange([...work.sources, e.target.value]);
          }}
        >
          <option value="">Cite a source…</option>
          {others.map((s) => (
            <option key={s.id} value={s.id ?? ""}>
              {s.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** The questions a work asks one at a time: a new edition, an edition's details, a note,
 * a repeat, dividing again, and the two deletions. */
function WorkPanel({
  panel,
  work,
  sources,
  busy,
  onClose,
  onPanel,
  act,
  ask,
  onDeleted,
}: {
  panel: Panel;
  work: Work;
  sources: Source[];
  busy: boolean;
  onClose: () => void;
  onPanel: (panel: Panel) => void;
  act: (change: (revision: WorkRevision) => Promise<Work>, done?: string) => Promise<boolean>;
  ask: <T>(question: () => Promise<T>, then: (answer: T) => void) => Promise<void>;
  onDeleted: () => void;
}) {
  switch (panel.kind) {
    case "add":
      return (
        <EditionForm
          kind={panel.edition}
          sources={sources}
          busy={busy}
          onCancel={onClose}
          onAdd={(edition, text) =>
            void act((rev) => engine.work.addEdition(work.id, edition, text, rev)).then((ok) => ok && onClose())
          }
        />
      );
    case "edition": {
      const e = panel.edition;
      return (
        <EditionDetails
          edition={e}
          sources={sources}
          busy={busy}
          onCancel={onClose}
          onSave={(language, label, scheme, source) =>
            void act((rev) => engine.work.updateEdition(work.id, e.id, language, label, scheme, source, rev)).then((ok) => ok && onClose())
          }
          onRemove={
            e.kind === "original"
              ? null
              : () =>
                  void ask(
                    () => engine.work.removeEditionPlan(work.id, e.id),
                    (plan) => onPanel({ kind: "remove-edition", plan }),
                  )
          }
        />
      );
    }
    case "remove-edition":
      return (
        <div className="confirm">
          <h3>Remove {panel.plan.name}?</h3>
          <p>
            Its file is deleted, with the text in its {panel.plan.rows_with_text} row
            {panel.plan.rows_with_text === 1 ? "" : "s"} that have any. The other editions stay as
            they are.
          </p>
          <div className="row">
            <button className="secondary" onClick={onClose} disabled={busy}>
              Keep it
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                void act((rev) => engine.work.removeEdition(work.id, panel.plan.edition, rev), `Removed ${panel.plan.name}.`).then((ok) => ok && onClose())
              }
            >
              Remove
            </button>
          </div>
        </div>
      );
    case "note":
      return (
        <div className="confirm note-panel">
          <h3>Note on row {panel.row}</h3>
          <textarea
            autoFocus
            aria-label={`Note on row ${panel.row}`}
            value={panel.text}
            rows={4}
            onChange={(e) => onPanel({ ...panel, text: e.target.value })}
          />
          <small className="hint">A grammar point, a word to look up. Empty removes the note.</small>
          <div className="row">
            <button
              disabled={busy}
              onClick={() => void act((rev) => engine.work.setNote(work.id, panel.row, panel.text, rev)).then((ok) => ok && onClose())}
            >
              Save note
            </button>
            <button className="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      );
    case "repeat":
      return <RepeatPanel row={panel.row} work={work} busy={busy} onClose={onClose} act={act} />;
    case "resegment":
      return (
        <div className="confirm">
          <h3>Divide the text differently</h3>
          <div role="radiogroup" aria-label="Divide by">
            {UNITS.map((u) => (
              <label className="choice" key={u.value}>
                <input
                  type="radio"
                  name="resegment-unit"
                  checked={panel.unit === u.value}
                  onChange={() => onPanel({ kind: "resegment", unit: u.value, plan: null })}
                />
                <span>
                  <strong>{u.label}</strong>
                  {u.hint}
                </span>
              </label>
            ))}
          </div>
          {panel.plan && (
            <div className="resegment-plan" role="status">
              <ul>
                {resegmentLines(panel.plan, work).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {panel.plan.notes_moved.length > 0 && (
                <p className="warning">
                  {panel.plan.notes_moved.length} note
                  {panel.plan.notes_moved.length === 1 ? " is" : "s are"} on rows whose words move.
                  They are kept in the library's <code>.conflicts</code> folder.
                </p>
              )}
              {panel.plan.repeats_dropped.length > 0 && (
                <p className="warning">
                  {panel.plan.repeats_dropped.length} repeat
                  {panel.plan.repeats_dropped.length === 1 ? "" : "s"} will need marking again.
                </p>
              )}
            </div>
          )}
          <div className="row">
            {panel.plan === null ? (
              <button
                disabled={busy}
                onClick={() =>
                  void ask(
                    () => engine.work.resegmentPlan(work.id, panel.unit),
                    (plan) => onPanel({ ...panel, plan }),
                  )
                }
              >
                Show what changes
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const done = await engine.work.resegment();
                    return done.work;
                  }, "Divided again.").then((ok) => ok && onClose())
                }
              >
                Divide it
              </button>
            )}
            <button className="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      );
    case "delete":
      return (
        <div className="confirm delete-confirm">
          <h3>Delete “{panel.plan.title}”?</h3>
          <p>Its whole folder goes, with every edition:</p>
          <ul>
            {panel.plan.editions.map((e) => (
              <li key={e.edition}>
                {e.name} — {e.rows_with_text} row{e.rows_with_text === 1 ? "" : "s"} of text
              </li>
            ))}
          </ul>
          {panel.plan.notes > 0 && (
            <p>
              And {panel.plan.notes} note{panel.plan.notes === 1 ? "" : "s"}.
            </p>
          )}
          <div className="row">
            <button className="secondary" onClick={onClose} disabled={busy}>
              Keep it
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                void ask(
                  () => engine.work.delete(work.id),
                  () => onDeleted(),
                )
              }
            >
              Delete
            </button>
          </div>
        </div>
      );
  }
}

function RepeatPanel({
  row,
  work,
  busy,
  onClose,
  act,
}: {
  row: number;
  work: Work;
  busy: boolean;
  onClose: () => void;
  act: (change: (revision: WorkRevision) => Promise<Work>, done?: string) => Promise<boolean>;
}) {
  const [of, setOf] = useState<number | null>(repeatOf(work, row));
  const original = work.editions.find((e) => e.kind === "original");
  return (
    <div className="confirm">
      <h3>Row {row}: the same text as an earlier row?</h3>
      <p className="hint">
        A chorus, say. The two rows then share their text in every edition: write one and the
        other follows.
      </p>
      <select
        aria-label="The same text as row"
        value={of ?? ""}
        onChange={(e) => setOf(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">Not a repeat</option>
        {Array.from({ length: row - 1 }, (_, i) => i + 1).map((r) => (
          <option key={r} value={r}>
            Row {r}: {rowText(original?.rows[r - 1]).split("\n")[0]}
          </option>
        ))}
      </select>
      <div className="row">
        <button
          disabled={busy}
          onClick={() =>
            void act(
              async (rev) => (await engine.work.setRepeat(work.id, row, of, rev)).work,
              of === null
                ? `Row ${row} is no longer a repeat.`
                : `Row ${row} now shares its text with row ${of}.`,
            ).then((ok) => ok && onClose())
          }
        >
          Save
        </button>
        <button className="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function LanguagePicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const known = LANGUAGES.some((l) => l.code === value);
  const [other, setOther] = useState(!known && value !== "");
  return (
    <span className="language-picker">
      <select
        aria-label="Language"
        value={other ? "other" : value}
        onChange={(e) => {
          if (e.target.value === "other") {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
        <option value="other">Other…</option>
      </select>
      {other && (
        <input
          aria-label="Language code"
          placeholder="a code, such as hy or zh-Hant"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
        />
      )}
    </span>
  );
}

/** A line's first few words, enough to tell lines apart in a list. */
function opening(line: string): string {
  const words = line.trim().split(/\s+/);
  return words.length > 6 ? `${words.slice(0, 6).join(" ")}…` : line.trim() || "(blank)";
}

export { LanguagePicker };

function EditionForm({
  kind,
  sources,
  busy,
  onCancel,
  onAdd,
}: {
  kind: "translation" | "pronunciation";
  sources: Source[];
  busy: boolean;
  onCancel: () => void;
  onAdd: (
    edition: { kind: EditionKind; language: string; label: string | null; scheme: string | null; source: string | null },
    text: string,
  ) => void;
}) {
  const [language, setLanguage] = useState(kind === "pronunciation" ? "ru" : "fi");
  const [label, setLabel] = useState("");
  const [scheme, setScheme] = useState("");
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  return (
    <div className="confirm edition-form">
      <h3>{kind === "translation" ? "Add a translation" : "Add a pronunciation"}</h3>
      <label className="field">
        <span>{kind === "translation" ? "Translated into" : "Language it is the pronunciation of"}</span>
        <LanguagePicker value={language} onChange={setLanguage} />
      </label>
      {kind === "pronunciation" && (
        <label className="field">
          <span>Written in a scheme (optional)</span>
          <input value={scheme} placeholder="bgn-pcgn, iso-9, my own…" onChange={(e) => setScheme(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span>Label (optional)</span>
        <input value={label} placeholder="Whose translation, which year: Leino 1921" onChange={(e) => setLabel(e.target.value)} />
      </label>
      <SourceSelect sources={sources} value={source} onChange={setSource} />
      <label className="field">
        <span>Text (optional)</span>
        <textarea
          rows={6}
          value={text}
          placeholder="Paste it here to divide it like the original — or leave it empty and write it row by row."
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="row">
        <button
          disabled={busy || language === ""}
          onClick={() =>
            onAdd(
              {
                kind,
                language,
                label: label.trim() || null,
                scheme: kind === "pronunciation" ? scheme.trim() || null : null,
                source: source || null,
              },
              text,
            )
          }
        >
          Add
        </button>
        <button className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditionDetails({
  edition,
  sources,
  busy,
  onCancel,
  onSave,
  onRemove,
}: {
  edition: WorkEdition;
  sources: Source[];
  busy: boolean;
  onCancel: () => void;
  onSave: (language: string, label: string | null, scheme: string | null, source: string | null) => void;
  onRemove: (() => void) | null;
}) {
  const [language, setLanguage] = useState(edition.language);
  const [label, setLabel] = useState(edition.label ?? "");
  const [scheme, setScheme] = useState(edition.scheme ?? "");
  const [source, setSource] = useState(edition.source ?? "");
  return (
    <div className="confirm edition-form">
      <h3>{editionName(edition)}</h3>
      {/* The same question as when it was added, so a wrong language can be put right. */}
      <label className="field">
        <span>
          {edition.kind === "translation"
            ? "Translated into"
            : edition.kind === "pronunciation"
              ? "Language it is the pronunciation of"
              : "Language"}
        </span>
        <LanguagePicker value={language} onChange={setLanguage} />
      </label>
      <label className="field">
        <span>Label (optional)</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      {edition.kind === "pronunciation" && (
        <label className="field">
          <span>Scheme (optional)</span>
          <input value={scheme} onChange={(e) => setScheme(e.target.value)} />
        </label>
      )}
      <SourceSelect sources={sources} value={source} onChange={setSource} />
      <div className="row">
        <button
          disabled={busy || language.trim() === ""}
          onClick={() =>
            onSave(language.trim(), label.trim() || null, edition.kind === "pronunciation" ? scheme.trim() || null : null, source || null)
          }
        >
          Save
        </button>
        <button className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        {onRemove && (
          <button className="ghost danger-text" onClick={onRemove} disabled={busy}>
            Remove this edition…
          </button>
        )}
      </div>
    </div>
  );
}

function SourceSelect({
  sources,
  value,
  onChange,
}: {
  sources: Source[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="field">
      <span>Where this version came from (optional)</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No source</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id ?? ""}>
            {s.title}
          </option>
        ))}
      </select>
    </label>
  );
}

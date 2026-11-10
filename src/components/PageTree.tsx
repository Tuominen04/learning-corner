import { createContext, useContext, useState } from "react";

import type { Deleting } from "./DeleteConfirm";
import { RenameableName } from "./RenameableName";
import type { Page } from "../lib/engine";
import {
  canMove,
  findMoving,
  nameOf,
  spotNear,
  stepped,
  whyNot,
  type Moving,
  type Spot,
} from "../lib/moving";

// The sidebar mirrors the folders on disk, because the folders on disk mirror this: every page
// is a file, and the pages under it are in a folder named like it, beside it (ADR 0009).
//
// A page moves four ways, for four kinds of habit: dragged — onto a page to go under it, onto
// its top or bottom edge to go before or after it, onto the heading for the top level; picked up
// with Ctrl+X (or Ctrl+C) and put down with Ctrl+V under the page that has focus; nudged up or
// down among its siblings with Alt+↑ and Alt+↓; or the move button, which asks where. All but
// the last act at once, and the moment after says what happened, with an Undo.

/** Where over a row a drop would land. */
type Where = "before" | "after" | "under";

/** How the rows take part in a move: what is held or dragged, and what it is over. */
type Moves = {
  dragged: Moving | null;
  held: Moving | null;
  /** The row a drop would land on and how, or `top` for the heading — only while it would take it. */
  over: { target: string; where: Where } | "top" | null;
  startDrag: (what: Moving) => void;
  endDrag: () => void;
  ask: (what: Moving) => void;
};

const MoveContext = createContext<Moves | null>(null);

function useMoves(): Moves {
  const moves = useContext(MoveContext);
  if (!moves) throw new Error("a tree row outside its tree");
  return moves;
}

/** The page row an element is in, and where over it the pointer is: its edges or its middle. */
function rowAt(event: React.DragEvent): { target: string; where: Where } | "top" | undefined {
  const element = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(
    "[data-page-row], [data-top]",
  );
  if (!element) return undefined;
  if (element.dataset["top"] !== undefined) return "top";
  const target = element.dataset["pageRow"];
  if (!target) return undefined;
  const box = element.getBoundingClientRect();
  const y = event.clientY - box.top;
  const where: Where = y < box.height * 0.28 ? "before" : y > box.height * 0.72 ? "after" : "under";
  return { target, where };
}

/** Whether a key press belongs to a box being typed in, where Ctrl+C means copy the text. */
function typing(target: EventTarget | null): boolean {
  return (target as HTMLElement | null)?.closest?.("input, textarea, [contenteditable]") != null;
}

/** The page whose row holds the element with focus, if any. */
function focusedPage(target: EventTarget | null): string | undefined {
  return (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-page-row]")?.dataset[
    "pageRow"
  ];
}

export function PageTree({
  pages,
  selected,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onMove,
  onMoveTo,
}: {
  pages: Page[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** A new page under `parent`, or at the top level for `null`. */
  onAdd: (parent: string | null) => void;
  onRename: (id: string, title: string) => void;
  /** Ask to delete a page. Never deletes anything itself — the confirmation does. */
  onDelete: (what: Deleting) => void;
  /** Ask where to move a page: the move button. */
  onMove: (what: Moving) => void;
  /** Move a page to a spot already chosen: a drop, Ctrl+V, or Alt+↑/↓. */
  onMoveTo: (what: Moving, to: Spot) => void;
}) {
  const [dragged, setDragged] = useState<Moving | null>(null);
  const [over, setOver] = useState<Moves["over"]>(null);
  const [held, setHeld] = useState<Moving | null>(null);
  // Why Ctrl+V did nothing, when it did nothing, so a refused paste is not a silent one.
  const [refused, setRefused] = useState<string | null>(null);

  const moves: Moves = {
    dragged,
    held,
    over,
    startDrag: (what) => {
      setDragged(what);
      setHeld(null);
    },
    endDrag: () => {
      setDragged(null);
      setOver(null);
    },
    ask: (what) => {
      setHeld(null);
      onMove(what);
    },
  };

  /** Where a drop at this event would put the page being dragged, if anywhere. */
  function spotFor(event: React.DragEvent, what: Moving): Spot | undefined {
    const at = rowAt(event);
    if (at === undefined) return undefined;
    const spot =
      at === "top"
        ? { parent: null, position: null }
        : spotNear(pages, what, at.target, at.where);
    return spot && canMove(pages, what, spot) ? spot : undefined;
  }

  function onDragOver(event: React.DragEvent) {
    if (!dragged) return;
    // Only a spot that would take it accepts the drop; everywhere else the pointer says no.
    if (!spotFor(event, dragged)) {
      if (over) setOver(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const at = rowAt(event);
    if (at === undefined) return;
    const same =
      at === "top"
        ? over === "top"
        : over !== null && over !== "top" && over.target === at.target && over.where === at.where;
    if (!same) setOver(at);
  }

  function onDrop(event: React.DragEvent) {
    if (!dragged) return;
    event.preventDefault();
    const what = dragged;
    const spot = spotFor(event, what);
    setDragged(null);
    setOver(null);
    if (spot) onMoveTo(what, spot);
  }

  function onDragLeave(event: React.DragEvent) {
    // Leaving the tree, not one row for the next.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (typing(event.target)) return;
    const key = event.key.toLowerCase();
    const command = event.ctrlKey || event.metaKey;

    if (event.altKey && (key === "arrowup" || key === "arrowdown")) {
      const id = focusedPage(event.target);
      const what = id ? findMoving(pages, id) : null;
      if (!what) return;
      event.preventDefault();
      const spot = stepped(pages, what, key === "arrowup" ? -1 : 1);
      if (spot) onMoveTo(what, spot);
    } else if (command && (key === "x" || key === "c")) {
      const id = focusedPage(event.target);
      const what = id ? findMoving(pages, id) : null;
      if (what) {
        event.preventDefault();
        setHeld(what);
        setRefused(null);
      }
    } else if (command && key === "v" && held) {
      const inTop = (event.target as HTMLElement).closest?.("[data-top]") != null;
      const parent = inTop ? null : focusedPage(event.target);
      if (parent === undefined) return;
      event.preventDefault();
      const spot: Spot = { parent, position: null };
      const reason = whyNot(pages, held, spot);
      if (reason) {
        setRefused(`It cannot go there: ${reason}.`);
      } else {
        setHeld(null);
        setRefused(null);
        onMoveTo(held, spot);
      }
    } else if (key === "escape" && held) {
      event.preventDefault();
      setHeld(null);
      setRefused(null);
    }
  }

  return (
    <MoveContext.Provider value={moves}>
      <nav
        className="tree"
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
      >
        <div className={over === "top" ? "tree-head drop-target" : "tree-head"} data-top="">
          <h2>Pages</h2>
          <button
            className="ghost"
            onClick={() => onAdd(null)}
            title="New page at the top level"
            aria-label="New page at the top level"
          >
            +
          </button>
        </div>
        {held && (
          <p className="holding" role="status">
            Moving “{nameOf(held)}”. Select the page it goes under and press <kbd>Ctrl</kbd>+
            <kbd>V</kbd>, or <kbd>Esc</kbd> to leave it where it is.
            {refused && <span className="warning"> {refused}</span>}
          </p>
        )}
        {pages.length === 0 ? (
          <p className="empty">
            No pages yet. Start one for the question you actually have, and put what it says in
            brief at the top; the pages under it can come later.
          </p>
        ) : (
          <ul>
            {pages.map((page) => (
              <PageBranch
                key={page.id}
                page={page}
                selected={selected}
                onSelect={onSelect}
                onAdd={onAdd}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </nav>
    </MoveContext.Provider>
  );
}

function PageBranch({
  page,
  selected,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: {
  page: Page;
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd: (parent: string | null) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (what: Deleting) => void;
}) {
  const moves = useMoves();
  const self: Moving = { id: page.id, title: page.title };
  const overHere = moves.over !== null && moves.over !== "top" && moves.over.target === page.id;

  const rowClass = [
    "doc-row",
    "page-row",
    page.children.length > 0 && "has-children",
    moves.dragged?.id === page.id && "dragging",
    moves.held?.id === page.id && "held",
    overHere && moves.over !== "top" && moves.over?.where === "under" && "drop-target",
    overHere && moves.over !== "top" && moves.over?.where === "before" && "drop-before",
    overHere && moves.over !== "top" && moves.over?.where === "after" && "drop-after",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="page">
      {/* A row rather than a bare button, because the name and the pencil are two controls and
          a button cannot contain another one. */}
      <div
        className={rowClass}
        data-page-row={page.id}
        draggable
        onDragStart={(event) => startDragging(event, self, moves)}
        onDragEnd={moves.endDrag}
      >
        <RenameableName
          name={page.title}
          label="page"
          selected={page.id === selected}
          onSelect={() => onSelect(page.id)}
          onRename={(title) => onRename(page.id, title)}
        />
        <button
          className="ghost add"
          title="New page under this one"
          aria-label={`New page under ${page.title}`}
          onClick={() => onAdd(page.id)}
        >
          +
        </button>
        <button
          className="ghost move"
          title="Move this page"
          aria-label="Move this page"
          onClick={() => moves.ask(self)}
        >
          <Arrows />
        </button>
        <button
          className="ghost delete"
          title="Delete this page"
          onClick={() =>
            onDelete({ id: page.id, title: page.title, hasChildren: page.children.length > 0 })
          }
        >
          <Bin />
        </button>
      </div>
      {page.children.length > 0 && (
        <ul>
          {page.children.map((child) => (
            <PageBranch
              key={child.id}
              page={child}
              selected={selected}
              onSelect={onSelect}
              onAdd={onAdd}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Pick a row up to drag it — unless its name is being typed, where a drag is selecting text.
 *
 * Something has to be put on the drag itself, or some engines will not start one at all; the
 * name, as plain text, is what a drop anywhere else would sensibly receive.
 */
function startDragging(event: React.DragEvent, what: Moving, moves: Moves) {
  if (typing(document.activeElement) && event.currentTarget.contains(document.activeElement)) {
    event.preventDefault();
    return;
  }
  event.stopPropagation();
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", nameOf(what));
  moves.startDrag(what);
}

/** Four arrows: the usual sign for "move this", drawn to sit beside the pencil and the bin. */
function Arrows() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.5v13M1.5 8h13M6 3.5l2-2 2 2M6 12.5l2 2 2-2M3.5 6l-2 2 2 2M12.5 6l2 2-2 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A bin, drawn rather than written.
 *
 * Small and quiet on purpose, beside the pencil: deleting is something people look for when
 * they want it, not something the tree should shout about on every row. Every one of them
 * opens a confirmation, so a stray click costs a dialog and nothing else.
 */
function Bin() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.6 9.5h5.8l.6-9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

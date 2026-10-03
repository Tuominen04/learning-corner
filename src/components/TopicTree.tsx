import { createContext, useContext, useState } from "react";

import type { Deleting } from "./DeleteConfirm";
import { RenameableName } from "./RenameableName";
import type { Topic } from "../lib/engine";
import { canMove, findMoving, nameOf, whyNot, type Moving, type Place } from "../lib/moving";

// The sidebar mirrors the folders on disk, because the folders on disk mirror this. Opening
// the library folder in a file manager shows the same shape.
//
// Anything in it moves three ways, for three kinds of habit: dragged onto a topic, or onto the
// heading for the top level; picked up with Ctrl+X (or Ctrl+C) and put down with Ctrl+V on a
// topic or on anything inside one; or the move button beside rename and delete, which asks
// where. The first two act at once, and the moment after says what happened with an Undo.

/** How the rows in the tree take part in a move: what is held or dragged, and where over. */
type Moves = {
  dragged: Moving | null;
  held: Moving | null;
  /** The place a drop would land, while something is dragged over one that will take it. */
  over: { place: Place } | null;
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

/**
 * The place an element in the tree stands for: the topic whose branch it is in — so a drop
 * anywhere among a topic's documents goes into that topic — or `null` for the heading, which is
 * the top level. `undefined` outside any.
 */
function placeAt(target: EventTarget | null): Place | undefined {
  const element = (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-place]");
  if (!element) return undefined;
  const place = element.dataset["place"] ?? "";
  return place === "" ? null : place;
}

/** Whether a key press belongs to a box being typed in, where Ctrl+C means copy the text. */
function typing(target: EventTarget | null): boolean {
  return (target as HTMLElement | null)?.closest?.("input, textarea, [contenteditable]") != null;
}

export function TopicTree({
  topics,
  selected,
  onSelectDocument,
  onAddDocument,
  onAddTopic,
  onRenameTopic,
  onRenameDocument,
  onDelete,
  onMove,
  onMoveTo,
}: {
  topics: Topic[];
  selected: string | null;
  onSelectDocument: (id: string) => void;
  onAddDocument: (topicId: string) => void;
  onAddTopic: (parent: string | null) => void;
  onRenameTopic: (id: string, name: string) => void;
  onRenameDocument: (id: string, title: string) => void;
  /** Ask to delete something. Never deletes anything itself — the confirmation does. */
  onDelete: (what: Deleting) => void;
  /** Ask where to move something: the move button. */
  onMove: (what: Moving) => void;
  /** Move something to a place already chosen: a drop, or Ctrl+V. */
  onMoveTo: (what: Moving, to: Place) => void;
}) {
  const [dragged, setDragged] = useState<Moving | null>(null);
  const [over, setOver] = useState<{ place: Place } | null>(null);
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

  function onDragOver(event: React.DragEvent) {
    if (!dragged) return;
    const place = placeAt(event.target);
    // Only a place that would take it accepts the drop; everywhere else the pointer says no.
    if (place === undefined || !canMove(topics, dragged, place)) {
      if (over) setOver(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!over || over.place !== place) setOver({ place });
  }

  function onDrop(event: React.DragEvent) {
    if (!dragged) return;
    event.preventDefault();
    const what = dragged;
    const place = placeAt(event.target);
    setDragged(null);
    setOver(null);
    if (place !== undefined && canMove(topics, what, place)) onMoveTo(what, place);
  }

  function onDragLeave(event: React.DragEvent) {
    // Leaving the tree, not one row for the next.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (typing(event.target)) return;
    const key = event.key.toLowerCase();
    const command = event.ctrlKey || event.metaKey;

    if (command && (key === "x" || key === "c")) {
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-move-document], [data-move-topic]",
      );
      const documentId = row?.dataset["moveDocument"];
      const topicId = row?.dataset["moveTopic"];
      const what = documentId
        ? findMoving(topics, "document", documentId)
        : topicId
          ? findMoving(topics, "topic", topicId)
          : null;
      if (what) {
        event.preventDefault();
        setHeld(what);
        setRefused(null);
      }
    } else if (command && key === "v" && held) {
      const place = placeAt(event.target);
      if (place === undefined) return;
      event.preventDefault();
      const reason = whyNot(topics, held, place);
      if (reason) {
        setRefused(`It cannot go there: ${reason}.`);
      } else {
        setHeld(null);
        setRefused(null);
        onMoveTo(held, place);
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
        <div
          className={over?.place === null ? "tree-head drop-target" : "tree-head"}
          data-place=""
        >
          <h2>Topics</h2>
          <button className="ghost" onClick={() => onAddTopic(null)} title="New topic">
            +
          </button>
        </div>
        {held && (
          <p className="holding" role="status">
            Moving “{nameOf(held)}”. Select a topic and press <kbd>Ctrl</kbd>+<kbd>V</kbd>, or{" "}
            <kbd>Esc</kbd> to leave it where it is.
            {refused && <span className="warning"> {refused}</span>}
          </p>
        )}
        {topics.length === 0 ? (
          <p className="empty">
            No topics yet. Name the first one after the question you actually have.
          </p>
        ) : (
          <ul>
            {topics.map((topic) => (
              <TopicBranch
                key={topic.id}
                topic={topic}
                parent={null}
                selected={selected}
                onSelectDocument={onSelectDocument}
                onAddDocument={onAddDocument}
                onAddTopic={onAddTopic}
                onRenameTopic={onRenameTopic}
                onRenameDocument={onRenameDocument}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </nav>
    </MoveContext.Provider>
  );
}

function TopicBranch({
  topic,
  parent,
  selected,
  onSelectDocument,
  onAddDocument,
  onAddTopic,
  onRenameTopic,
  onRenameDocument,
  onDelete,
}: {
  topic: Topic;
  /** The topic this one sits in, which is where "move up" would put its contents. */
  parent: Topic | null;
  selected: string | null;
  onSelectDocument: (id: string) => void;
  onAddDocument: (topicId: string) => void;
  onAddTopic: (parent: string | null) => void;
  onRenameTopic: (id: string, name: string) => void;
  onRenameDocument: (id: string, title: string) => void;
  onDelete: (what: Deleting) => void;
}) {
  const moves = useMoves();
  const self: Moving = { kind: "topic", id: topic.id, name: topic.name };

  const headClass = [
    "branch-head",
    moves.dragged?.id === topic.id && "dragging",
    moves.held?.id === topic.id && "held",
    moves.over?.place === topic.id && "drop-target",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="branch" data-place={topic.id}>
      <div
        className={headClass}
        data-move-topic={topic.id}
        draggable
        onDragStart={(event) => startDragging(event, self, moves)}
        onDragEnd={moves.endDrag}
      >
        <RenameableName
          name={topic.name}
          label="topic"
          onRename={(name) => onRenameTopic(topic.id, name)}
        />
        <span className="branch-actions">
          <button className="ghost" onClick={() => onAddDocument(topic.id)} title="New document">
            +doc
          </button>
          <button className="ghost" onClick={() => onAddTopic(topic.id)} title="Nested topic">
            +topic
          </button>
          <button
            className="ghost move"
            title="Move this topic"
            aria-label="Move this topic"
            onClick={() => moves.ask(self)}
          >
            <Arrows />
          </button>
          <button
            className="ghost delete"
            title="Delete this topic"
            onClick={() =>
              onDelete({
                kind: "topic",
                id: topic.id,
                name: topic.name,
                parent: parent ? { id: parent.id, name: parent.name } : null,
              })
            }
          >
            <Bin />
          </button>
        </span>
      </div>

      <ul>
        {topic.documents.map((doc) => {
          const what: Moving = { kind: "document", id: doc.id, title: doc.title };
          const rowClass = [
            "doc-row",
            moves.dragged?.id === doc.id && "dragging",
            moves.held?.id === doc.id && "held",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            // A row rather than a bare button, because the name and the pencil are two
            // controls and a button cannot contain another one.
            <li
              key={doc.id}
              className={rowClass}
              data-move-document={doc.id}
              draggable
              onDragStart={(event) => startDragging(event, what, moves)}
              onDragEnd={moves.endDrag}
            >
              <RenameableName
                name={doc.title}
                label="document"
                selected={doc.id === selected}
                onSelect={() => onSelectDocument(doc.id)}
                onRename={(title) => onRenameDocument(doc.id, title)}
              />
              <button
                className="ghost move"
                title="Move this document"
                aria-label="Move this document"
                onClick={() => moves.ask(what)}
              >
                <Arrows />
              </button>
              <button
                className="ghost delete"
                title="Delete this document"
                onClick={() => onDelete({ kind: "document", id: doc.id, title: doc.title })}
              >
                <Bin />
              </button>
            </li>
          );
        })}
        {topic.children.map((child) => (
          <TopicBranch
            key={child.id}
            topic={child}
            parent={topic}
            selected={selected}
            onSelectDocument={onSelectDocument}
            onAddDocument={onAddDocument}
            onAddTopic={onAddTopic}
            onRenameTopic={onRenameTopic}
            onRenameDocument={onRenameDocument}
            onDelete={onDelete}
          />
        ))}
      </ul>
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

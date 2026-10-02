import { useRef, useState } from "react";

// A name you can change in place.
//
// Both ways in, because people reach for different ones: a pencil that appears when you hover
// the row, and a double-click on the name itself. F2 as well, for anyone who never leaves the
// keyboard — the pencil is revealed by focus and not only by hover, for the same reason.
//
// The name is the only thing being changed. Identity is the ULID inside the file, so renaming
// never breaks a citation, a link, or an open document — see `storage-format.md`.

export function RenameableName({
  name,
  label,
  onRename,
  onSelect,
  selected,
}: {
  name: string;
  /** What kind of thing this is, for the pencil's label: "Rename this topic". */
  label: string;
  onRename: (next: string) => void;
  /** Given when a plain click means something — a document opens, a topic does not. */
  onSelect?: () => void;
  selected?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <RenameInput
        initial={name}
        label={label}
        onCommit={(next) => {
          setEditing(false);
          onRename(next);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const start = () => setEditing(true);
  const onKeyDown = (event: React.KeyboardEvent) => {
    // F2 is what a file manager uses, and costs nothing to honour.
    if (event.key === "F2") {
      event.preventDefault();
      start();
    }
  };

  return (
    <span className="renameable">
      {onSelect ? (
        <button
          className={selected ? "name selected" : "name"}
          onClick={onSelect}
          onDoubleClick={start}
          onKeyDown={onKeyDown}
        >
          {name}
        </button>
      ) : (
        // Not a button: a topic name does nothing when clicked, and a control that looks
        // pressable but is not is worse than plain text. `tabIndex` is here only so F2 can
        // reach it.
        <span className="name" tabIndex={0} onDoubleClick={start} onKeyDown={onKeyDown}>
          {name}
        </span>
      )}
      <button className="pencil" onClick={start} title={`Rename this ${label}`}>
        <Pencil />
      </button>
    </span>
  );
}

function RenameInput({
  initial,
  label,
  onCommit,
  onCancel,
}: {
  initial: string;
  label: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);

  // Enter, Escape and clicking away can all arrive for one rename — Escape unmounts this, and
  // the blur that follows would otherwise commit the name Escape just refused.
  const settled = useRef(false);

  /**
   * Keep what was typed.
   *
   * An empty name is "never mind" however it arrives: the engine refuses an empty title, and
   * reporting that back as an error for something plainly meant as a cancel is noise on a
   * screen the user is only passing through. An unchanged name is "never mind" too when you
   * click away — but not when you press Enter. That is asking for the name again, and asking
   * is what puts an old `untitled.md` right: the file takes the name it should have had.
   */
  function commit(explicit: boolean) {
    if (settled.current) return;
    settled.current = true;
    const next = value.trim();
    if (next === "" || (next === initial && !explicit)) onCancel();
    else onCommit(next);
  }

  function cancel() {
    if (settled.current) return;
    settled.current = true;
    onCancel();
  }

  return (
    <input
      className="rename-input"
      aria-label={`Rename this ${label}`}
      value={value}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      // Clicking away keeps what you typed, the way a file manager does. Escape is the way to
      // throw it away, and it has already run by the time this fires.
      onBlur={() => commit(false)}
    />
  );
}

/** Drawn rather than typed: the pencil character renders as anything from a glyph to a box. */
function Pencil() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path
        d="M11.5 1.8a1.1 1.1 0 0 1 1.6 0l1.1 1.1a1.1 1.1 0 0 1 0 1.6l-7.6 7.6-3.3.9.9-3.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

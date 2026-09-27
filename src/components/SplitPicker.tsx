import { useState } from "react";

// Naming the document that is about to be taken out.
//
// Shown with what will move, because a split rewrites the document somebody is in the middle
// of writing, and "are you sure" is a worse question than "is this the part you meant".
//
// The suggested title comes from the selection itself: if it starts with a heading, that
// heading is almost always what the new document should be called. A split that arrives with
// the right name already in the box is the difference between a feature people use and one
// they use once.

export function SplitPicker({
  suggested,
  preview,
  busy,
  onSplit,
  onCancel,
}: {
  suggested: string;
  /** The first of what will move, so the choice can be checked against the text. */
  preview: string;
  busy: boolean;
  onSplit: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(suggested);

  return (
    <div className="cite-picker">
      <header>
        <h3>Split into a new document</h3>
        <button className="ghost" onClick={onCancel} title="Close">
          ×
        </button>
      </header>

      <label className="field">
        <span>What to call it</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Types of protein"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim() !== "") onSplit(title.trim());
          }}
        />
      </label>

      <div className="split-preview">
        <span className="field-label">What moves</span>
        <p>{preview}</p>
      </div>

      <div className="row">
        <button onClick={() => onSplit(title.trim())} disabled={busy || title.trim() === ""}>
          {busy ? "Splitting…" : "Split"}
        </button>
        <button className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>

      <small className="hint">
        The new document goes in this same topic, and a link to it is left where the text was.
        Citations move with the words that carry them.
      </small>
    </div>
  );
}

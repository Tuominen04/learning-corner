import { useEffect, useState } from "react";

import {
  engine,
  EngineFailure,
  type Contents,
  type DocumentRef,
  type PageContents,
} from "../lib/engine";

// Deleting a page, having been shown what goes with it.
//
// Two-phase without exception, like deleting a source: what would be lost is named before
// anything is removed, never after. Named rather than counted — "3 pages" is a number somebody
// agrees to, and a list of titles is a thing they recognise. One of them being called "Thesis
// notes" is how a mistake gets caught before it happens.

/** The page being deleted. */
export type Deleting = { id: string; title: string; hasChildren: boolean };

export function DeleteConfirm({
  what,
  onDeleted,
  onCancel,
}: {
  what: Deleting;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  // What the delete would reach, asked for when the dialog opens. `null` until it answers.
  const [linking, setLinking] = useState<DocumentRef[] | null>(null);
  const [under, setUnder] = useState<PageContents | null>(null);
  const [contents, setContents] = useState<Contents | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([engine.document.backlinks(what.id), engine.document.deletePlan(what.id)])
      .then(([found, plan]) => {
        if (!live) return;
        setLinking(found ?? []);
        setUnder(plan);
        // The safe answer is chosen for you. Keeping the pages under it deletes no writing,
        // so offering it pre-selected is not deciding anything that matters; deleting them
        // never is.
        if (plan.pages.length > 0) setContents("move-up");
      })
      .catch((thrown: unknown) => {
        if (live) setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
    return () => {
      live = false;
    };
  }, [what]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      // A page with nothing under it has nothing to decide about, and either answer does the
      // same thing.
      await engine.document.delete(what.id, contents ?? "delete");
      onDeleted();
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      setBusy(false);
    }
  }

  const loading = linking === null || under === null;
  const decided = under !== null && (under.pages.length === 0 || contents !== null);

  return (
    <div className="confirm delete-confirm">
      <h3>Delete “{what.title || "Untitled"}”?</h3>

      {loading ? (
        <p className="empty">Looking at what is under it…</p>
      ) : (
        <>
          <Linking linking={linking} />
          <Under under={under} contents={contents} onChoose={setContents} />
          <p className="hint">
            Any pictures it shows stay in its folder. The library may hold the only copy of a
            picture you moved in, so they are left for you to remove yourself if you want to.
          </p>
        </>
      )}

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button className="secondary" onClick={onCancel} disabled={busy}>
          Keep it
        </button>
        <button
          className="danger"
          onClick={() => void confirm()}
          disabled={busy || loading || !decided}
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function Linking({ linking }: { linking: DocumentRef[] }) {
  if (linking.length === 0) return <p>Nothing links to it.</p>;
  return (
    <>
      <p className="warning">
        {linking.length} page{linking.length === 1 ? " links" : "s link"} to it. Those links will
        say the page is missing — the sentences around them stay exactly as you wrote them.
      </p>
      <ul>
        {linking.map((doc) => (
          <li key={doc.id}>{doc.title}</li>
        ))}
      </ul>
    </>
  );
}

function Under({
  under,
  contents,
  onChoose,
}: {
  under: PageContents;
  contents: Contents | null;
  onChoose: (contents: Contents) => void;
}) {
  if (under.pages.length === 0) return null;
  const n = under.pages.length;
  return (
    <>
      <p className="warning">
        {n} page{n === 1 ? " is" : "s are"} under it.
      </p>
      <ul>
        {under.pages.map((page) => (
          <li key={page.id}>{page.title}</li>
        ))}
      </ul>

      <span className="field-label">What should happen to them?</span>
      <label className="choice">
        <input
          type="radio"
          name="contents"
          checked={contents === "move-up"}
          onChange={() => onChoose("move-up")}
        />
        <span>
          <strong>Keep them</strong>
          Move the pages directly under it up into its place, each with the pages under it,
          then delete this page alone
        </span>
      </label>
      <label className="choice">
        <input
          type="radio"
          name="contents"
          checked={contents === "delete"}
          onChange={() => onChoose("delete")}
        />
        <span>
          <strong>Delete them too</strong>
          Everything listed above goes, and cannot be brought back from here
        </span>
      </label>
    </>
  );
}

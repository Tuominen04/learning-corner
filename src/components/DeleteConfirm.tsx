import { useEffect, useState } from "react";

import {
  engine,
  EngineFailure,
  type Contents,
  type DocumentRef,
  type TopicContents,
} from "../lib/engine";

// Deleting something, having been shown what goes with it.
//
// Two-phase without exception, like deleting a source: what would be lost is named before
// anything is removed, never after. Named rather than counted — "3 documents" is a number
// somebody agrees to, and a list of titles is a thing they recognise. One of them being called
// "Thesis notes" is how a mistake gets caught before it happens.

/** What is being deleted, and enough about where it sits to describe the choices. */
export type Deleting =
  | { kind: "document"; id: string; title: string }
  | {
      kind: "topic";
      id: string;
      name: string;
      /** The topic above, which is where "move up" puts things. `null` at the top level. */
      parent: { id: string; name: string } | null;
    };

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
  const [inside, setInside] = useState<TopicContents | null>(null);
  const [contents, setContents] = useState<Contents | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const ask =
      what.kind === "document"
        ? engine.document.backlinks(what.id).then((found) => {
            if (live) setLinking(found ?? []);
          })
        : engine.topic.deletePlan(what.id).then((plan) => {
            if (!live) return;
            setInside(plan);
            // The safe answer is chosen for you when there is one. Moving the contents up
            // deletes no writing, so offering it pre-selected is not deciding anything that
            // matters; deleting them never is.
            if (plan.documents.length > 0 || plan.topics > 0) {
              setContents(what.parent !== null || plan.documents.length === 0 ? "move-up" : null);
            }
          });
    ask.catch((thrown: unknown) => {
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
      if (what.kind === "document") {
        await engine.document.delete(what.id);
      } else {
        // An empty topic has nothing to decide about, and either answer does the same thing.
        await engine.topic.delete(what.id, contents ?? "delete");
      }
      onDeleted();
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      setBusy(false);
    }
  }

  const name = what.kind === "document" ? what.title : what.name;
  const loading = what.kind === "document" ? linking === null : inside === null;
  const empty = inside !== null && inside.documents.length === 0 && inside.topics === 0;
  // A topic with anything inside it has to have been told what to do with it.
  const decided = what.kind === "document" || empty || contents !== null;

  return (
    <div className="confirm delete-confirm">
      <h3>Delete “{name || "Untitled"}”?</h3>

      {loading ? (
        <p className="empty">Looking at what is in it…</p>
      ) : what.kind === "document" ? (
        <DocumentConsequences linking={linking ?? []} />
      ) : (
        <TopicConsequences
          inside={inside!}
          parent={what.parent}
          contents={contents}
          onChoose={setContents}
        />
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

function DocumentConsequences({ linking }: { linking: DocumentRef[] }) {
  return (
    <>
      {linking.length === 0 ? (
        <p>Nothing links to it.</p>
      ) : (
        <>
          <p className="warning">
            {linking.length} document{linking.length === 1 ? " links" : "s link"} to it. Those
            links will say the document is missing — the sentences around them stay exactly
            as you wrote them.
          </p>
          <ul>
            {linking.map((doc) => (
              <li key={doc.id}>{doc.title}</li>
            ))}
          </ul>
        </>
      )}
      <p className="hint">
        Any pictures it shows stay in the topic's folder. The library may hold the only copy of
        a picture you moved in, so they are left for you to remove yourself if you want to.
      </p>
    </>
  );
}

function TopicConsequences({
  inside,
  parent,
  contents,
  onChoose,
}: {
  inside: TopicContents;
  parent: { id: string; name: string } | null;
  contents: Contents | null;
  onChoose: (contents: Contents) => void;
}) {
  if (inside.documents.length === 0 && inside.topics === 0) {
    return <p>Nothing is in it.</p>;
  }

  // A document cannot sit outside a topic, so at the top level there is nowhere to move
  // documents up to. Said here rather than discovered when the engine refuses.
  const canMoveUp = parent !== null || inside.documents.length === 0;

  return (
    <>
      <p className="warning">
        It holds{" "}
        {inside.documents.length > 0 &&
          `${inside.documents.length} document${inside.documents.length === 1 ? "" : "s"}`}
        {inside.documents.length > 0 && inside.topics > 0 && " and "}
        {inside.topics > 0 && `${inside.topics} topic${inside.topics === 1 ? "" : "s"}`}.
      </p>
      {inside.documents.length > 0 && (
        <ul>
          {inside.documents.map((doc) => (
            <li key={doc.id}>{doc.title}</li>
          ))}
        </ul>
      )}

      <span className="field-label">What should happen to them?</span>
      <label className={canMoveUp ? "choice" : "choice unavailable"}>
        <input
          type="radio"
          name="contents"
          checked={contents === "move-up"}
          disabled={!canMoveUp}
          onChange={() => onChoose("move-up")}
        />
        <span>
          <strong>Keep them</strong>
          {parent !== null
            ? `Move them up into “${parent.name}”, then delete the empty topic`
            : canMoveUp
              ? "Move them up to the top level, then delete the empty topic"
              : "Not possible here: at the top level a document has no topic to go into"}
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

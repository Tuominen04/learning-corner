import { useCallback, useEffect, useState } from "react";

import { engine, EngineFailure, type Work, type WorkSummary, type WorkUnit } from "../lib/engine";
import { languageName, UNITS } from "../lib/works";
import { LanguagePicker, WorkView } from "./WorkView";

// Texts read beside their other versions: the list of works, a new one, and the one open.
//
// A work belongs to the library rather than to a topic, like a source, so this is a place you
// go rather than something in the tree.

export function Works({
  open,
  onOpen,
}: {
  /** The work showing, if one is — chosen here or from a search result. */
  open: string | null;
  onOpen: (id: string | null) => void;
}) {
  const [works, setWorks] = useState<WorkSummary[] | null>(null);
  const [current, setCurrent] = useState<Work | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    engine.work
      .list()
      .then((list) => {
        if (live) setWorks(list);
      })
      .catch((thrown: unknown) => {
        if (live) setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
    return () => {
      live = false;
    };
  }, [reloads]);

  useEffect(() => {
    let live = true;
    // Nothing to read with no work open; the list shows whatever `current` last held, and
    // only shows it while `open` names it.
    if (open === null) return;
    engine.work
      .read(open)
      .then((work) => {
        if (live) setCurrent(work);
      })
      .catch((thrown: unknown) => {
        if (!live) return;
        setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
        onOpen(null);
      });
    return () => {
      live = false;
    };
  }, [open, onOpen]);

  if (open !== null && current?.id === open) {
    return (
      <WorkView
        // Keyed by work, so nothing about one is ever shown against another.
        key={current.id}
        initial={current}
        onBack={() => {
          onOpen(null);
          refresh();
        }}
        onDeleted={() => {
          onOpen(null);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="works">
      <header className="works-head">
        <h2>Works</h2>
        {!creating && (
          <button onClick={() => setCreating(true)} autoFocus>
            New work
          </button>
        )}
      </header>
      <p className="hint">
        A text in a language you are learning, with its pronunciation and translations lined up
        beside it, row by row.
      </p>

      {error && <p className="error">{error}</p>}

      {creating && (
        <NewWork
          onCancel={() => setCreating(false)}
          onCreated={(work) => {
            setCreating(false);
            refresh();
            setCurrent(work);
            onOpen(work.id);
          }}
        />
      )}

      {works !== null && works.length === 0 && !creating && (
        <p className="empty">No works yet. A poem, a song or a page you are reading is a good first one.</p>
      )}

      {works !== null && works.length > 0 && (
        <ul className="work-list">
          {works.map((w) => (
            <li key={w.id}>
              <button className="work-item" onClick={() => onOpen(w.id)}>
                <strong>{w.title}</strong>
                <span className="languages">{w.languages.map(languageName).join(" · ")}</span>
                {w.misaligned && <span className="warning">not lined up</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewWork({ onCancel, onCreated }: { onCancel: () => void; onCreated: (work: Work) => void }) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("ru");
  const [unit, setUnit] = useState<WorkUnit>("line");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      onCreated(await engine.work.create(title, unit, text, language, null));
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="confirm new-work">
      <h3>New work</h3>
      <label className="field">
        <span>Title</span>
        <input value={title} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="Я вас любил" />
      </label>
      <label className="field">
        <span>The original is in</span>
        <LanguagePicker value={language} onChange={setLanguage} />
      </label>
      <div className="field" role="radiogroup" aria-label="Divide it">
        <span>Divide it</span>
        {UNITS.map((u) => (
          <label className="choice" key={u.value}>
            <input type="radio" name="new-work-unit" checked={unit === u.value} onChange={() => setUnit(u.value)} />
            <span>
              <strong>{u.label}</strong>
              {u.hint}
            </span>
          </label>
        ))}
      </div>
      <label className="field">
        <span>The original text</span>
        <textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type it. Translations are added once the work exists."
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button onClick={() => void create()} disabled={busy || title.trim() === "" || language === ""}>
          {busy ? "Creating…" : "Create"}
        </button>
        <button className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

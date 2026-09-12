import { useEffect, useMemo, useState } from "react";

import type { Chosen } from "../lib/citation";
import { engine, EngineFailure, type Form, type Source } from "../lib/engine";
import { contributorName } from "../lib/sources";

// Choosing what to cite, and how the sentence uses it.
//
// The shape follows the user guide: pick the source, add a page number if you have one, and
// choose which of the two APA 7 forms fits the sentence. Nothing here formats anything — the
// citation's appearance comes from the engine, against the whole library, because that is the
// only place that can know this source is 2021a rather than 2021.

/** The locator kinds somebody picks between, and how each is written. */
const KINDS: { value: string; label: string; placeholder: string }[] = [
  { value: "", label: "Page", placeholder: "44, or 44-46" },
  { value: "para", label: "Paragraph", placeholder: "7" },
  { value: "chapter", label: "Chapter", placeholder: "3" },
  { value: "time", label: "Timestamp", placeholder: "1:04:22" },
];

export function CitePicker({
  onChoose,
  onCancel,
}: {
  onChoose: (chosen: Chosen) => void;
  onCancel: () => void;
}) {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [kind, setKind] = useState("");
  const [value, setValue] = useState("");
  const [form, setForm] = useState<Form>("parenthetical");

  useEffect(() => {
    let live = true;
    engine.source
      .list()
      .then((list) => {
        if (live) setSources(list);
      })
      .catch((thrown: unknown) => {
        if (live) {
          setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
          setSources([]);
        }
      });
    return () => {
      live = false;
    };
  }, []);

  // Matching on title and on contributor names, because you remember a source by either.
  const matches = useMemo(() => {
    const all = sources ?? [];
    const needle = query.trim().toLowerCase();
    if (needle === "") return all;
    return all.filter((source) => {
      const haystack = [source.title, ...source.contributors.map(contributorName)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [sources, query]);

  function confirm() {
    if (!chosen) return;
    const typed = value.trim();
    onChoose({
      source: chosen,
      locator: typed === "" ? null : kind === "" ? typed : `${kind}:${typed}`,
      form,
    });
  }

  return (
    <div className="cite-picker">
      <header>
        <h3>Cite a source</h3>
        <button className="ghost" onClick={onCancel} title="Close">
          ×
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {sources === null ? (
        <p className="empty">Reading the library…</p>
      ) : sources.length === 0 ? (
        <p className="empty">
          No sources saved yet. Save one under <strong>Sources</strong> first — a citation has
          to point at something.
        </p>
      ) : (
        <>
          <input
            className="cite-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or author"
            autoFocus
          />

          {matches.length === 0 ? (
            <p className="empty">Nothing matches that.</p>
          ) : (
            <ul className="cite-list">
              {matches.map((source) => (
                <li key={source.id ?? source.title}>
                  <button
                    className={source.id === chosen ? "cite-option chosen" : "cite-option"}
                    onClick={() => setChosen(source.id)}
                  >
                    <strong>{source.title || "Untitled"}</strong>
                    <span className="source-meta">{who(source)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="cite-where">
            <span className="field-label">Where in it, if you know</span>
            <div className="row">
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={KINDS.find((k) => k.value === kind)?.placeholder}
              />
            </div>
            <small className="hint">
              Worth the ten seconds. A citation with a page number takes you back to the
              paragraph; one without takes you back to a four-hundred-page book.
            </small>
          </div>

          <div className="cite-form">
            <span className="field-label">How the sentence uses it</span>
            <label className="choice">
              <input
                type="radio"
                checked={form === "parenthetical"}
                onChange={() => setForm("parenthetical")}
              />
              <span>
                <strong>In brackets</strong>
                <em>…repairs muscle tissue (Nieminen, 2021, p. 44).</em>
                When the fact matters, not who said it
              </span>
            </label>
            <label className="choice">
              <input
                type="radio"
                checked={form === "narrative"}
                onChange={() => setForm("narrative")}
              />
              <span>
                <strong>In the sentence</strong>
                <em>Nieminen (2021) found that…</em>
                When who said it is part of your point
              </span>
            </label>
          </div>

          <div className="row">
            <button onClick={confirm} disabled={!chosen}>
              Insert citation
            </button>
            <button className="secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Who made it and when — the plain facts, so a source is recognisable in a list. */
function who(source: Source): string {
  const names = source.contributors.map(contributorName).filter(Boolean);
  const named =
    names.length === 0
      ? "nobody listed"
      : names.length <= 2
        ? names.join(" and ")
        : `${names[0]} and ${names.length - 1} others`;
  const when = source.date.kind === "no-date" ? "no date" : String(source.date.year);
  return `${named} · ${when}`;
}

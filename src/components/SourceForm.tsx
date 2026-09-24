import { open as openFile } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

import {
  engine,
  EngineFailure,
  type Contributor,
  type Field,
  type Keep,
  type Source,
  type SourceDate,
  type SourceType,
} from "../lib/engine";
import { basename, folder } from "../lib/paths";
import {
  blankSource,
  contributorName,
  EDITABLE_ORDER,
  emptyContributor,
  fieldToEditable,
  hintFor,
  isGroup,
  labelFor,
  missingLabel,
  ROLES,
  SOURCE_TYPES,
  tidy,
  type Editable,
} from "../lib/sources";

/**
 * The types whose content is designed to change under you, and so can carry a retrieval date.
 *
 * A book does not need one; a wiki page does. APA 7 asks for a retrieval date only where the
 * content is unarchived and unstable, and offering the field on everything is how it ends up
 * on all seven types, where it means nothing.
 */
const CHANGEABLE = new Set<SourceType>(["web-page", "video", "audio"]);

/** Today, as a full date — the answer somebody wants when they record reading something. */
function today(): SourceDate {
  const now = new Date();
  return {
    kind: "full",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

// The form for one source.
//
// Two rules run through it. **The type decides the questions** — a book is asked for its
// publisher and an article for its journal, so nobody is made to answer a question their kind
// of source does not have. And **an unfinished source is still saved**: the missing fields are
// reported afterwards, never used to refuse the save, because somebody who cannot find a
// publisher must end up with an incomplete source rather than with no source at all.

export function SourceForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing: Source | null;
  /** The type travels with the result because naming a missing field depends on it: the same
   * `container` is a journal for an article and a book for a chapter. */
  onSaved: (id: string, missing: Field[], type: SourceType) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState<Source>(existing ?? blankSource("book"));
  const [required, setRequired] = useState<Field[]>([]);
  const [extras, setExtras] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A PDF chosen but not yet saved, and a kept one marked to go.
  //
  // Both wait for Save, like every other field on this form. That is the consistent behaviour
  // — nothing here happens until you save — and it means abandoning an edit never leaves a
  // copied file behind in the library.
  const [chosen, setChosen] = useState<string | null>(null);
  const [detaching, setDetaching] = useState(false);

  // Copy by default. Move deletes a file of the user's, so it is something they choose rather
  // than something they discover afterwards.
  const [keep, setKeep] = useState<Keep>("copy");

  const kept = detaching ? null : source.file;

  // Which fields APA 7 needs is the engine's to answer, not this form's — it is a fact about
  // the citation style, and a copy here would be a second definition free to drift from it.
  useEffect(() => {
    let current = true;
    engine.source
      .requiredFields(source.type)
      .then((fields) => {
        if (current) setRequired(fields);
      })
      .catch(() => {
        // A form that cannot ask which fields are required still works; it just cannot mark
        // them. Failing to save is worth interrupting somebody for. Failing to draw an
        // asterisk is not.
        if (current) setRequired([]);
      });
    return () => {
      current = false;
    };
  }, [source.type]);

  const requiredEditables = new Set(
    required.map(fieldToEditable).filter((f): f is Editable => f !== null),
  );
  const shown = extras
    ? EDITABLE_ORDER
    : EDITABLE_ORDER.filter((f) => requiredEditables.has(f));
  const hidden = EDITABLE_ORDER.length - shown.length;

  function set<K extends keyof Source>(key: K, value: Source[K]) {
    setSource((s) => ({ ...s, [key]: value }));
  }

  function setContributor(index: number, next: Contributor) {
    setSource((s) => ({
      ...s,
      contributors: s.contributors.map((c, i) => (i === index ? next : c)),
    }));
  }

  async function choosePdf() {
    setError(null);
    try {
      const picked = await openFile({
        multiple: false,
        directory: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (typeof picked !== "string") return; // dismissed the dialog
      setChosen(picked);
      setDetaching(false);
      setKeep("copy");
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  /**
   * The paper, once the source it belongs to exists.
   *
   * Separated from saving the fields because the copy is named after the source's own record,
   * which the engine writes. A source being created has no record to be named after yet, so
   * this runs afterwards with the identifier the engine just assigned.
   */
  async function savePaper(id: string) {
    if (chosen) await engine.source.attach(id, chosen, keep);
    else if (detaching && source.file) await engine.source.detach(id);
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const ready = tidy(source);
      if (ready.id) {
        const missing = await engine.source.update(ready);
        await savePaper(ready.id);
        onSaved(ready.id, missing, ready.type);
      } else {
        const saved = await engine.source.create(ready);
        await savePaper(saved.id);
        onSaved(saved.id, saved.missing, ready.type);
      }
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="source-form">
      <h2>{existing ? "Edit source" : "New source"}</h2>

      <label className="field">
        <span>What kind of thing is it?</span>
        <select
          value={source.type}
          onChange={(e) => {
            // Changing the type keeps everything already typed. Somebody who picked "book"
            // and meant "report" should not lose the title and the authors to find out.
            set("type", e.target.value as SourceType);
          }}
        >
          {SOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{SOURCE_TYPES.find((t) => t.value === source.type)?.hint}</p>

      <label className="field">
        <span>Title{required.includes("title") && <em> · needed</em>}</span>
        <input
          value={source.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="The title as it is printed"
        />
      </label>

      <Contributors
        contributors={source.contributors}
        needed={required.includes("authors")}
        onChange={setContributor}
        onAdd={(kind) =>
          setSource((s) => ({ ...s, contributors: [...s.contributors, emptyContributor(kind)] }))
        }
        onRemove={(index) =>
          setSource((s) => ({
            ...s,
            contributors: s.contributors.filter((_, i) => i !== index),
          }))
        }
      />

      <DateField
        label="Date"
        needed={required.includes("date")}
        value={source.date}
        onChange={(date) => set("date", date)}
      />

      {shown.map((field) => (
        <label className="field" key={field}>
          <span>
            {labelFor(field, source.type)}
            {requiredEditables.has(field) && <em> · needed</em>}
          </span>
          <input
            value={source[field] ?? ""}
            onChange={(e) => set(field, e.target.value)}
          />
          {hintFor(field) && <small className="hint">{hintFor(field)}</small>}
        </label>
      ))}

      {CHANGEABLE.has(source.type) && (
        <div className="field">
          <span className="field-label">When you read it</span>
          {source.retrieved === null ? (
            <button className="ghost" onClick={() => set("retrieved", today())}>
              + Record the date
            </button>
          ) : (
            <>
              <div className="row">
                <DateField
                  label=""
                  needed={false}
                  value={source.retrieved}
                  onChange={(date) => set("retrieved", date)}
                />
                <button className="ghost" onClick={() => set("retrieved", null)} title="Remove">
                  ×
                </button>
              </div>
            </>
          )}
          <small className="hint">
            Worth recording only where the page is designed to change and nobody is archiving
            it. APA 7 does not want a retrieval date on a page that will read the same next
            year, and adding one everywhere makes the ones that matter invisible.
          </small>
        </div>
      )}

      {hidden > 0 && !extras && (
        <button className="ghost" onClick={() => setExtras(true)}>
          Show {hidden} more field{hidden === 1 ? "" : "s"}
        </button>
      )}

      <details className="appraisal">
        <summary>What you make of it</summary>
        <p className="hint">
          Your own judgement, not a score the app worked out. It is what tells you, six months
          later, that one of the six sources under a page was a company selling the thing it
          was describing.
        </p>
        <label className="field">
          <span>How much you trust it</span>
          <input
            value={source.appraisal?.trust ?? ""}
            onChange={(e) =>
              set("appraisal", { trust: e.target.value, note: source.appraisal?.note ?? null })
            }
            placeholder="Peer-reviewed · someone's blog, but they cite their sources"
          />
        </label>
        <label className="field">
          <span>Why</span>
          <input
            value={source.appraisal?.note ?? ""}
            onChange={(e) =>
              set("appraisal", { trust: source.appraisal?.trust ?? null, note: e.target.value })
            }
          />
        </label>
      </details>

      <div className="paper">
        <span className="field-label">The paper itself</span>

        {chosen ? (
          <div className="paper-choice">
            <p className="paper-kept">
              <strong>{basename(chosen)}</strong>
              <button className="secondary small" onClick={() => setChosen(null)}>
                Don't add
              </button>
            </p>

            <span className="field-label">Do you want to copy or move the file?</span>
            <label className="choice">
              <input
                type="radio"
                checked={keep === "copy"}
                onChange={() => setKeep("copy")}
              />
              <span>
                <strong>Copy file</strong>
                Leaves your own copy in {folder(chosen)}
              </span>
            </label>
            <label className="choice">
              <input
                type="radio"
                checked={keep === "move"}
                onChange={() => setKeep("move")}
              />
              <span>
                <strong>Move file</strong>
                Takes it out of {folder(chosen)} once your library has it
              </span>
            </label>
          </div>
        ) : kept ? (
          <p className="paper-kept">
            <strong>{kept}</strong>
            <button
              className="secondary small"
              onClick={() => void engine.source.open(source.id ?? "")}
            >
              Open
            </button>
            <button className="secondary small" onClick={() => setDetaching(true)}>
              Remove
            </button>
          </p>
        ) : (
          <button className="secondary" onClick={() => void choosePdf()}>
            Add a PDF…
          </button>
        )}

        <small className="hint">
          Your library keeps <strong>its own copy</strong> either way, so the source has its
          paper for good — empty your downloads folder afterwards, or unplug the stick it came
          on, and nothing is lost.
        </small>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button onClick={() => void save()} disabled={busy}>
          {existing ? "Save changes" : "Save source"}
        </button>
        <button className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>

      <p className="note">
        Save what you have. Anything still missing is reported, never used to refuse the save —
        a source you cannot fully identify is worth more than no source at all.
      </p>
    </section>
  );
}

function Contributors({
  contributors,
  needed,
  onChange,
  onAdd,
  onRemove,
}: {
  contributors: Contributor[];
  needed: boolean;
  onChange: (index: number, next: Contributor) => void;
  onAdd: (kind: "person" | "group") => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="contributors">
      <span className="field-label">
        Who made it{needed && <em> · needed</em>}
      </span>

      {contributors.length === 0 && (
        <p className="hint">Nobody listed yet.</p>
      )}

      {contributors.map((contributor, index) => (
        <div className="contributor" key={index}>
          <select
            value={contributor.role}
            onChange={(e) => onChange(index, { ...contributor, role: e.target.value as Contributor["role"] })}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          {isGroup(contributor) ? (
            <>
              <input
                value={contributor.literal ?? ""}
                onChange={(e) => onChange(index, { ...contributor, literal: e.target.value })}
                placeholder="World Health Organization"
              />
              <input
                className="short"
                value={contributor.abbreviation ?? ""}
                onChange={(e) => onChange(index, { ...contributor, abbreviation: e.target.value })}
                placeholder="WHO"
                title="The short form it is known by after the first citation"
              />
            </>
          ) : (
            <>
              <input
                value={contributor.family ?? ""}
                onChange={(e) => onChange(index, { ...contributor, family: e.target.value })}
                placeholder="Family name"
              />
              <input
                value={contributor.given ?? ""}
                onChange={(e) => onChange(index, { ...contributor, given: e.target.value })}
                placeholder="Given names"
              />
            </>
          )}

          <button className="ghost" onClick={() => onRemove(index)} title="Remove">
            ×
          </button>
        </div>
      ))}

      <div className="row">
        <button className="ghost" onClick={() => onAdd("person")}>
          + Person
        </button>
        <button className="ghost" onClick={() => onAdd("group")}>
          + Organisation
        </button>
      </div>
      <p className="hint">
        An organisation is one name, not a family name and a given name — assuming every name
        in the world splits into two parts is how they come out mangled.
      </p>
    </div>
  );
}

/**
 * The date, which is three shapes rather than one.
 *
 * `No date` is a choice a person makes, not an empty box they left alone. APA 7 prints `n.d.`
 * for it, so it has to be sayable — and it has to be distinguishable from not having got to
 * the field yet, or a source whose year is genuinely unknown would cite as a blank.
 */
function DateField({
  label,
  needed,
  value,
  onChange,
}: {
  label: string;
  needed: boolean;
  value: SourceDate;
  onChange: (date: SourceDate) => void;
}) {
  const year = value.kind === "no-date" ? new Date().getFullYear() : value.year;

  return (
    <div className="field date-field">
      {label && (
        <span className="field-label">
          {label}
          {needed && <em> · needed</em>}
        </span>
      )}

      <div className="row">
        <select
          value={value.kind}
          onChange={(e) => {
            const kind = e.target.value as SourceDate["kind"];
            if (kind === "no-date") onChange({ kind: "no-date" });
            else if (kind === "year") onChange({ kind: "year", year });
            else onChange({ kind: "full", year, month: 1, day: 1 });
          }}
        >
          <option value="year">Year only</option>
          <option value="full">Full date</option>
          <option value="no-date">No date given</option>
        </select>

        {value.kind === "year" && (
          <input
            className="short"
            type="number"
            value={value.year}
            onChange={(e) => onChange({ kind: "year", year: Number(e.target.value) })}
          />
        )}

        {value.kind === "full" && (
          <>
            <input
              className="short"
              type="number"
              value={value.year}
              onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
              title="Year"
            />
            <input
              className="short"
              type="number"
              min={1}
              max={12}
              value={value.month}
              onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
              title="Month"
            />
            <input
              className="short"
              type="number"
              min={1}
              max={31}
              value={value.day}
              onChange={(e) => onChange({ ...value, day: Number(e.target.value) })}
              title="Day"
            />
          </>
        )}
      </div>

      {value.kind === "no-date" && (
        <small className="hint">This will cite as “n.d.”, which is what APA 7 asks for.</small>
      )}
    </div>
  );
}

/** Exported for the list, which shows the same names the form collects. */
export { contributorName, missingLabel };

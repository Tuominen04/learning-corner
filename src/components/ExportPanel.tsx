import { save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

import { engine, EngineFailure, type ExportFormat } from "../lib/engine";
import { EXPORT_FORMATS, exportName, formatOf } from "../lib/export";
import { basename, folder } from "../lib/paths";
import { saveEverything } from "../lib/saving";

// Taking a document out of the app, as a file somebody else can read.
//
// The file is the document as it reads here, finished: every citation written out in APA 7
// form, the reference list after the writing with its hanging indent, links as the titles of
// what they lead to. Nothing in it needs this application to make sense of.

export function ExportPanel({
  document,
  onClose,
}: {
  document: { id: string; title: string };
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>(EXPORT_FORMATS[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function exportIt() {
    setError(null);
    setSaved(null);
    const chosen = formatOf(format);
    try {
      const path = await save({
        defaultPath: exportName(document.title, format),
        filters: [{ name: chosen.label, extensions: [chosen.extension] }],
      });
      if (path === null) return; // dismissed the dialog
      setBusy(true);
      // The newest words may still be waiting for a pause in the typing. The export is made
      // from what is on disk, so they go there first — what is exported is what is on screen.
      await saveEverything();
      await engine.document.export(document.id, format, path);
      setSaved(path);
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cite-picker export-panel">
      <header>
        <h3>Export</h3>
        <button className="ghost" onClick={onClose} title="Close">
          ×
        </button>
      </header>

      <div className="cite-form" role="radiogroup" aria-label="Export as">
        {EXPORT_FORMATS.map((f) => (
          <label className="choice" key={f.value}>
            <input
              type="radio"
              name="export-format"
              checked={format === f.value}
              onChange={() => setFormat(f.value)}
            />
            <span>
              <strong>
                {f.label} <span className="extension">.{f.extension}</span>
              </strong>
              {f.hint}
            </span>
          </label>
        ))}
      </div>

      <small className="hint">
        The reference list goes with it, and every citation is written out in full — the file
        reads on its own, without this app.
      </small>

      {error && <p className="error">{error}</p>}
      {saved && (
        <p className="note" role="status">
          Saved <strong>{basename(saved)}</strong> in {folder(saved)}.
        </p>
      )}

      <div className="row">
        <button onClick={() => void exportIt()} disabled={busy} autoFocus>
          {busy ? "Exporting…" : "Save as…"}
        </button>
        <button className="secondary" onClick={onClose} disabled={busy}>
          {saved ? "Done" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

import { open as openFile } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

import { engine, EngineFailure, type Keep } from "../lib/engine";
import { altFromPath, basename, folder } from "../lib/paths";

// Putting a picture into a document.
//
// The library takes its own copy either way, so the file the user picked can be gone
// afterwards — emptied out of Downloads, or unplugged with the stick it came on — and the
// document still shows its picture. `keep` is only about what becomes of their own file, and
// it is asked rather than assumed, because one of the two answers deletes something of theirs.
//
// The copy lands beside the document and the body names it plainly, which is what keeps the
// `.md` readable outside this application.

export function ImagePicker({
  document,
  onInserted,
  onCancel,
}: {
  document: string;
  onInserted: (name: string, alt: string) => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [keep, setKeep] = useState<Keep>("copy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    setError(null);
    try {
      const picked = await openFile({
        multiple: false,
        directory: false,
        // The four the library stores. Filtering here is a courtesy; the engine checks the
        // file's own first bytes, because an extension is a claim rather than a fact.
        filters: [{ name: "Pictures", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
      });
      if (typeof picked !== "string") return; // dismissed the dialog
      setChosen(picked);
      setKeep("copy");
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  async function insert() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      // The name comes back from the engine, never from here: it has been made unique against
      // everything already in the folder, so two pictures both called `diagram.png` stay two
      // pictures. Writing the picked name into the body would name whichever won.
      const name = await engine.document.attachImage(document, chosen, keep);
      onInserted(name, altFromPath(chosen));
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      setBusy(false);
    }
  }

  return (
    <div className="cite-picker">
      <header>
        <h3>Add a picture</h3>
        <button className="ghost" onClick={onCancel} title="Close">
          ×
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {chosen === null ? (
        <>
          <button onClick={() => void choose()} autoFocus>
            Choose a picture…
          </button>
          <small className="hint">
            PNG, JPEG, GIF or WebP. It is copied into your library beside this document, so the
            picture stays even if the file you picked does not.
          </small>
        </>
      ) : (
        <>
          <p className="paper-kept">
            <strong>{basename(chosen)}</strong>
            <button className="secondary small" onClick={() => setChosen(null)} disabled={busy}>
              Pick another
            </button>
          </p>

          <div className="cite-form">
            <span className="field-label">Do you want to copy or move the file?</span>
            <label className="choice">
              <input type="radio" checked={keep === "copy"} onChange={() => setKeep("copy")} />
              <span>
                <strong>Copy file</strong>
                Leaves your own copy in {folder(chosen)}
              </span>
            </label>
            <label className="choice">
              <input type="radio" checked={keep === "move"} onChange={() => setKeep("move")} />
              <span>
                <strong>Move file</strong>
                Takes it out of {folder(chosen)} once your library has it
              </span>
            </label>
          </div>

          <div className="row">
            <button onClick={() => void insert()} disabled={busy}>
              {busy ? "Adding…" : "Insert picture"}
            </button>
            <button className="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

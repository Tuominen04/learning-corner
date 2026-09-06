import { useState } from "react";
import { open as openFolder } from "@tauri-apps/plugin-dialog";

import { engine, EngineFailure, type LibraryStatus } from "../lib/engine";

// Choosing where the library lives is the first thing that happens, and the app never picks
// for the user. There is no default path and no hidden location.
export function LibraryPicker({ onOpened }: { onOpened: (status: LibraryStatus) => void }) {
  const [name, setName] = useState("Learning");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(mode: "create" | "open") {
    setError(null);
    const picked = await openFolder({ directory: true, multiple: false });
    if (typeof picked !== "string") return;

    setBusy(true);
    try {
      const status =
        mode === "create"
          ? await engine.library.create(picked, name.trim() || "Learning")
          : await engine.library.open(picked);
      onOpened(status);
    } catch (thrown) {
      setError(
        thrown instanceof EngineFailure ? thrown.message : String(thrown),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="picker">
      <h1>Personal Learning Corner</h1>
      <p className="lede">
        Your notes, the sources behind them, and the texts you are working through — stored as
        ordinary files in a folder you choose.
      </p>

      <label className="field">
        <span>Library name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Learning"
        />
      </label>

      <div className="row">
        <button onClick={() => void choose("create")} disabled={busy}>
          Create a library…
        </button>
        <button onClick={() => void choose("open")} disabled={busy} className="secondary">
          Open an existing one…
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <p className="note">
        Pick somewhere you will remember and that is easy to back up. Avoid folders that sync
        automatically to a cloud service — those decide for themselves which copy wins, which
        is the decision this application leaves with you.
      </p>
    </main>
  );
}

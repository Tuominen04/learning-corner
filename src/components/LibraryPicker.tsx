import { useEffect, useState } from "react";
import { open as openFolder } from "@tauri-apps/plugin-dialog";

import {
  engine,
  EngineFailure,
  shell,
  type LibraryStatus,
  type RecentLibrary,
} from "../lib/engine";
import { couldNotOpen, whenOpened } from "../lib/recent";

/** A library that has just opened, and the folder it was opened from. */
export type Opened = { path: string; status: LibraryStatus };

// Choosing where the library lives is the first thing that happens, and the app never picks
// for the user. There is no default path and no hidden location.
//
// After the first time it is also where somebody comes back to, from an open library, to open
// another or make a new one — so the libraries opened before are listed first, one click
// each, and choosing a folder is for everything else.
export function LibraryPicker({
  notice,
  onOpened,
}: {
  /** Why the last library did not open again when the application started, if it did not. */
  notice: string | null;
  onOpened: (opened: Opened) => void;
}) {
  const [name, setName] = useState("Learning");
  const [recent, setRecent] = useState<RecentLibrary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    shell
      .recentLibraries()
      .then((found) => {
        if (live) setRecent(found);
      })
      .catch(() => {
        // A list that cannot be read is an empty one. It was only ever a shortcut to the
        // buttons below, which still work.
        if (live) setRecent([]);
      });
    return () => {
      live = false;
    };
  }, []);

  async function choose(mode: "create" | "open") {
    setError(null);
    setBusy(true);
    try {
      // The folder dialog belongs inside the try. It can fail — a missing permission, no
      // desktop runtime — and a failure outside here escapes as an unhandled rejection, which
      // the person experiences as a button that does nothing at all.
      const picked = await openFolder({ directory: true, multiple: false });
      if (typeof picked !== "string") return; // dismissed the dialog

      const status =
        mode === "create"
          ? await engine.library.create(picked, name.trim() || "Learning")
          : await engine.library.open(picked);
      onOpened({ path: picked, status });
    } catch (thrown) {
      setError(
        thrown instanceof EngineFailure ? thrown.message : String(thrown),
      );
    } finally {
      setBusy(false);
    }
  }

  async function reopen(library: RecentLibrary) {
    setError(null);
    setBusy(true);
    try {
      const status = await engine.library.open(library.path);
      onOpened({ path: library.path, status });
    } catch (thrown) {
      // Asked again rather than trusted: the folder may have gone since the list was shown,
      // or come back, and what the list says should agree with what just happened.
      const now = await shell.recentLibraries().catch(() => recent ?? []);
      setRecent(now);
      setError(couldNotOpen(now.find((l) => l.path === library.path) ?? library, thrown));
      setBusy(false);
    }
  }

  async function forget(library: RecentLibrary) {
    setError(null);
    try {
      await shell.forgetLibrary(library.path);
      setRecent((was) => was?.filter((l) => l.path !== library.path) ?? null);
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  const today = new Date();

  return (
    <main className="picker">
      <h1>Personal Learning Corner</h1>
      <p className="lede">
        Your notes, the sources behind them, and the texts you are working through — stored as
        ordinary files in a folder you choose.
      </p>

      {notice && <p className="warning notice">{notice}</p>}

      {recent !== null && recent.length > 0 && (
        <section className="recent">
          <h2>Open again</h2>
          <ul>
            {recent.map((library) => (
              <li key={library.path} className={library.found ? undefined : "missing"}>
                <button
                  className="recent-library"
                  onClick={() => void reopen(library)}
                  disabled={busy}
                  title={library.path}
                >
                  <strong>{library.name}</strong>
                  <span className="where">{library.path}</span>
                  <span className="when">
                    {library.found
                      ? `Opened ${whenOpened(library.opened, today)}`
                      : "Not found — moved, renamed, or on a drive that is not plugged in?"}
                  </span>
                </button>
                <button
                  className="ghost forget"
                  onClick={() => void forget(library)}
                  disabled={busy}
                  title="Take it off this list. The library itself is not touched."
                  aria-label={`Take “${library.name}” off this list`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent !== null && recent.length > 0 && <h2>Another library</h2>}

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

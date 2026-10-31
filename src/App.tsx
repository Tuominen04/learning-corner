import { useCallback, useEffect, useState } from "react";

import { BackupPanel, type BackupMode } from "./components/BackupPanel";
import { DeleteConfirm, type Deleting } from "./components/DeleteConfirm";
import { Editor } from "./components/Editor";
import { LibraryPicker, type Opened } from "./components/LibraryPicker";
import { MovePicker } from "./components/MovePicker";
import { RenameableName } from "./components/RenameableName";
import { Search } from "./components/Search";
import { Sources } from "./components/Sources";
import { TopicTree } from "./components/TopicTree";
import { Works } from "./components/Works";
import {
  engine,
  EngineFailure,
  isDesktopRuntime,
  shell,
  type BackupApplied,
  type Document,
  type LibraryFolder,
  type LibraryStatus,
  type Topic,
} from "./lib/engine";
import { canMove, nameOf, placeName, placeOf, type Moving, type Place } from "./lib/moving";
import { basename } from "./lib/paths";
import { couldNotOpen } from "./lib/recent";
import { saveEverything } from "./lib/saving";

/** What the window is showing. */
type Screen =
  /** Just started, and finding out whether there is a library to go back to. */
  | { kind: "starting"; reopening: string | null }
  /** The start screen, perhaps saying why the last library did not open again. */
  | { kind: "picking"; notice: string | null }
  | { kind: "open"; opened: Opened };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "starting", reopening: null });

  // Closing the window waits for the last words typed to reach the disk. The editor writes
  // after a pause in the typing, and closing inside that pause used to lose them.
  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let stop: (() => void) | null = null;
    let gone = false;
    shell
      .beforeClose(saveEverything)
      .then((unlisten) => {
        if (gone) unlisten();
        else stop = unlisten;
      })
      .catch(() => {
        // Nothing to listen on. The window still closes — the shell closes it after two
        // seconds whatever happens — it only loses the chance to save first.
      });
    return () => {
      gone = true;
      stop?.();
    };
  }, []);

  // The library that was open last, opened again — when the application starts, and only
  // then. Coming back to the start screen later is somebody choosing another library, and
  // reopening the last one at them would be the opposite of what they asked for.
  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let live = true;
    void reopenLast((name) => {
      if (live) setScreen({ kind: "starting", reopening: name });
    })
      // Whatever goes wrong, starting ends somewhere a library can be chosen. A start screen
      // with nothing to say is a small thing; a window stuck on "Opening…" is not.
      .catch((): Screen => ({ kind: "picking", notice: null }))
      .then((next) => {
        if (live) setScreen(next);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!isDesktopRuntime()) {
    // Opening http://localhost:5173 in a browser gives you the page and nothing behind it:
    // no engine, no folder dialog. Every button would silently do nothing, which reads as a
    // broken application rather than as the wrong window.
    return (
      <main className="picker">
        <h1>Open the desktop window</h1>
        <p className="lede">
          This page is being served to a browser, which has no access to your files. The
          interface only works inside the application window.
        </p>
        <p className="note">
          Run <code>npm run tauri dev</code> and use the window it opens. The address bar you
          can see above is the giveaway — the real window has none.
        </p>
      </main>
    );
  }

  switch (screen.kind) {
    case "starting":
      // Deliberately almost empty. Showing the start screen's buttons for the moment it takes
      // to find the last library would offer a choice that is about to be taken away.
      return (
        <main className="picker">
          <h1>Learning Corner</h1>
          {screen.reopening !== null && <p className="lede">Opening “{screen.reopening}”…</p>}
        </main>
      );
    case "picking":
      return (
        <LibraryPicker
          notice={screen.notice}
          onOpened={(opened) => setScreen({ kind: "open", opened })}
        />
      );
    case "open":
      return (
        <Workspace
          // Keyed by library, so nothing about one — the open document, the search, a
          // half-made deletion — can ever be shown against another.
          key={screen.opened.path}
          opened={screen.opened}
          onClosed={() => setScreen({ kind: "picking", notice: null })}
        />
      );
  }
}

/** "1 topic", "3 topics". */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * Why a renamed library's folder kept its old name — or nothing, when it followed.
 *
 * Said once, at the moment it happens. Somebody who renames a library and then finds the old
 * name still on the folder in their file manager deserves to have been told why, rather than
 * to decide the rename did not work.
 */
function folderNote(folder: LibraryFolder, path: string): string | null {
  switch (folder) {
    case "follows":
      return null;
    case "shared":
      return `The folder keeps its name, ${basename(path)}: it holds other things as well as the library, and renaming it would move them too.`;
    case "drive":
      return "The folder keeps its name: it is the top of a drive, which is named for the drive.";
  }
}

/**
 * Open the library that was open last, if there is one and it can be.
 *
 * Every way this can fail ends in the same place — the start screen, saying why — and the
 * first time the application runs there is nothing to say at all.
 */
async function reopenLast(reopening: (name: string) => void): Promise<Screen> {
  const [last] = await shell.recentLibraries().catch(() => []);
  if (!last) return { kind: "picking", notice: null };
  // Not tried, when the folder is not there: the engine could only say it found no library,
  // and what to do about a drive that is not plugged in is a better thing to be told.
  if (!last.found) return { kind: "picking", notice: couldNotOpen(last, null) };

  reopening(last.name);
  try {
    const status = await engine.library.open(last.path);
    return { kind: "open", opened: { path: last.path, status } };
  } catch (thrown) {
    return { kind: "picking", notice: couldNotOpen(last, thrown) };
  }
}

/** An open library: the tree beside, and whatever is being worked on. */
function Workspace({ opened, onClosed }: { opened: Opened; onClosed: () => void }) {
  const [library, setLibrary] = useState<LibraryStatus>(opened.status);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [open, setOpen] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sources are library-wide rather than living under a topic, so they are a place you go
  // rather than something you select in the tree.
  const [view, setView] = useState<"documents" | "sources" | "works">("documents");

  // The work showing in the Works view, if one is. Here rather than in that view, so a search
  // result can open one.
  const [openWork, setOpenWork] = useState<string | null>(null);

  // Searching is navigating, so it lives in the sidebar with the tree rather than being a
  // place you go. While there is a query the results stand in for the tree; clear it and the
  // tree is back, unchanged.
  const [query, setQuery] = useState("");

  // What is being deleted, while the confirmation is up. The confirmation takes the main area
  // rather than a corner of the sidebar, because it has a list of titles to show and the
  // sidebar is too narrow to read one in.
  const [deleting, setDeleting] = useState<Deleting | null>(null);

  const [closing, setClosing] = useState(false);

  // Whether claims are marked in the editor. Here rather than in the editor, so it holds as
  // you move from one document to the next; for this window only, and never written down.
  const [showClaims, setShowClaims] = useState(false);

  // Something worth knowing that is not a failure: why a renamed library's folder kept its
  // name. Cleared by the next thing done, like an error.
  const [note, setNote] = useState<string | null>(null);

  // What is being moved, while the move button's question is up. In the main area, like a
  // deletion's confirmation: it lists every topic, and the sidebar is too narrow to read them.
  const [moving, setMoving] = useState<Moving | null>(null);

  // The move just made, and where it came from, so it can be undone. A drag that let go over
  // the wrong topic is a moment's slip, and putting it back should cost a click, not a search.
  const [moved, setMoved] = useState<{ what: Moving; from: Place; to: Place } | null>(null);

  // A backup or a bring-back, while its panel is up. In the main area: a plan lists files.
  const [backingUp, setBackingUp] = useState<BackupMode | null>(null);

  // Counted up when files under the open document changed from outside the editor — a
  // bring-back — so the editor starts afresh from what is on disk rather than what it held.
  const [reloaded, setReloaded] = useState(0);

  /**
   * Open a document, from wherever somebody asked.
   *
   * Four things now do this — the tree, a search result, a source's list of citing documents,
   * and a link inside a document — and they all mean exactly the same thing. One definition,
   * and a stable one: the editor memoises against it, so a new function every render would
   * rebuild the library's titles on every keystroke.
   */
  const openDocument = useCallback((id: string) => {
    setError(null);
    setNote(null);
    setMoved(null);
    engine.document
      .read(id)
      .then((doc) => {
        setOpen(doc);
        setView("documents");
      })
      .catch((thrown: unknown) => {
        setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [tree, status] = await Promise.all([
        engine.topic.tree(),
        engine.library.status(),
      ]);
      setTopics(tree);
      setLibrary(status);
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }, []);

  // The tree, when the library opens. This component is made afresh for every library, so
  // mounting *is* opening one; the status came with the opening and is already current.
  useEffect(() => {
    let live = true;
    engine.topic
      .tree()
      .then((tree) => {
        if (live) setTopics(tree);
      })
      .catch((thrown: unknown) => {
        if (live) setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      });
    return () => {
      live = false;
    };
  }, []);

  /**
   * Back to the start screen, to open another library or make a new one.
   *
   * Everything typed goes to disk first. The editor writes after a pause in the typing, and
   * closing the library inside that pause would leave the last few words with nowhere to go.
   * If they cannot be written the library stays open, with the words still on screen and the
   * editor saying why beside them, so there is a chance to copy them somewhere. Asked a second
   * time it closes: by then nothing is waiting that could still be written.
   */
  async function close() {
    setClosing(true);
    setError(null);
    try {
      await saveEverything();
    } catch {
      setError(
        "Your latest changes could not be saved, so the library is still open. Switching again closes it without them.",
      );
      setClosing(false);
      return;
    }
    // Closing cannot fail in a way that matters: whichever library opens next takes this
    // one's place in the shell regardless.
    await engine.library.close().catch(() => {});
    onClosed();
  }

  /**
   * What happens after something is deleted.
   *
   * The open document may have been the thing deleted, or inside the topic that was, or
   * *moved* by it — "keep them" lifts documents into the parent, which changes their topic
   * and nothing else. Asking the engine is simpler and more honest than working out which of
   * those happened from here: if it can still be read it is still there, and if it cannot,
   * the editor must not go on showing text that no longer exists anywhere.
   */
  function afterDelete() {
    setDeleting(null);
    const was = open?.id;
    void guard(async () => {
      if (was) {
        try {
          setOpen(await engine.document.read(was));
        } catch {
          setOpen(null);
        }
      }
      await refresh();
    });
  }

  // Renaming a document reaches two places: the tree, and the open document's own header.
  //
  // The engine hands back the renamed document, including its new revision — renaming writes
  // the file, because the title lives in the front matter. Passing that straight into `setOpen`
  // is what keeps the editor able to save afterwards; dropping it would leave the editor
  // holding a revision the file no longer has.
  function renameDocument(id: string, title: string) {
    void guard(async () => {
      const renamed = await engine.document.rename(id, title);
      if (open?.id === renamed.id) setOpen(renamed);
      await refresh();
    });
  }

  /**
   * Move a topic or a document — by drag, by Ctrl+V, by the move button, or to undo the last.
   *
   * Whatever was typed last is written first, like closing a library: the document being moved
   * may be the one open, with words still waiting for a pause in the typing. Then the open
   * document is read again, because it may have been moved, or have been inside a topic that
   * was; its words and its revision do not change, only where it is.
   */
  async function move(what: Moving, to: Place) {
    setMoving(null);
    const from = placeOf(topics, what);
    if (from === undefined || !canMove(topics, what, to)) return;
    await guard(async () => {
      await saveEverything();
      if (what.kind === "document") {
        if (to === null) return;
        const doc = await engine.document.move(what.id, to);
        setOpen((current) => (current?.id === doc.id ? doc : current));
      } else {
        await engine.topic.move(what.id, to);
        const was = open?.id;
        if (was) setOpen(await engine.document.read(was));
      }
      await refresh();
      setMoved({ what, from, to });
    });
  }

  /**
   * After a backup, the library's counts; after a bring-back, everything — the tree, and the
   * open document, which may have been replaced or removed by the drive's version.
   */
  function afterBackup(applied: BackupApplied, mode: BackupMode) {
    setLibrary(applied.status);
    if (mode === "backup") return;
    const was = open?.id;
    void guard(async () => {
      if (was) {
        try {
          setOpen(await engine.document.read(was));
        } catch {
          setOpen(null);
        }
      }
      setReloaded((n) => n + 1);
      await refresh();
    });
  }

  async function guard(work: () => Promise<void>) {
    setError(null);
    setNote(null);
    setMoved(null);
    try {
      await work();
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  return (
    <div className="app">
      <aside>
        <div className="library">
          <div className="library-head">
            {/* The folder, on hover: two libraries can share a name — a backup opened from a
                drive is called exactly what the original is — and only where it is tells
                them apart. */}
            <span className="library-name" title={library.path}>
              <RenameableName
                name={library.name}
                label="library"
                onRename={(name) =>
                  void guard(async () => {
                    const renamed = await engine.library.rename(name);
                    setLibrary(renamed.status);
                    setNote(folderNote(renamed.folder, renamed.status.path));
                  })
                }
              />
            </span>
            <button
              className="ghost switch"
              onClick={() => void close()}
              disabled={closing}
              title="Close this library and go back to the start screen, to open another one or make a new one"
            >
              {closing ? "Closing…" : "Switch library"}
            </button>
          </div>
          <span className="counts">
            {count(library.topics, "topic")} · {count(library.documents, "document")}
            {library.works > 0 && ` · ${count(library.works, "work")}`}
          </span>
          {library.writable && (
            <div className="row backup-buttons">
              <button
                className="ghost"
                onClick={() => setBackingUp("backup")}
                title="Copy this library to a drive, so the drive is exactly like it"
              >
                Back up…
              </button>
              <button
                className="ghost"
                onClick={() => setBackingUp("bring-back")}
                title="Copy what was changed on a backup into this library"
              >
                Bring back…
              </button>
            </div>
          )}
          {!library.writable && (
            <p className="warning">
              This library was written by a newer version. It is open for reading only.
            </p>
          )}
        </div>

        <nav className="views">
          <button
            className={view === "documents" ? "view selected" : "view"}
            onClick={() => setView("documents")}
          >
            Documents
          </button>
          <button
            className={view === "sources" ? "view selected" : "view"}
            onClick={() => setView("sources")}
          >
            Sources
          </button>
          <button
            className={view === "works" ? "view selected" : "view"}
            onClick={() => setView("works")}
          >
            Works
          </button>
        </nav>

        <div className="find">
          <input
            className="find-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your writing"
            aria-label="Search your topics and documents"
          />
          {query !== "" && (
            <button className="ghost" onClick={() => setQuery("")} title="Clear the search">
              ×
            </button>
          )}
        </div>

        {query.trim() !== "" ? (
          <Search
            query={query}
            onOpenDocument={openDocument}
            onOpenWork={(id) => {
              setOpenWork(id);
              setView("works");
            }}
          />
        ) : (
        <TopicTree
          topics={topics}
          selected={view === "documents" ? (open?.id ?? null) : null}
          onSelectDocument={openDocument}
          onAddDocument={(topicId) =>
            void guard(async () => {
              const id = await engine.document.create(topicId, "Untitled");
              await refresh();
              setOpen(await engine.document.read(id));
              setView("documents");
            })
          }
          onAddTopic={(parent) =>
            void guard(async () => {
              await engine.topic.create(parent, "New topic");
              await refresh();
            })
          }
          onRenameTopic={(id, name) =>
            void guard(async () => {
              await engine.topic.rename(id, name);
              await refresh();
            })
          }
          onRenameDocument={renameDocument}
          onDelete={setDeleting}
          onMove={setMoving}
          onMoveTo={(what, to) => void move(what, to)}
        />
        )}

        {library.problems.length > 0 && (
          <div className="problems">
            <h3>Needs your attention</h3>
            <ul>
              {library.problems.map((p) => (
                <li key={`${p.path}:${p.message}`}>
                  <code>{p.path}</code>
                  <span>{p.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <main>
        {error && <p className="error">{error}</p>}
        {note && <p className="folder-note">{note}</p>}
        {moved && (
          <p className="folder-note moved" role="status">
            Moved “{nameOf(moved.what)}”{" "}
            {moved.to === null ? "to the top level" : `into ${placeName(topics, moved.to)}`}.{" "}
            <button className="ghost undo" onClick={() => void move(moved.what, moved.from)}>
              Undo
            </button>
          </p>
        )}
        {backingUp ? (
          <BackupPanel
            key={backingUp}
            mode={backingUp}
            onApplied={afterBackup}
            onClose={() => setBackingUp(null)}
          />
        ) : deleting ? (
          <DeleteConfirm
            // Keyed, so opening the confirmation for something else starts it afresh rather
            // than showing the last thing's contents for a moment.
            key={`${deleting.kind}:${deleting.id}`}
            what={deleting}
            onDeleted={afterDelete}
            onCancel={() => setDeleting(null)}
          />
        ) : moving ? (
          <MovePicker
            key={`${moving.kind}:${moving.id}`}
            what={moving}
            topics={topics}
            onMove={(to) => void move(moving, to)}
            onCancel={() => setMoving(null)}
          />
        ) : view === "sources" ? (
          <Sources onOpenDocument={openDocument} />
        ) : view === "works" ? (
          <Works
            open={openWork}
            onOpen={setOpenWork}
          />
        ) : open ? (
          <Editor
            key={`${open.id}:${reloaded}`}
            document={open}
            topics={topics}
            onSaved={(saved) => {
              // Only while it is still the open document. The editor writes what is waiting
              // as it goes, so a save can land after somebody has moved on to another one,
              // and must not bring the one they left back on screen.
              setOpen((current) => (current?.id === saved.id ? saved : current));
              void refresh();
            }}
            onRename={renameDocument}
            onOpenDocument={openDocument}
            showClaims={showClaims}
            onShowClaims={setShowClaims}
          />
        ) : (
          <p className="empty">
            Choose a document, or start one. A topic is a subject; a document is a page inside
            it. Both are meant to be split apart later, so do not plan the whole structure now.
          </p>
        )}
      </main>
    </div>
  );
}

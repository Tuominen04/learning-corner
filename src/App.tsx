import { useCallback, useEffect, useState } from "react";

import { DeleteConfirm, type Deleting } from "./components/DeleteConfirm";
import { Editor } from "./components/Editor";
import { LibraryPicker, type Opened } from "./components/LibraryPicker";
import { RenameableName } from "./components/RenameableName";
import { Search } from "./components/Search";
import { Sources } from "./components/Sources";
import { TopicTree } from "./components/TopicTree";
import {
  engine,
  EngineFailure,
  isDesktopRuntime,
  shell,
  type Document,
  type LibraryStatus,
  type Topic,
} from "./lib/engine";
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
          <h1>Personal Learning Corner</h1>
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
  const [view, setView] = useState<"documents" | "sources">("documents");

  // Searching is navigating, so it lives in the sidebar with the tree rather than being a
  // place you go. While there is a query the results stand in for the tree; clear it and the
  // tree is back, unchanged.
  const [query, setQuery] = useState("");

  // What is being deleted, while the confirmation is up. The confirmation takes the main area
  // rather than a corner of the sidebar, because it has a list of titles to show and the
  // sidebar is too narrow to read one in.
  const [deleting, setDeleting] = useState<Deleting | null>(null);

  const [closing, setClosing] = useState(false);

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

  async function guard(work: () => Promise<void>) {
    setError(null);
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
            <span className="library-name" title={opened.path}>
              <RenameableName
                name={library.name}
                label="library"
                onRename={(name) =>
                  void guard(async () => {
                    setLibrary(await engine.library.rename(name));
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
            {library.topics} topics · {library.documents} documents
          </span>
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
          <Search query={query} onOpenDocument={openDocument} />
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
        {deleting ? (
          <DeleteConfirm
            // Keyed, so opening the confirmation for something else starts it afresh rather
            // than showing the last thing's contents for a moment.
            key={`${deleting.kind}:${deleting.id}`}
            what={deleting}
            onDeleted={afterDelete}
            onCancel={() => setDeleting(null)}
          />
        ) : view === "sources" ? (
          <Sources onOpenDocument={openDocument} />
        ) : open ? (
          <Editor
            key={open.id}
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

import { useCallback, useState } from "react";

import { DeleteConfirm, type Deleting } from "./components/DeleteConfirm";
import { Editor } from "./components/Editor";
import { LibraryPicker } from "./components/LibraryPicker";
import { Search } from "./components/Search";
import { Sources } from "./components/Sources";
import { TopicTree } from "./components/TopicTree";
import {
  engine,
  EngineFailure,
  isDesktopRuntime,
  type Document,
  type LibraryStatus,
  type Topic,
} from "./lib/engine";

export function App() {
  const [library, setLibrary] = useState<LibraryStatus | null>(null);
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

  if (!library) {
    // Loading the tree happens here rather than in an effect keyed on the library. An effect
    // would need `library` as a dependency, and `refresh` sets `library` — which is a loop.
    // Opening is an event, so treat it as one.
    return (
      <LibraryPicker
        onOpened={(status) => {
          setLibrary(status);
          void refresh();
        }}
      />
    );
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
          <strong>{library.name}</strong>
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
              setOpen(saved);
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

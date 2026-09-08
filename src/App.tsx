import { useCallback, useState } from "react";

import { Editor } from "./components/Editor";
import { LibraryPicker } from "./components/LibraryPicker";
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

        <TopicTree
          topics={topics}
          selected={open?.id ?? null}
          onSelectDocument={(id) =>
            void guard(async () => setOpen(await engine.document.read(id)))
          }
          onAddDocument={(topicId) =>
            void guard(async () => {
              const id = await engine.document.create(topicId, "Untitled");
              await refresh();
              setOpen(await engine.document.read(id));
            })
          }
          onAddTopic={(parent) =>
            void guard(async () => {
              await engine.topic.create(parent, "New topic");
              await refresh();
            })
          }
        />

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
        {open ? (
          <Editor
            key={open.id}
            document={open}
            onSaved={(saved) => {
              setOpen(saved);
              void refresh();
            }}
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

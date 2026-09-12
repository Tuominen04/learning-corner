import { EditorContent, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import History from "@tiptap/extension-history";
import { useCallback, useEffect, useRef, useState } from "react";

import { collectCitations, parseBody, serializeBody } from "../lib/body";
import { citationKey, insertCitation, toLocator, type Chosen } from "../lib/citation";
import {
  engine,
  EngineFailure,
  type CitationRequest,
  type Document as Doc,
  type Form,
} from "../lib/engine";
import { CitationView, RenderedCitations } from "./CitationView";
import { CitePicker } from "./CitePicker";
import { Citation, DocumentLink } from "./nodes";

// Saving is continuous: there is no save button and no unsaved state to lose. A short debounce
// keeps the write off every keystroke without ever leaving work only in memory.
const SAVE_AFTER_IDLE_MS = 600;

export function Editor({ document, onSaved }: { document: Doc; onSaved: (d: Doc) => void }) {
  const [state, setState] = useState<"clean" | "saving" | "conflict" | "error">("clean");
  const [message, setMessage] = useState<string | null>(null);
  const [citing, setCiting] = useState(false);

  // What each citation in this document reads as. Empty until the engine answers.
  const [rendered, setRendered] = useState<Map<string, string | null>>(new Map());

  // The revision travels from the last successful read or write into the next write. Kept in a
  // ref rather than state so a save in flight always sees the current one.
  //
  // Nothing synchronises it back from the `document` prop, and nothing needs to. Switching
  // documents remounts this component — App keys it by document id — so the ref and the saved
  // indicator start fresh. Staying on the same document and saving updates both in `save`
  // below, before the new prop even arrives. An effect doing it again was redundant, and
  // react-hooks 7 was right to object to setting state in one.
  const revision = useRef(document.revision);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Which citations we have already asked about, as one sorted string.
  //
  // Typing a word changes the document on every keystroke but almost never changes which
  // citations are in it, and re-asking the engine each time would read the whole library for
  // nothing. Comparing the set is what keeps the cost proportional to citing rather than to
  // typing.
  const asked = useRef<string>("");

  const refreshCitations = useCallback((doc: ReturnType<typeof parseBody>) => {
    const found = collectCitations(doc);

    // Deduplicated by key, not by source: the same book cited narratively and with a page
    // number is two different renderings.
    const wanted = new Map<string, CitationRequest>();
    for (const one of found) {
      const key = citationKey(one.source, one.locator, one.form as Form);
      if (!wanted.has(key)) {
        wanted.set(key, {
          source: one.source,
          form: one.form as Form,
          locator: toLocator(one.locator),
        });
      }
    }

    const signature = [...wanted.keys()].sort().join("\u0000");
    if (signature === asked.current) return;
    asked.current = signature;

    // A document with no citations needs no lookups, and the map is deliberately left as it
    // is rather than cleared. Nothing reads it — there are no citation nodes — and keeping it
    // means a citation deleted and retyped reappears already rendered instead of flickering
    // through its placeholder. Clearing it here would also be a synchronous setState in an
    // effect, which react-hooks 7 objects to, and it would be right to.
    if (wanted.size === 0) return;

    const keys = [...wanted.keys()];
    engine.citation
      .formatMany([...wanted.values()])
      .then((texts) => {
        setRendered(new Map(keys.map((key, i) => [key, texts[i] ?? null])));
      })
      .catch(() => {
        // A citation that cannot be formatted still has to be visible, and the placeholder
        // already says so. Interrupting somebody's writing to report it would be worse than
        // leaving the fallback in place — nothing is lost and nothing is wrong on disk.
        asked.current = "";
      });
  }, []);

  const editor = useEditor(
    {
      extensions: [Document, Paragraph, Text, History, Citation, DocumentLink],
      content: parseBody(document.body),
      onUpdate: ({ editor }) => {
        if (timer.current) clearTimeout(timer.current);
        const json = editor.getJSON();
        refreshCitations(json);
        const body = serializeBody(json);
        timer.current = setTimeout(() => void save(body), SAVE_AFTER_IDLE_MS);
      },
    },
    [document.id],
  );

  // The first pass, for the citations already in the document when it opens.
  //
  // This is also what keeps the promise that correcting a source corrects every document
  // citing it. Editing a source means going to the Sources view, which unmounts this
  // component, so coming back re-runs the lookup against the corrected record. Nothing has to
  // watch for the change; navigating away and back *is* the invalidation.
  useEffect(() => {
    refreshCitations(parseBody(document.body));
  }, [document.body, refreshCitations]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function save(body: string) {
    setState("saving");
    try {
      const saved = await engine.document.write(document.id, body, revision.current);
      revision.current = saved.revision;
      setState("clean");
      setMessage(null);
      onSaved(saved);
    } catch (thrown) {
      if (thrown instanceof EngineFailure && thrown.kind === "Conflict") {
        // The file changed underneath — the user edited it in a text editor, which they are
        // told they may. Their copy on disk is not overwritten, and they are told so plainly.
        setState("conflict");
        setMessage(
          "This document changed on disk while you were editing. Nothing has been overwritten. Reopen it to see the version on disk.",
        );
        return;
      }
      setState("error");
      setMessage(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    }
  }

  function insert(chosen: Chosen) {
    setCiting(false);
    if (editor) insertCitation(editor, chosen);
  }

  return (
    <section className="editor">
      <header>
        <h2>{document.title}</h2>
        <span className={`state ${state}`}>
          {state === "saving" ? "Saving…" : state === "clean" ? "Saved" : "Not saved"}
        </span>
        <button className="cite-action" onClick={() => setCiting(true)} disabled={citing}>
          Cite
        </button>
      </header>

      {message && <p className={state === "conflict" ? "warning" : "error"}>{message}</p>}

      {citing && <CitePicker onChoose={insert} onCancel={() => setCiting(false)} />}

      <RenderedCitations.Provider value={rendered}>
        <EditorContent editor={editor} className="prose" />
      </RenderedCitations.Provider>

      <footer className="note">
        Plain text with citations and links. Headings, lists and emphasis arrive with the
        Markdown work in the next milestone — until then nothing is rendered that could not be
        written back to your file exactly as you typed it.
      </footer>
    </section>
  );
}

/** Re-exported so the node can find its view without importing this module. */
export { CitationView };

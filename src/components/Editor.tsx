import { EditorContent, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import History from "@tiptap/extension-history";
import { useEffect, useRef, useState } from "react";

import { parseBody, serializeBody } from "../lib/body";
import { engine, EngineFailure, type Document as Doc } from "../lib/engine";
import { Citation, DocumentLink } from "./nodes";

// Saving is continuous: there is no save button and no unsaved state to lose. A short debounce
// keeps the write off every keystroke without ever leaving work only in memory.
const SAVE_AFTER_IDLE_MS = 600;

export function Editor({ document, onSaved }: { document: Doc; onSaved: (d: Doc) => void }) {
  const [state, setState] = useState<"clean" | "saving" | "conflict" | "error">("clean");
  const [message, setMessage] = useState<string | null>(null);

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

  const editor = useEditor(
    {
      extensions: [Document, Paragraph, Text, History, Citation, DocumentLink],
      content: parseBody(document.body),
      onUpdate: ({ editor }) => {
        if (timer.current) clearTimeout(timer.current);
        const body = serializeBody(editor.getJSON());
        timer.current = setTimeout(() => void save(body), SAVE_AFTER_IDLE_MS);
      },
    },
    [document.id],
  );

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

  return (
    <section className="editor">
      <header>
        <h2>{document.title}</h2>
        <span className={`state ${state}`}>
          {state === "saving" ? "Saving…" : state === "clean" ? "Saved" : "Not saved"}
        </span>
      </header>

      {message && <p className={state === "conflict" ? "warning" : "error"}>{message}</p>}

      <EditorContent editor={editor} className="prose" />

      <footer className="note">
        Plain text with citations and links. Headings, lists and emphasis arrive with the
        Markdown work in the next milestone — until then nothing is rendered that could not be
        written back to your file exactly as you typed it.
      </footer>
    </section>
  );
}

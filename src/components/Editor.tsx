import type { Editor as TipTapEditor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import History from "@tiptap/extension-history";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  collectCitations,
  collectImages,
  headingMarker,
  offsetOf,
  parseBody,
  serializeBody,
  wholeConstructs,
} from "../lib/body";
import { citationKey, insertCitation, toLocator, type Chosen } from "../lib/citation";
import {
  engine,
  EngineFailure,
  type CitationRequest,
  type Document as Doc,
  type DocumentRef,
  type Form,
  type Topic,
} from "../lib/engine";
import { insertLink, titlesOf } from "../lib/links";
import { insertImage } from "../lib/pictures";
import { holdUntilSaved } from "../lib/saving";
import { Backlinks } from "./Backlinks";
import { CitationView, RenderedCitations } from "./CitationView";
import { CitePicker } from "./CitePicker";
import { DocumentLinks, type LinkTargets } from "./DocumentLinkView";
import { DocumentImages } from "./ImageView";
import { ImagePicker } from "./ImagePicker";
import { LinkPicker } from "./LinkPicker";
import { ReferenceList } from "./ReferenceList";
import { RenameableName } from "./RenameableName";
import { SplitPicker } from "./SplitPicker";
import { Citation, DocumentImage, DocumentLink } from "./nodes";

/** The levels the toolbar offers. Deeper ones are still read, and still written back. */
const LEVELS = [1, 2, 3] as const;

/** Pictures, and the document they were fetched for. */
type Pictures = { document: string; urls: Map<string, string | null> };

/** One empty map, so "nothing fetched" is the same value every time. */
const NONE: Map<string, string | null> = new Map();

// Saving is continuous: there is no save button and no unsaved state to lose. A short debounce
// keeps the write off every keystroke without ever leaving work only in memory.
const SAVE_AFTER_IDLE_MS = 600;

export function Editor({
  document,
  topics,
  onSaved,
  onRename,
  onOpenDocument,
}: {
  document: Doc;
  /** The whole library, for drawing links as titles and for choosing what to link to. */
  topics: Topic[];
  onSaved: (d: Doc) => void;
  onRename: (id: string, title: string) => void;
  onOpenDocument: (id: string) => void;
}) {
  const [state, setState] = useState<"clean" | "saving" | "conflict" | "error">("clean");
  const [message, setMessage] = useState<string | null>(null);
  const [citing, setCiting] = useState(false);
  const [picturing, setPicturing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [splitting, setSplitting] = useState<{ from: number; to: number } | null>(null);
  const [splittingNow, setSplittingNow] = useState(false);

  // The documents linking here. Asked for once, when a document opens.
  const [backlinks, setBacklinks] = useState<DocumentRef[]>([]);

  // What each citation in this document reads as. Empty until the engine answers.
  const [rendered, setRendered] = useState<Map<string, string | null>>(new Map());

  // The pictures the document names, as `data:` URLs. Same three states as the citations
  // above: absent means not fetched yet, `null` means there is nothing to show.
  //
  // Carried with the document they belong to, because a filename means different things in
  // different folders. Two documents may each have a `diagram.png`, and a map left over from
  // the last one would draw the wrong picture in the moment before the right one arrives.
  const [pictures, setPictures] = useState<Pictures>({ document: document.id, urls: NONE });
  const shown = pictures.document === document.id ? pictures.urls : NONE;

  // The reference list, as the engine builds it from the file on disk.
  const [references, setReferences] = useState<string[]>([]);

  // The revision travels from the last successful read or write into the next write. Kept in a
  // ref rather than state so a save in flight always sees the current one.
  //
  // It also has to follow the prop, which it did not always need to. Renaming a document
  // **writes the file** — the title lives in the front matter — so the engine hands back a new
  // revision while this component stays mounted, since App keys it by document id and a rename
  // does not change the id. Without adopting it, the next keystroke would be refused as a
  // conflict against a change the user had just made themselves.
  //
  // Synchronised in an effect keyed on the revision itself, so it runs when the prop changes
  // and not on every render. A ref is still the right home for the value — a save in flight
  // must see the current one, not the one its render closed over — and an effect is the right
  // place to write it, which is what react-hooks 7 objects to doing during a render.
  const revision = useRef(document.revision);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // What has been typed and not yet handed to a write, or `null` when nothing is waiting. The
  // whole body, because every write is the whole body.
  const pending = useRef<string | null>(null);

  // The writes, one after another. Two at once would carry the same revision, and the engine
  // would rightly refuse the second as a conflict — the one with the newest typing in it. So
  // each waits for the last to land, and carries the revision that one came back with.
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  // `save`, as of the latest render. It is a new function every render, and what the typing
  // timer and the rest of the application are handed has to stay the same one from mount to
  // unmount, so they go through this. Filled in by an effect below, before anything can be
  // typed.
  const saveNow = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    revision.current = document.revision;
  }, [document.revision]);

  // Which document is open, for answers that come back after the user has moved on. A picture
  // fetched for the document they just left must not replace the pictures of the one they are
  // looking at now.
  const openDocument = useRef(document.id);
  useEffect(() => {
    openDocument.current = document.id;
  }, [document.id]);

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
      extensions: [
        Document,
        Paragraph,
        Text,
        History,
        Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
        Citation,
        DocumentLink,
        DocumentImage,
      ],
      content: parseBody(document.body),
      // A toolbar that reports where the cursor is has to be redrawn when the cursor moves.
      // Without this the editor re-renders only when React has some other reason to, so the
      // heading buttons showed the block you were in *when you last pressed one*, and Split
      // stayed switched off however much you selected. It costs a render per transaction, and
      // everything expensive on this screen is already memoised against its own inputs.
      shouldRerenderOnTransaction: true,
      onUpdate: ({ editor }) => {
        const json = editor.getJSON();
        refreshCitations(json);
        pending.current = serializeBody(json);
        if (timer.current) clearTimeout(timer.current);
        // A failure is on screen by the time this settles, which is all there is to do with it.
        timer.current = setTimeout(
          () => void saveNow.current().catch(() => {}),
          SAVE_AFTER_IDLE_MS,
        );
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

  /**
   * The pictures this document names, fetched once when it opens.
   *
   * Not on every keystroke, unlike the citations, because typing cannot introduce a picture:
   * the editor has no way to make one except the picker, which fetches the one it just added.
   * `![x](y.png)` typed by hand is text until the file is saved and opened again, and the
   * reopening is what runs this.
   *
   * Each is fetched by the name the body carries, against **this** document, so a document
   * that moves takes its pictures with it and nothing here needs to know it happened.
   */
  useEffect(() => {
    const names = collectImages(parseBody(document.body));
    if (names.length === 0) return;

    let live = true;
    const id = document.id;
    void Promise.all(
      names.map((name) =>
        engine.document
          .image(id, name)
          // One picture that cannot be read must not blank the others. The view says plainly
          // enough that there is nothing to show.
          .catch(() => null)
          .then((url) => [name, url] as const),
      ),
    ).then((pairs) => {
      if (live) setPictures({ document: id, urls: new Map(pairs) });
    });
    return () => {
      live = false;
    };
  }, [document.body, document.id]);

  /**
   * The documents linking here, asked for when this one opens.
   *
   * Not on every save, because saving *this* document cannot change who links *to* it —
   * that only changes when somebody else's document does, which means leaving this screen.
   * Navigating away and back is the invalidation, as it is everywhere else here.
   */
  useEffect(() => {
    let live = true;
    engine.document
      .backlinks(document.id)
      .then((found) => {
        if (live) setBacklinks(found ?? []);
      })
      .catch(() => {
        // Keep showing what we have. A failed lookup is no reason to tell somebody
        // mid-sentence that nothing links to their document any more.
      });
    return () => {
      live = false;
    };
  }, [document.id]);

  /**
   * What a link in the text reads as, and what following one does.
   *
   * Titles come from the tree the application already holds rather than from an engine call:
   * every document in the library is in it, so drawing a link costs nothing and cannot
   * disagree with the sidebar beside it.
   */
  const links = useMemo<LinkTargets>(
    () => ({ titles: titlesOf(topics), open: onOpenDocument }),
    [topics, onOpenDocument],
  );

  // Which sources the document on disk cites, as one sorted string.
  //
  // Derived from `document.body` rather than from what is being typed, and that is the point:
  // the engine builds the reference list by **reading the file**, so asking about a citation
  // the file does not have yet answers about the document as it was a moment ago and quietly
  // leaves the new source out. This prop only changes when a save has come back, so it is
  // exactly the version the engine is about to read.
  //
  // It depends on *which sources* are cited and nothing else — not on page numbers, not on
  // which citations are narrative — so adding a second page reference to a book already cited
  // rebuilds nothing.
  const cited = useMemo(
    () =>
      [...new Set(collectCitations(parseBody(document.body)).map((one) => one.source))]
        .sort()
        .join("\u0000"),
    [document.body],
  );

  useEffect(() => {
    // A document that cites nothing has no reference list, and that is answerable here. Asking
    // the engine would be a whole library read to be told what the document already says.
    if (cited === "") return;

    let live = true;
    engine.citation
      .referenceList(document.id)
      .then((entries) => {
        if (live) setReferences(entries);
      })
      .catch(() => {
        // Keep showing the list we have. It is a view of the sources, and a failed lookup is
        // no reason to tell somebody mid-sentence that their references vanished.
      });
    return () => {
      live = false;
    };
  }, [cited, document.id]);

  /** Write `body`, once any write already on its way has landed. */
  function write(body: string): Promise<Doc> {
    const id = document.id;
    const next = writes.current.then(async () => {
      const saved = await engine.document.write(id, body, revision.current);
      revision.current = saved.revision;
      return saved;
    });
    writes.current = next.catch(() => undefined);
    return next;
  }

  /**
   * Write what is waiting now, instead of after the pause.
   *
   * Resolves once everything typed is on disk — a write already on its way included, so
   * "saved" means all of it rather than only the newest part. Rejects when what was waiting
   * could not be written, having said why on screen, so that closing the library can stop
   * instead of taking the words with it.
   */
  async function save() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const body = pending.current;
    pending.current = null;
    if (body === null) {
      await writes.current;
      return;
    }

    setState("saving");
    try {
      const saved = await write(body);
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
      } else {
        setState("error");
        setMessage(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      }
      throw thrown;
    }
  }

  useEffect(() => {
    saveNow.current = save;
  });

  // Whatever takes the editor away gets what was typed first.
  useEffect(() => {
    const release = holdUntilSaved(() => saveNow.current());
    return () => {
      release();
      // Going, so the pause is over: write what is waiting now rather than dropping it. It
      // used to be dropped, which lost the last few words to anybody who clicked another
      // document straight after typing them. A failure has nowhere to be shown — this editor
      // is what would have shown it — and the next one to open the document reads the file
      // as it is on disk, which is the truth either way.
      void saveNow.current().catch(() => {});
    };
  }, []);

  function insert(chosen: Chosen) {
    setCiting(false);
    if (editor) insertCitation(editor, chosen);
  }

  /**
   * A picture the engine has just filed, put where the cursor is.
   *
   * Fetched straight afterwards rather than waited for: the save that carries the new line to
   * disk is six hundred milliseconds away, and leaving a placeholder on screen until then
   * makes adding a picture feel like it did not work.
   */
  function inserted(name: string, alt: string) {
    setPicturing(false);
    if (editor) insertImage(editor, name, alt);

    const id = document.id;
    void engine.document
      .image(id, name)
      .catch(() => null)
      .then((url) => {
        if (openDocument.current !== id) return;
        setPictures((had) => ({
          document: id,
          urls: new Map(had.document === id ? had.urls : []).set(name, url),
        }));
      });
  }

  function linked(id: string) {
    setLinking(false);
    if (editor) insertLink(editor, id);
  }

  /**
   * Take the selection out into a new document.
   *
   * The ordering is the whole of this. The engine splits the **file**, on character offsets
   * into the body it has; the offsets here are computed from the editor's document. Those are
   * the same text only once everything typed has been written — so the pending save is
   * flushed first, deliberately and with its revision carried forward, rather than hoped
   * about. Splitting on offsets into a stale file takes the wrong words out of somebody's
   * writing, and the engine cannot tell that it happened.
   */
  async function split(title: string) {
    if (!editor || !splitting) return;
    setSplittingNow(true);
    setMessage(null);

    try {
      // Whatever is on screen, on disk, before anything is measured against it — behind any
      // write already on its way, so it carries the revision that one came back with.
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      const json = editor.getJSON();
      const saved = await write(serializeBody(json));

      // Widened, if it has to be, so the split cuts no citation, link or picture in half.
      // The person was shown this on the panel before they pressed anything.
      const body = serializeBody(json);
      const range = wholeConstructs(
        body,
        splitStart(editor, json, splitting.from),
        offsetOf(json, splitting.to),
      );

      const result = await engine.document.split(
        document.id,
        range.start,
        range.end,
        title,
        saved.revision,
      );

      // The document in the editor is not the document any more: the text that moved is gone
      // and a link stands in its place. Set without emitting an update, or the change would
      // look like typing and be written straight back.
      revision.current = result.original.revision;
      editor.commands.setContent(parseBody(result.original.body), { emitUpdate: false });
      setSplitting(null);
      setState("clean");
      onSaved(result.original);
    } catch (thrown) {
      if (thrown instanceof EngineFailure && thrown.kind === "Conflict") {
        setState("conflict");
        setMessage(
          "This document changed on disk while you were editing, so it has not been split. Nothing has been overwritten. Reopen it to see the version on disk.",
        );
      } else {
        setState("error");
        setMessage(thrown instanceof EngineFailure ? thrown.message : String(thrown));
      }
      setSplitting(null);
    } finally {
      setSplittingNow(false);
    }
  }

  /** What the split would take, and what to call it, worked out from the selection. */
  function proposeSplit() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    setSplitting({ from, to });
  }

  // Splitting needs something selected, and saying so by disabling the button beats letting
  // somebody press it and be told. The editor re-renders on every transaction, selection
  // included, which is the same thing that keeps the heading buttons showing where the cursor
  // is.
  const hasSelection = editor !== null && !editor.state.selection.empty;

  return (
    <section className="editor">
      <header>
        <h2>
          <RenameableName
            name={document.title}
            label="document"
            onRename={(title) => onRename(document.id, title)}
          />
        </h2>
        <span className={`state ${state}`}>
          {state === "saving" ? "Saving…" : state === "clean" ? "Saved" : "Not saved"}
        </span>
        <button className="cite-action" onClick={() => setCiting(true)} disabled={citing}>
          Cite
        </button>
      </header>

      <div className="toolbar" role="toolbar" aria-label="Formatting">
        {LEVELS.map((level) => (
          <button
            key={level}
            className={editor?.isActive("heading", { level }) ? "tool on" : "tool"}
            aria-pressed={editor?.isActive("heading", { level }) ?? false}
            title={level === 1 ? "Heading" : `Heading, level ${level}`}
            onClick={() => editor?.chain().focus().toggleHeading({ level }).run()}
          >
            H{level}
          </button>
        ))}
        <button
          className="tool"
          title="Add a picture"
          onClick={() => setPicturing(true)}
          disabled={picturing}
        >
          Picture
        </button>
        <button
          className="tool"
          title="Link to another document"
          onClick={() => setLinking(true)}
          disabled={linking}
        >
          Link
        </button>
        <button
          className="tool"
          title="Take the selected text out into a document of its own"
          onClick={proposeSplit}
          disabled={splitting !== null || !hasSelection}
        >
          Split
        </button>
      </div>

      {message && <p className={state === "conflict" ? "warning" : "error"}>{message}</p>}

      {citing && <CitePicker onChoose={insert} onCancel={() => setCiting(false)} />}

      {picturing && (
        <ImagePicker
          document={document.id}
          onInserted={inserted}
          onCancel={() => setPicturing(false)}
        />
      )}

      {splitting && (
        <SplitPicker
          suggested={suggestedTitle(editor, splitting)}
          preview={previewOf(editor, splitting)}
          widened={widenedBy(editor, splitting)}
          busy={splittingNow}
          onSplit={(title) => void split(title)}
          onCancel={() => setSplitting(null)}
        />
      )}

      {linking && (
        <LinkPicker
          topics={topics}
          exclude={document.id}
          onChoose={linked}
          onCancel={() => setLinking(false)}
        />
      )}

      <RenderedCitations.Provider value={rendered}>
        <DocumentImages.Provider value={shown}>
          <DocumentLinks.Provider value={links}>
            <EditorContent editor={editor} className="prose" />
          </DocumentLinks.Provider>
        </DocumentImages.Provider>
      </RenderedCitations.Provider>

      <ReferenceList entries={cited === "" ? [] : references} />

      <Backlinks entries={backlinks} onOpen={onOpenDocument} />

      <footer className="note">
        Markdown with citations, links and pictures. Type <code># </code> for a heading, up to
        six deep. Lists and emphasis are still written plainly — nothing is rendered here that
        could not be written back to your file exactly as you typed it.
      </footer>
    </section>
  );
}

/**
 * Where what moves begins, in the file.
 *
 * Almost always just the selection's own offset. The exception is a selection starting at the
 * first letter of a heading: the hashes live *before* the content, so nobody can highlight
 * them, and taking them at their word would leave `## [[link]]` behind — a heading wrapped
 * round a link — and give the new document a first line that used to be a heading and is now
 * prose. Dragging from the start of a heading means the heading.
 */
function splitStart(editor: TipTapEditor, doc: JSONContent, from: number): number {
  const at = offsetOf(doc, from);
  const here = editor.state.doc.resolve(from);
  if (here.parent.type.name !== "heading" || from !== here.start()) return at;
  return Math.max(0, at - headingMarker(Number(here.parent.attrs["level"] ?? 1)).length);
}

/**
 * What to call the new document, guessed from what is moving.
 *
 * A heading at the top of the selection is almost always the answer — splitting off a section
 * is the ordinary case, and the section already has a name. Anything else is left blank rather
 * than guessed at from the prose, because a wrong suggestion in a text box is worse than an
 * empty one: it is a thing to notice and delete rather than a thing to type.
 *
 * Asked of the block the selection starts in, not of the text it covers. A heading's hashes
 * live before its content, so a person selecting a heading never selects them and looking for
 * `## ` in what moves finds nothing.
 */
function suggestedTitle(
  editor: TipTapEditor | null,
  at: { from: number; to: number },
): string {
  if (!editor) return "";
  const block = editor.state.doc.resolve(at.from).parent;
  return block.type.name === "heading" ? block.textContent.trim() : "";
}

/**
 * Whether the selection has to grow to keep a construct whole, and what kind.
 *
 * Worked out for the panel rather than only at the moment of splitting, because a selection
 * quietly growing is a surprise, and a surprise about somebody's own writing is the one kind
 * this application must not spring.
 */
function widenedBy(editor: TipTapEditor | null, at: { from: number; to: number }): boolean {
  if (!editor) return false;
  const json = editor.getJSON();
  return wholeConstructs(
    serializeBody(json),
    splitStart(editor, json, at.from),
    offsetOf(json, at.to),
  ).widened;
}

/** The start of what would move, so the choice can be checked against the text. */
function previewOf(editor: TipTapEditor | null, at: { from: number; to: number }): string {
  if (!editor) return "";
  const text = editor.state.doc.textBetween(at.from, at.to, " ").trim();
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

/** Re-exported so the node can find its view without importing this module. */
export { CitationView };

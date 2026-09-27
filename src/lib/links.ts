// Putting a link to another document into the editor's document.
//
// Separate from `LinkPicker` for the same reason `insertCitation` is separate from
// `CitePicker`: what it does to the document is worth testing without a dialog in front of it.

import type { Editor } from "@tiptap/core";

import { DOCUMENT_LINK } from "./body";
// Type-only, so nothing of the Tauri bridge is pulled in here and this file stays testable
// without a desktop runtime behind it.
import type { Topic } from "./engine";

/**
 * Insert a link at the cursor, after the selection rather than over it.
 *
 * The collapse is the whole point, and this is the third construct to need it. `insertContent`
 * **replaces** a live selection, so somebody who had a phrase selected when they added a link
 * would watch the phrase disappear — and the autosave a moment later would write the loss to
 * disk.
 */
export function insertLink(editor: Editor, document: string): void {
  const { to } = editor.state.selection;
  editor
    .chain()
    .focus()
    .setTextSelection(to)
    .insertContent({ type: DOCUMENT_LINK, attrs: { document } })
    .run();
}

/** One document, and the topic path that says which one it is. */
export type Linkable = { id: string; title: string; where: string };

/**
 * Every document in the library, flattened out of the topic tree, each carrying the path to
 * it.
 *
 * The path is what makes a list of titles usable. Two documents called "Notes" in different
 * topics are two different things, and a picker that shows them as one line repeated twice is
 * asking somebody to guess.
 */
export function linkable(topics: Topic[], exclude?: string): Linkable[] {
  const out: Linkable[] = [];

  const walk = (topic: Topic, path: string[]) => {
    const here = [...path, topic.name];
    for (const doc of topic.documents) {
      if (doc.id === exclude) continue;
      out.push({ id: doc.id, title: doc.title, where: here.join(" › ") });
    }
    for (const child of topic.children) walk(child, here);
  };

  for (const topic of topics) walk(topic, []);
  return out;
}

/** Every document in the library by identifier, for drawing a link as its title. */
export function titlesOf(topics: Topic[]): Map<string, string> {
  const titles = new Map<string, string>();
  const walk = (topic: Topic) => {
    for (const doc of topic.documents) titles.set(doc.id, doc.title);
    for (const child of topic.children) walk(child);
  };
  for (const topic of topics) walk(topic);
  return titles;
}

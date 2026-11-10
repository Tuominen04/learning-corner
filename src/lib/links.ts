// Putting a link to another document into the editor's document.
//
// Separate from `LinkPicker` for the same reason `insertCitation` is separate from
// `CitePicker`: what it does to the document is worth testing without a dialog in front of it.

import type { Editor } from "@tiptap/core";

import { DOCUMENT_LINK } from "./body";
// Type-only, so nothing of the Tauri bridge is pulled in here and this file stays testable
// without a desktop runtime behind it.
import type { Page } from "./engine";

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

/** One page, and the path of pages it is under that says which one it is. */
export type Linkable = { id: string; title: string; where: string };

/**
 * Every page in the library, flattened out of the tree in its order, each carrying the path of
 * pages it is under — empty at the top level.
 *
 * The path is what makes a list of titles usable. Two pages called "Notes" under different
 * pages are two different things, and a picker that shows them as one line repeated twice is
 * asking somebody to guess.
 */
export function linkable(pages: Page[], exclude?: string): Linkable[] {
  const out: Linkable[] = [];
  const walk = (page: Page, path: string[]) => {
    if (page.id !== exclude) out.push({ id: page.id, title: page.title, where: path.join(" › ") });
    for (const child of page.children) walk(child, [...path, page.title]);
  };
  for (const page of pages) walk(page, []);
  return out;
}

/** Every page in the library by identifier, for drawing a link as its title. */
export function titlesOf(pages: Page[]): Map<string, string> {
  const titles = new Map<string, string>();
  const walk = (page: Page) => {
    titles.set(page.id, page.title);
    for (const child of page.children) walk(child);
  };
  for (const page of pages) walk(page);
  return titles;
}

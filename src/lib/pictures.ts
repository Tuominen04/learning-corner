// Putting a picture into the editor's document.
//
// Separate from `ImagePicker` for the same reason `insertCitation` is separate from
// `CitePicker`: what it does to the document is worth testing without a dialog in front of it.

import type { Editor } from "@tiptap/core";

import { IMAGE } from "./body";

/**
 * Insert a picture at the cursor, after the selection rather than over it.
 *
 * The collapse is the whole point. `insertContent` **replaces** a live selection, so a user
 * who had a phrase selected when they added a picture would watch the phrase disappear — and
 * the autosave a moment later would write the loss to disk. Citations learned this the hard
 * way; a picture inserts the same way for the same reason.
 */
export function insertImage(editor: Editor, name: string, alt: string): void {
  const { to } = editor.state.selection;
  editor
    .chain()
    .focus()
    .setTextSelection(to)
    .insertContent({ type: IMAGE, attrs: { name, alt } })
    .run();
}

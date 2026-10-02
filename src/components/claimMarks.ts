import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { findClaims } from "../lib/claims";

// The marks that say which sentences are claims, drawn over the text and never written into
// it. Off until somebody asks for them: a page of highlighting is a lot to write in, and the
// summary above the text already says how many there are.

type Marks = { show: boolean; marks: DecorationSet };

const key = new PluginKey<Marks>("claimMarks");

function marksFor(doc: ProseMirrorNode): DecorationSet {
  return DecorationSet.create(
    doc,
    findClaims(doc).map((claim) => Decoration.inline(claim.from, claim.to, { class: "claim" })),
  );
}

export const ClaimMarks = Extension.create({
  name: "claimMarks",

  addProseMirrorPlugins() {
    return [
      new Plugin<Marks>({
        key,
        state: {
          init: () => ({ show: false, marks: DecorationSet.empty }),
          apply(tr, had, _before, after) {
            const asked = tr.getMeta(key) as boolean | undefined;
            const show = asked ?? had.show;
            if (!show) return { show, marks: DecorationSet.empty };
            // Worked out again rather than carried along: one full stop typed can turn a
            // sentence into two, or two into one, and moving the old marks cannot know that.
            if (asked !== undefined || tr.docChanged) return { show, marks: marksFor(after.doc) };
            return had;
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.marks,
        },
      }),
    ];
  },
});

/**
 * Show the marks, or stop showing them.
 *
 * A transaction that changes nothing in the document, so it is not typing: nothing is saved
 * and nothing is undone by it.
 */
export function showClaims(editor: Editor, show: boolean): void {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(key, show).setMeta("addToHistory", false));
}

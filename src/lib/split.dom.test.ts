// @vitest-environment jsdom
//
// The position mapping, checked against a real editor rather than against arithmetic.
//
// `body.test.ts` covers this too, with positions worked out by hand — and the first draft of
// those had three of them wrong, which is exactly the problem: a mapping tested only against
// numbers somebody computed is a mapping tested against the same misunderstanding twice.
//
// ProseMirror is the oracle here. For plain prose it can say what a selection contains, and
// what it says has to match what the offsets pick out of the file, for **every** selection in
// the document rather than for the handful anybody would think to write down.

import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import History from "@tiptap/extension-history";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { afterEach, describe, expect, it } from "vitest";

import { offsetOf, parseBody, serializeBody } from "./body";
import { Citation, DocumentImage, DocumentLink } from "../components/nodes";

let editor: Editor | null = null;

function open(body: string): Editor {
  editor = new Editor({
    element: window.document.createElement("div"),
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
    content: parseBody(body),
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("every selection a user could make", () => {
  // Plain prose only, because this is the case where ProseMirror can be asked what a
  // selection contains and give an answer in the file's own terms.
  const documents = [
    "Protein repairs tissue",
    "One.\n\nTwo.",
    "One.\n\nTwo.\n\nThree.",
    "Ääkköset ja öljy.\n\nЯ вас любил.",
    "A.\n\nB.\n\nC.\n\nD.\n\nE.",
  ];

  it.each(documents)("picks out of %j exactly what the editor says is selected", (body) => {
    const editor = open(body);
    const doc = editor.getJSON();
    const text = serializeBody(doc);
    expect(text).toBe(body);

    // Only the positions a cursor can actually occupy.
    //
    // Between two paragraphs there is a position that belongs to no text block, and there the
    // two systems genuinely cannot agree: the blank line is two characters in the file and no
    // positions at all in the editor, so it has to belong to *some* pair and ProseMirror says
    // it belongs to none. No selection a person can make has an endpoint there — `resolve`
    // says its parent is the document rather than a block — so the disagreement is unreachable
    // rather than papered over. What `offsetOf` answers there is pinned in `body.test.ts`.
    const size = editor.state.doc.content.size;
    const reachable = [];
    for (let pos = 0; pos <= size; pos += 1) {
      if (editor.state.doc.resolve(pos).parent.isTextblock) reachable.push(pos);
    }

    for (const from of reachable) {
      for (const to of reachable) {
        if (to < from) continue;
        const sliced = text.slice(offsetOf(doc, from), offsetOf(doc, to));
        // `textBetween` with a block separator is ProseMirror's own answer to "what is
        // between these two positions", in the same shape the file uses.
        const selected = editor.state.doc.textBetween(from, to, "\n\n");
        expect(sliced).toBe(selected);
      }
    }
  });
});

describe("what the mapping must never do", () => {
  // The documents ProseMirror cannot be asked about, because a citation is one position and
  // thirty-five characters. What still has to hold is that the offsets stay in order and stay
  // inside the file — an offset that goes backwards or runs off the end is a split that takes
  // the wrong text, or panics the engine.
  const documents = [
    "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G] And more.",
    "# Heading\n\n## Sub-heading\n\nProse under it.",
    "See ![Diagram](d.png) and [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]] there.",
    "###### Deep\n\nÄäkköset.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44!narrative]",
  ];

  it.each(documents)("never goes backwards or off the end in %j", (body) => {
    const editor = open(body);
    const doc = editor.getJSON();
    const text = serializeBody(doc);

    let previous = -1;
    for (let pos = 0; pos <= editor.state.doc.content.size; pos += 1) {
      const at = offsetOf(doc, pos);
      expect(at).toBeGreaterThanOrEqual(previous);
      expect(at).toBeLessThanOrEqual(text.length);
      previous = at;
    }
  });

  it.each(documents)("never lands inside a character in %j", (body) => {
    // The engine refuses a range that would cut a character in half, so an offset that lands
    // there is a split that fails — and in Finnish and Russian that is the common case, not
    // the exotic one.
    const editor = open(body);
    const doc = editor.getJSON();
    const text = serializeBody(doc);
    const units = [...text].reduce<Set<number>>((at, ch) => {
      const last = at.size === 0 ? 0 : Math.max(...at);
      return at.add(last + ch.length);
    }, new Set([0]));

    for (let pos = 0; pos <= editor.state.doc.content.size; pos += 1) {
      expect(units.has(offsetOf(doc, pos))).toBe(true);
    }
  });
});

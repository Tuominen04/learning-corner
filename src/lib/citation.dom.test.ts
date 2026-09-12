// @vitest-environment jsdom
//
// Where a citation lands, against a real editor.
//
// This file needs a DOM — the rest of `src/lib` does not — because the behaviour it guards is
// a ProseMirror transaction, and the defect it guards against was silent data loss: inserting
// into a live selection replaced it, so citing a sentence you had selected deleted the
// sentence and the autosave wrote the loss to disk a moment later. Nothing short of a real
// editor with a real selection catches that.

import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { afterEach, describe, expect, it } from "vitest";

import { serializeBody } from "./body";
import { insertCitation } from "./citation";
import { Citation, DocumentLink } from "../components/nodes";

const SOURCE = "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G";

let editor: Editor | null = null;

function open(body: string): Editor {
  editor = new Editor({
    element: window.document.createElement("div"),
    // The same schema the editor screen builds, so the transaction being tested is the one
    // that actually runs.
    extensions: [Document, Paragraph, Text, History, Citation, DocumentLink],
    content: body,
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("inserting a citation", () => {
  it("keeps the words you selected and puts the citation after them", () => {
    const editor = open("<p>Protein repairs muscle tissue</p>");

    // Select "muscle tissue" — the guide's own flow is to select your claim, then cite it.
    const text = "Protein repairs muscle tissue";
    const from = 1 + text.indexOf("muscle tissue");
    editor.commands.setTextSelection({ from, to: from + "muscle tissue".length });

    insertCitation(editor, { source: SOURCE, locator: "44", form: "parenthetical" });

    expect(serializeBody(editor.getJSON())).toBe(
      `Protein repairs muscle tissue[^cite:${SOURCE}@44]`,
    );
  });

  it("writes at the cursor when nothing is selected", () => {
    const editor = open("<p>Protein repairs muscle tissue</p>");
    editor.commands.focus("end");

    insertCitation(editor, { source: SOURCE, locator: null, form: "narrative" });

    expect(serializeBody(editor.getJSON())).toBe(
      `Protein repairs muscle tissue[^cite:${SOURCE}!narrative]`,
    );
  });

  it("leaves the text before the selection alone", () => {
    const editor = open("<p>One two three</p>");
    editor.commands.setTextSelection({ from: 1, to: 4 }); // "One"

    insertCitation(editor, { source: SOURCE, locator: "chapter:3", form: "parenthetical" });

    expect(serializeBody(editor.getJSON())).toBe(`One[^cite:${SOURCE}@chapter:3] two three`);
  });
});

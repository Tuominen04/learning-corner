// @vitest-environment jsdom
//
// Where a picture lands, and what a heading does to the text under it.
//
// Both need a real editor. The first guards the same defect citations had — inserting into a
// live selection replaces it, and the autosave writes the loss a moment later. The second
// guards the round trip through the editor rather than through `parseBody` alone: a heading
// the schema quietly drops still round-trips in `body.test.ts`, because that file never opens
// an editor.

import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import History from "@tiptap/extension-history";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { afterEach, describe, expect, it } from "vitest";

import { parseBody, serializeBody } from "./body";
import { insertLink } from "./links";
import { insertImage } from "./pictures";
import { Citation, DocumentImage, DocumentLink } from "../components/nodes";

let editor: Editor | null = null;

/** The same schema the editor screen builds, so what is tested is what runs. */
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

describe("inserting a picture", () => {
  it("keeps the words you selected and puts the picture after them", () => {
    const editor = open("Protein repairs muscle tissue");

    const text = "Protein repairs muscle tissue";
    const from = 1 + text.indexOf("muscle tissue");
    editor.commands.setTextSelection({ from, to: from + "muscle tissue".length });

    insertImage(editor, "diagram.png", "Muscle repair");

    expect(serializeBody(editor.getJSON())).toBe(
      "Protein repairs muscle tissue![Muscle repair](diagram.png)",
    );
  });

  it("writes at the cursor when nothing is selected", () => {
    const editor = open("Protein repairs muscle tissue");
    editor.commands.focus("end");

    insertImage(editor, "diagram.png", "Muscle repair");

    expect(serializeBody(editor.getJSON())).toBe(
      "Protein repairs muscle tissue![Muscle repair](diagram.png)",
    );
  });

  it("leaves the text after the cursor alone", () => {
    const editor = open("One two three");
    editor.commands.setTextSelection({ from: 1, to: 4 }); // "One"

    insertImage(editor, "d.png", "A diagram");

    expect(serializeBody(editor.getJSON())).toBe("One![A diagram](d.png) two three");
  });

  it("survives an empty alt text", () => {
    const editor = open("");
    editor.commands.focus("end");

    insertImage(editor, "d.png", "");

    expect(serializeBody(editor.getJSON())).toBe("![](d.png)");
  });
});

describe("inserting a link", () => {
  const TARGET = "01J8ZQ9C3P5R7T9V1X3Z5B7D9F";

  it("keeps the words you selected and puts the link after them", () => {
    // The third construct to need the collapse. `insertContent` replaces a live selection, so
    // without it, linking a phrase you had selected would delete the phrase — and the autosave
    // would write the loss to disk a moment later.
    const editor = open("Protein repairs muscle tissue");

    const text = "Protein repairs muscle tissue";
    const from = 1 + text.indexOf("muscle tissue");
    editor.commands.setTextSelection({ from, to: from + "muscle tissue".length });

    insertLink(editor, TARGET);

    expect(serializeBody(editor.getJSON())).toBe(
      `Protein repairs muscle tissue[[${TARGET}]]`,
    );
  });

  it("writes at the cursor when nothing is selected", () => {
    const editor = open("See also ");
    editor.commands.focus("end");

    insertLink(editor, TARGET);

    expect(serializeBody(editor.getJSON())).toBe(`See also [[${TARGET}]]`);
  });

  it("leaves the text after the cursor alone", () => {
    const editor = open("One two three");
    editor.commands.setTextSelection({ from: 1, to: 4 }); // "One"

    insertLink(editor, TARGET);

    expect(serializeBody(editor.getJSON())).toBe(`One[[${TARGET}]] two three`);
  });
});

describe("a document through the editor", () => {
  // `body.test.ts` round-trips through `parseBody` and `serializeBody` and never builds a
  // schema. A node the schema does not accept is dropped silently on the way in, so these are
  // the same documents again, this time through the thing the user actually types into.
  const documents = [
    "# What protein is\n\nProtein is built from amino acids.",
    "## In the body\n\n### Repair\n\nNine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44]",
    "###### The deepest heading Markdown has",
    "![Amino acid diagram](diagram.png)",
    "As shown ![here](d.png) the bond forms.",
    "# Title\n\n![Diagram](d.png)\n\nSee [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]].",
  ];

  it.each(documents)("opens and saves %s unchanged", (body) => {
    expect(serializeBody(open(body).getJSON())).toBe(body);
  });
});

describe("making a heading", () => {
  it("writes the hashes into the file", () => {
    const editor = open("What protein is");
    editor.commands.focus("end");

    editor.chain().focus().toggleHeading({ level: 2 }).run();

    expect(serializeBody(editor.getJSON())).toBe("## What protein is");
  });

  it("takes them away again", () => {
    const editor = open("## What protein is");
    editor.commands.focus("end");

    editor.chain().focus().toggleHeading({ level: 2 }).run();

    expect(serializeBody(editor.getJSON())).toBe("What protein is");
  });

  it("leaves a citation in the heading where it was", () => {
    const editor = open("Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44]");
    editor.commands.focus("end");

    editor.chain().focus().toggleHeading({ level: 3 }).run();

    expect(serializeBody(editor.getJSON())).toBe(
      "### Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44]",
    );
  });
});

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

import { parseBody, serializeBody } from "./body";
import { insertCitation } from "./citation";
import type { Form } from "./engine";
import { Citation, DocumentLink } from "../components/nodes";

const SOURCE = "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G";

// Every editor a test opens, so that all of them are destroyed when it ends — not only the
// last. One left running keeps answering the selection changes of the others, and a timer it
// sets can fire after the test file is over, failing a run whose tests all passed.
const opened: Editor[] = [];

function open(body: string): Editor {
  const editor = new Editor({
    element: window.document.createElement("div"),
    // The same schema the editor screen builds, so the transaction being tested is the one
    // that actually runs.
    extensions: [Document, Paragraph, Text, History, Citation, DocumentLink],
    content: body,
  });
  opened.push(editor);
  return editor;
}

afterEach(() => {
  for (const each of opened.splice(0)) each.destroy();
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

    // A narrative citation is a name in the sentence, so it is spaced from the word before.
    expect(serializeBody(editor.getJSON())).toBe(
      `Protein repairs muscle tissue [^cite:${SOURCE}!narrative]`,
    );
  });

  it("leaves the text before the selection alone", () => {
    const editor = open("<p>One two three</p>");
    editor.commands.setTextSelection({ from: 1, to: 4 }); // "One"

    insertCitation(editor, { source: SOURCE, locator: "chapter:3", form: "parenthetical" });

    expect(serializeBody(editor.getJSON())).toBe(`One[^cite:${SOURCE}@chapter:3] two three`);
  });
});

describe("a citation and the full stop", () => {
  // APA puts a parenthetical citation inside the sentence it supports: `tissue (Nieminen,
  // 2021).` Selecting a sentence takes its full stop along, so the citation steps back over it.

  /** Select the whole paragraph, or from `from` to the end of it, and cite. */
  function cite(html: string, form: "parenthetical" | "narrative" = "parenthetical", from = 1) {
    const editor = open(html);
    editor.commands.setTextSelection({ from, to: editor.state.doc.content.size - 1 });
    insertCitation(editor, { source: SOURCE, locator: null, form });
    return serializeBody(editor.getJSON());
  }

  const c = `[^cite:${SOURCE}]`;

  it("goes in front of the full stop that ends the selected sentence", () => {
    expect(cite("<p>Protein repairs tissue.</p>")).toBe(`Protein repairs tissue${c}.`);
  });

  it("and in front of the space after it, when that was selected too", () => {
    const editor = open("<p>Protein repairs tissue. Water is wet.</p>");
    const text = "Protein repairs tissue. Water is wet.";
    editor.commands.setTextSelection({ from: 1, to: 1 + text.indexOf("Water") });
    insertCitation(editor, { source: SOURCE, locator: null, form: "parenthetical" });
    expect(serializeBody(editor.getJSON())).toBe(`Protein repairs tissue${c}. Water is wet.`);
  });

  it("goes in front of a question mark, an exclamation, or several", () => {
    expect(cite("<p>Is protein essential?</p>")).toBe(`Is protein essential${c}?`);
    expect(cite("<p>Really?!</p>")).toBe(`Really${c}?!`);
    expect(cite("<p>And so on…</p>")).toBe(`And so on${c}…`);
  });

  it("works the same in Finnish and Russian", () => {
    expect(cite("<p>Proteiini korjaa kudosta.</p>")).toBe(`Proteiini korjaa kudosta${c}.`);
    expect(cite("<p>Белок важен.</p>")).toBe(`Белок важен${c}.`);
  });

  it("lands beside a citation already there", () => {
    const editor = open("<p>Protein repairs tissue.</p>");
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
    insertCitation(editor, { source: SOURCE, locator: "44", form: "parenthetical" });
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
    insertCitation(editor, { source: SOURCE, locator: null, form: "parenthetical" });
    expect(serializeBody(editor.getJSON())).toBe(
      `Protein repairs tissue[^cite:${SOURCE}@44]${c}.`,
    );
  });

  it("goes in front of the full stop after a link that ends the sentence", () => {
    // The link is one position in the document and no letters in its text; counted as
    // nothing, the sentence would seem to end in a bare full stop and the citation stay after.
    const LINKED = "01J8ZQ9C3P5R7T9V1X3Z5B7D9F";
    const editor = open("");
    editor.commands.setContent(parseBody(`See [[${LINKED}]].`));
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
    insertCitation(editor, { source: SOURCE, locator: null, form: "parenthetical" });
    expect(serializeBody(editor.getJSON())).toBe(`See [[${LINKED}]]${c}.`);
  });

  it("leaves the full stop of an abbreviation alone", () => {
    // Stepping in front of it would cut `jne.` down to `jne`.
    expect(cite("<p>Proteiinia, rasvaa jne.</p>")).toBe(`Proteiinia, rasvaa jne.${c}`);
    expect(cite("<p>Common in the U.S.</p>")).toBe(`Common in the U.S.${c}`);
    expect(cite("<p>Shown in Fig. 3.</p>")).toBe(`Shown in Fig. 3.${c}`);
    expect(cite("<p>Sugar, salt etc.</p>")).toBe(`Sugar, salt etc.${c}`);
  });

  it("leaves a full stop inside a quotation where it is", () => {
    expect(cite('<p>He said "enough."</p>')).toBe(`He said "enough."${c}`);
  });

  it("does not move a narrative citation, which is a name in the sentence", () => {
    // Left after the full stop, where it starts the next sentence — spaced, so it does.
    expect(cite("<p>As shown.</p>", "narrative")).toBe(
      `As shown. [^cite:${SOURCE}!narrative]`,
    );
  });

  it("does not move past anything when nothing closes the sentence", () => {
    expect(cite("<p>Protein repairs tissue</p>")).toBe(`Protein repairs tissue${c}`);
    expect(cite("<p>.</p>")).toBe(`.${c}`);
  });
});

describe("a citation never runs into a word", () => {
  // A chip looks spaced in the editor either way. The file does not: what is not there is
  // missing from every export, as `Nieminen (2021)quam`.
  const LINKED = "01J8ZQ9C3P5R7T9V1X3Z5B7D9F";
  const narrative = `[^cite:${SOURCE}!narrative]`;

  function citeAt(body: string, at: (text: string) => number, form: Form) {
    const editor = open("");
    editor.commands.setContent(parseBody(body));
    const position = at(editor.state.doc.textContent);
    editor.commands.setTextSelection(position);
    insertCitation(editor, { source: SOURCE, locator: null, form });
    return serializeBody(editor.getJSON());
  }

  it("is spaced from the word after it", () => {
    // The report: the cursor after "sed ", a narrative citation, and "quam?" straight after.
    expect(
      citeAt("Egestas in sed quam?", (t) => 1 + t.indexOf("quam"), "narrative"),
    ).toBe(`Egestas in sed ${narrative} quam?`);
    expect(
      citeAt("Protein repairs tissue", (t) => 1 + t.indexOf("repairs"), "parenthetical"),
    ).toBe(`Protein [^cite:${SOURCE}] repairs tissue`);
  });

  it("is spaced from a link after it, which reads as words", () => {
    expect(citeAt(`[[${LINKED}]] is a page`, () => 1, "narrative")).toBe(
      `${narrative} [[${LINKED}]] is a page`,
    );
  });

  it("in the sentence, is spaced from the word before it", () => {
    expect(
      citeAt("Egestas in sed quam?", (t) => 1 + t.indexOf(" quam"), "narrative"),
    ).toBe(`Egestas in sed ${narrative} quam?`);
  });

  it("in the sentence, is spaced from a citation before it", () => {
    expect(citeAt(`Claim[^cite:${SOURCE}]`, (t) => 2 + t.length, "narrative")).toBe(
      `Claim[^cite:${SOURCE}] ${narrative}`,
    );
  });

  it("adds nothing where nothing is needed", () => {
    // After an opening bracket; before punctuation; next to a space already there.
    expect(citeAt("See (here)", (t) => 1 + t.indexOf("here"), "narrative")).toBe(
      `See (${narrative} here)`,
    );
    expect(citeAt("Protein repairs tissue.", (t) => 1 + t.indexOf("."), "parenthetical")).toBe(
      `Protein repairs tissue[^cite:${SOURCE}].`,
    );
    expect(
      citeAt("Protein repairs tissue", (t) => 1 + t.indexOf(" repairs"), "parenthetical"),
    ).toBe(`Protein[^cite:${SOURCE}] repairs tissue`);
  });
});

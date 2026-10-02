// @vitest-environment jsdom
//
// Which sentences are claims, asked of a real editor holding real documents — the positions
// the marks are drawn at are the editor's own, so that is where they are checked.

import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import History from "@tiptap/extension-history";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { afterEach, describe, expect, it } from "vitest";

import { parseBody } from "./body";
import { byPunctuation, citedSources, findClaims, sentences, type Splitter } from "./claims";
import { ClaimMarks, showClaims } from "../components/claimMarks";
import { Citation, DocumentImage, DocumentLink } from "../components/nodes";

const SOURCE = "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G";
const OTHER = "01J8ZQ8D4Q6S8W0W2Y4A6C8E0H";
const LINKED = "01J8ZQ9C3P5R7T9V1X3Z5B7D9F";
const cite = (id = SOURCE) => `[^cite:${id}]`;

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
      ClaimMarks,
    ],
    content: parseBody(body),
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** What each claim covers, with a citation written `[c]` and a link `[l]`. */
function claimed(body: string, split?: Splitter): string[] {
  const doc: ProseMirrorNode = open(body).state.doc;
  return findClaims(doc, split).map((claim) =>
    doc.textBetween(claim.from, claim.to, "", (leaf) =>
      leaf.type.name === "citation" ? "[c]" : "[l]",
    ),
  );
}

describe("what a claim is", () => {
  it("is the sentence a citation stands behind, and nothing else", () => {
    expect(claimed(`Protein is built from amino acids.${cite()} Water is wet.`)).toEqual([
      "Protein is built from amino acids.[c]",
    ]);
  });

  it("is that sentence whether the citation comes before the full stop or after it", () => {
    expect(claimed(`Protein repairs tissue${cite()}. Water is wet.`)).toEqual([
      "Protein repairs tissue[c].",
    ]);
  });

  it("belongs to the sentence before, when the citation sits after the space", () => {
    // Citations follow the claims they support. One left between two sentences is behind the
    // first, never in front of the second.
    expect(claimed(`Protein repairs tissue. ${cite()}Water is wet.`)).toEqual([
      "Protein repairs tissue. [c]",
    ]);
  });

  it("is one claim however many sources stand behind it", () => {
    expect(
      claimed(`Protein repairs tissue${cite()}${cite(OTHER)}. Water is wet.`),
    ).toEqual(["Protein repairs tissue[c][c]."]);
  });

  it("starts a paragraph when the citation does", () => {
    expect(claimed(`${cite()}Protein repairs tissue. Water is wet.`)).toEqual([
      "[c]Protein repairs tissue.",
    ]);
  });

  it("is found sentence by sentence through a long paragraph", () => {
    expect(
      claimed(
        `One thing. Protein repairs tissue.${cite()} Another thing. Eggs are complete.${cite(OTHER)} Done.`,
      ),
    ).toEqual(["Protein repairs tissue.[c]", "Eggs are complete.[c]"]);
  });

  it("stays inside its own paragraph", () => {
    expect(claimed(`An idea of mine.\n\nProtein repairs tissue.${cite()} Another idea.`)).toEqual([
      "Protein repairs tissue.[c]",
    ]);
  });

  it("is only the citation, in a paragraph that holds nothing else", () => {
    expect(claimed(cite())).toEqual(["[c]"]);
  });

  it("is nowhere in a document that cites nothing", () => {
    expect(claimed("Protein repairs tissue. Water is wet.")).toEqual([]);
  });
});

describe("what a sentence is", () => {
  it("does not end at a decimal point", () => {
    expect(claimed(`Adults need 0.8 g per kilogram.${cite()} Children need more.`)).toEqual([
      "Adults need 0.8 g per kilogram.[c]",
    ]);
  });

  it("carries on through a link to another document", () => {
    expect(claimed(`See [[${LINKED}]] for the kinds.${cite()} Next.`)).toEqual([
      "See [l] for the kinds.[c]",
    ]);
  });

  it("ends the same way in Finnish", () => {
    expect(claimed(`Proteiini koostuu aminohapoista.${cite()} Vesi on märkää.`)).toEqual([
      "Proteiini koostuu aminohapoista.[c]",
    ]);
  });

  it("and in Russian", () => {
    expect(claimed(`Белок состоит из аминокислот.${cite()} Вода мокрая.`)).toEqual([
      "Белок состоит из аминокислот.[c]",
    ]);
  });

  it("ends at a question or an exclamation too", () => {
    expect(claimed(`Is protein essential?${cite()} Yes! It is.`)).toEqual([
      "Is protein essential?[c]",
    ]);
  });
});

describe("splitting without the language's own rules", () => {
  // Where `Intl.Segmenter` is missing, plain punctuation stands in. It must agree on the
  // ordinary case, which is nearly every sentence anybody writes.
  it("agrees with the segmenter on ordinary prose", () => {
    const text = "Protein repairs tissue. Water is wet! Is it? Yes… it is.";
    const plain = byPunctuation(text).map((s) => text.slice(s.start, s.end));
    const proper = sentences(text).map((s) => text.slice(s.start, s.end));
    expect(plain).toEqual(proper);
  });

  it("finds the same claims", () => {
    const body = `Protein is built from amino acids.${cite()} Water is wet.`;
    expect(claimed(body, byPunctuation)).toEqual(claimed(body));
  });
});

describe("the sources a document cites", () => {
  it("are each named once, in the order they first appear", () => {
    const doc = open(`B first.${cite(OTHER)} A next.${cite()} B again.${cite(OTHER)}`).state.doc;
    expect(citedSources(doc)).toEqual([OTHER, SOURCE]);
  });
});

describe("the marks on the page", () => {
  const marked = (e: Editor) =>
    [...e.view.dom.querySelectorAll(".claim")].map((el) => el.textContent ?? "");

  it("are not there until asked for", () => {
    const e = open(`Protein repairs tissue.${cite()} Water is wet.`);
    expect(marked(e)).toEqual([]);
  });

  it("mark the claim when asked, and go when no longer wanted", () => {
    const e = open(`Protein repairs tissue.${cite()} Water is wet.`);
    showClaims(e, true);
    expect(marked(e).join("")).toContain("Protein repairs tissue.");
    expect(marked(e).join("")).not.toContain("Water");
    showClaims(e, false);
    expect(marked(e)).toEqual([]);
  });

  it("follow the typing", () => {
    // A full stop typed into a claim splits it, and only the half with the citation stays a
    // claim. Positions inside the first paragraph are one past the text's own offsets.
    const e = open(`Protein repairs tissue Water is wet${cite()}.`);
    showClaims(e, true);
    expect(marked(e).join("")).toContain("Protein");
    e.chain().insertContentAt(1 + e.state.doc.textContent.indexOf(" Water"), ".").run();
    const now = marked(e).join("");
    expect(now).toContain("Water is wet");
    expect(now).not.toContain("Protein");
  });

  it("are not something the document can undo", () => {
    // Showing the marks is not an edit: undo after showing them undoes nothing.
    const e = open(`Protein repairs tissue.${cite()}`);
    const before = e.getJSON();
    showClaims(e, true);
    e.commands.undo();
    expect(e.getJSON()).toEqual(before);
  });
});

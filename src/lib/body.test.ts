import { describe, expect, it } from "vitest";

import { offsetOf, parseBody, serializeBody } from "./body";

// Every case here is a document that must survive being opened and saved untouched. A failure
// in this file is silent data loss in the user's own files, which is the worst thing this
// application can do.
const roundTrips = [
  ["empty", ""],
  ["one line", "Protein is built from amino acids."],
  ["two paragraphs", "First paragraph.\n\nSecond paragraph."],
  ["a citation", "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G]"],
  ["a citation with a locator", "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44-46]"],
  ["a single page", "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44]"],
  ["a paragraph", "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@para:7]"],
  ["a chapter", "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@chapter:3]"],
  // The one that decides the parser: a timestamp carries colons of its own, so only the
  // first may separate the kind from the value.
  ["a timestamp", "An hour in.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@time:1:04:22]"],
  ["narrative form", "[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G!narrative] found nine."],
  ["narrative with a page", "[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44!narrative] found nine."],
  [
    "both forms of one source",
    "[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G!narrative] said so.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G]",
  ],
  // Refused rather than treated as a synonym for `@44`: two spellings for one value is how a
  // document stops round-tripping byte-identically. It stays literal text, and still survives.
  ["an explicit page kind, left as prose", "[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@page:44]"],
  ["an unknown locator kind, left as prose", "[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@section:2]"],
  ["a document link", "See [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]] for the kinds."],
  [
    "both, in one paragraph",
    "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G] See [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]].",
  ],
  ["adjacent constructs", "[[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]][^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G]"],
  ["Finnish and Cyrillic", "Ääkköset ja öljy. Я вас любил."],
  ["Markdown this editor does not render", "- a list item\n\n**bold** stays literal"],
  ["a heading", "# What protein is"],
  ["every heading level", "# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six"],
  ["a heading above its prose", "## In the body\n\nProtein is built from amino acids."],
  ["a heading with a citation in it", "## Nine[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44]"],
  // Seven hashes is not a heading in any reader; nor is a hash with no space after it.
  ["seven hashes, left as prose", "####### Not a heading"],
  ["a hash with no space, left as prose", "#NotAHeading"],
  ["a bare hash, left as prose", "#"],
  // `# Title` and the prose under it are two blocks in Markdown and one block here. Written
  // back as a heading it would lose the second line, so it stays text.
  ["a hash line joined to prose, left as prose", "# Title\nand prose on the next line"],
  ["a hash inside a heading", "# # not nested"],
  ["a closed heading, kept exactly", "## Heading ##"],
  ["an image", "![Amino acid diagram](diagram.png)"],
  ["an image with no alt text", "![](diagram.png)"],
  ["an image among prose", "As shown ![here](diagram.png) the bond forms."],
  ["two images in one paragraph", "![One](a.png) and ![Two](b.png)"],
  ["an image beside a citation", "![Diagram](d.png)[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G]"],
  // An ordinary link is not an image and is not rendered; it has to survive all the same.
  ["a link, left as prose", "See [the notes](notes.md) for more."],
  // Neither of these can be written back as `![alt](name)`, so neither is read as one.
  ["an image name with a space, left as prose", "![Diagram](my diagram.png)"],
  ["an unclosed image, left as prose", "![Diagram](diagram.png"],
  ["prose that resembles syntax", "An unclosed [[ and a [[not-an-id]] and a bare ] bracket."],
  ["blank line runs", "One.\n\n\n\nTwo."],
  ["trailing whitespace", "Ends with a space. "],
];

describe("body round-trip", () => {
  it.each(roundTrips)("preserves %s exactly", (_name, text) => {
    expect(serializeBody(parseBody(text as string))).toBe(text);
  });
});

describe("parsing", () => {
  it("recognises a citation as its own node", () => {
    const doc = parseBody("Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44-46]");
    const inline = doc.content?.[0]?.content ?? [];
    expect(inline).toHaveLength(2);
    expect(inline[1]).toMatchObject({
      type: "citation",
      attrs: { source: "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G", locator: "44-46" },
    });
  });

  it("recognises a document link as its own node", () => {
    const doc = parseBody("See [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]].");
    const inline = doc.content?.[0]?.content ?? [];
    expect(inline[1]).toMatchObject({
      type: "documentLink",
      attrs: { document: "01J8ZQ9C3P5R7T9V1X3Z5B7D9F" },
    });
  });

  it("leaves malformed syntax as ordinary text", () => {
    // Someone typing `[[` mid-sentence is writing prose, not a broken link.
    const doc = parseBody("An unclosed [[ and a [[not-an-id]].");
    const inline = doc.content?.[0]?.content ?? [];
    expect(inline).toHaveLength(1);
    expect(inline[0]?.type).toBe("text");
  });
});

// Round-tripping proves nothing at all about a heading: `####### Not a heading` survives
// perfectly either way. These say which blocks were *understood* as headings, which is what
// decides whether the file on disk still means what the editor is showing.
describe("what a heading says", () => {
  function block(text: string) {
    return parseBody(text).content?.[0];
  }

  it("reads one hash and a space as a first-level heading", () => {
    expect(block("# What protein is")).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    });
  });

  it("reads every level Markdown has", () => {
    for (let level = 1; level <= 6; level += 1) {
      expect(block(`${"#".repeat(level)} Heading`)).toMatchObject({
        type: "heading",
        attrs: { level },
      });
    }
  });

  it("keeps the heading's text out of the hashes", () => {
    const heading = block("### In the body");
    expect(heading?.content?.[0]).toMatchObject({ type: "text", text: "In the body" });
  });

  it("refuses a seventh hash rather than clamping it to six", () => {
    // No Markdown reader renders `#######` as a heading, so neither may this. Reading it as a
    // sixth-level heading would make the editor show a heading the file does not contain.
    expect(block("####### Not a heading")?.type).toBe("paragraph");
  });

  it("requires the space", () => {
    expect(block("#NotAHeading")?.type).toBe("paragraph");
    expect(block("#")?.type).toBe("paragraph");
  });

  it("leaves a hash line joined to prose alone", () => {
    // Two blocks in Markdown, one block here. Read as a heading it would have to be written
    // back as one line, and the prose under it would be gone.
    const joined = block("# Title\nand prose on the next line");
    expect(joined?.type).toBe("paragraph");
    expect(joined?.content).toHaveLength(1);
  });

  it("carries citations inside the heading", () => {
    const heading = block("## Nine[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44]");
    expect(heading?.content?.[1]).toMatchObject({
      type: "citation",
      attrs: { source: "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G", locator: "44" },
    });
  });

  it("writes back a level no Markdown reader would follow as the deepest one it would", () => {
    // Unreachable through `parseBody` and through the editor's schema, so this is about the
    // one remaining way in: a document model built by hand or by a future extension. `#######`
    // is not a heading, and a heading that stops being one is the document changing meaning
    // behind the user's back.
    expect(
      serializeBody({
        type: "doc",
        content: [{ type: "heading", attrs: { level: 9 }, content: [{ type: "text", text: "Deep" }] }],
      }),
    ).toBe("###### Deep");
  });
});

// The same for images: `![Diagram](my diagram.png)` round-trips as text, and would render as
// nothing. These say which ones became pictures.
describe("what an image says", () => {
  function image(text: string) {
    return (parseBody(text).content?.[0]?.content ?? []).find((n) => n.type === "image");
  }

  it("reads the alt text and the filename", () => {
    expect(image("![Amino acid diagram](diagram.png)")?.attrs).toMatchObject({
      alt: "Amino acid diagram",
      name: "diagram.png",
    });
  });

  it("accepts an empty alt text", () => {
    expect(image("![](diagram.png)")?.attrs).toMatchObject({ alt: "", name: "diagram.png" });
  });

  it("reads one in the middle of a sentence", () => {
    const inline = parseBody("As shown ![here](d.png) the bond forms.").content?.[0]?.content ?? [];
    expect(inline.map((n) => n.type)).toEqual(["text", "image", "text"]);
  });

  it("is not an ordinary link", () => {
    // `[text](url)` and `![alt](name)` differ by one character, and only one of them names a
    // file in the library.
    expect(image("See [the notes](notes.md) for more.")).toBeUndefined();
  });

  it("leaves a name it could not write back as text", () => {
    // Every name the engine hands out is a slug, so a name with a space in it was typed by
    // hand. Rendering it would mean writing back a line this file cannot reproduce.
    expect(image("![Diagram](my diagram.png)")).toBeUndefined();
    expect(image("![Diagram](diagram.png")).toBeUndefined();
  });

  it("does not run past the end of a line", () => {
    // Alt text stops at the newline, so an unclosed `![` cannot swallow the paragraph under
    // it and turn somebody's writing into a filename.
    expect(image("![Diagram\nand prose](diagram.png)")).toBeUndefined();
  });
});

// Round-tripping proves less than it looks. Text this parser does not recognise round-trips
// perfectly too — it simply stays text. These assert the citation was actually *understood*,
// which is what the reference list and the rendered citation depend on.
describe("what a citation says", () => {
  const ID = "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G";

  function citation(text: string) {
    const inline = parseBody(text).content?.[0]?.content ?? [];
    return inline.find((n) => n.type === "citation");
  }

  it("defaults to parenthetical, with no locator", () => {
    expect(citation(`[^cite:${ID}]`)?.attrs).toMatchObject({
      source: ID,
      locator: null,
      form: "parenthetical",
    });
  });

  it("reads a bare locator, which is a page", () => {
    expect(citation(`[^cite:${ID}@44-46]`)?.attrs).toMatchObject({ locator: "44-46" });
  });

  it("keeps every colon of a timestamp", () => {
    // Splitting on all colons would make the kind "1" and lose the rest of the timestamp.
    expect(citation(`[^cite:${ID}@time:1:04:22]`)?.attrs).toMatchObject({
      locator: "time:1:04:22",
    });
  });

  it("reads narrative form, with and without a locator", () => {
    expect(citation(`[^cite:${ID}!narrative]`)?.attrs).toMatchObject({
      form: "narrative",
      locator: null,
    });
    expect(citation(`[^cite:${ID}@44!narrative]`)?.attrs).toMatchObject({
      form: "narrative",
      locator: "44",
    });
  });

  it("refuses an explicit page kind rather than treating it as a synonym", () => {
    // `@page:44` would be a second spelling of `@44`, and two spellings for one value is how a
    // document stops round-tripping byte-identically. Left as text, and visible.
    expect(citation(`[^cite:${ID}@page:44]`)).toBeUndefined();
  });

  it("leaves an unrecognised locator kind as text rather than guessing", () => {
    // Reading `@section:2` as a page would cite a section as though it were a page number.
    // Wrong output is worse than text that plainly did not parse.
    expect(citation(`[^cite:${ID}@section:2]`)).toBeUndefined();
  });

  it("tells two citations of one source apart by their form", () => {
    const inline = parseBody(`[^cite:${ID}!narrative] said so.[^cite:${ID}]`).content?.[0]
      ?.content;
    const citations = (inline ?? []).filter((n) => n.type === "citation");
    expect(citations).toHaveLength(2);
    expect(citations[0]?.attrs?.["form"]).toBe("narrative");
    expect(citations[1]?.attrs?.["form"]).toBe("parenthetical");
  });
});


// Where a position in the editor lands in the text on disk.
//
// The two coordinate systems only agree on plain prose in one paragraph. Everywhere else they
// diverge, and a split computed on the assumption that they agree cuts somebody's document in
// the wrong place. Each case below is a way they come apart.
describe("editor positions to file offsets", () => {
  const ID = "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G";

  /**
   * What the offsets say the text is, for a selection from one position to another.
   *
   * Asserting on the *substring* rather than on the numbers: numbers are unreadable and a
   * test that agrees with a wrong implementation about them proves nothing. What matters is
   * which words would move.
   */
  function taken(text: string, from: number, to: number): string {
    const doc = parseBody(text);
    return text.slice(offsetOf(doc, from), offsetOf(doc, to));
  }

  it("matches character for character inside one paragraph", () => {
    // Position 1 is the start of the first paragraph's text, so it trails by exactly one.
    expect(taken("Protein repairs tissue", 1, 8)).toBe("Protein");
    expect(taken("Protein repairs tissue", 9, 16)).toBe("repairs");
  });

  it("counts the blank line between paragraphs, which the editor does not", () => {
    // "One." is 4 characters and 4 positions; the paragraph break is 2 characters and 2
    // positions, but they are not the same two, and by the third paragraph the drift is real.
    expect(taken("One.\n\nTwo.\n\nThree.", 7, 11)).toBe("Two.");
    expect(taken("One.\n\nTwo.\n\nThree.", 13, 19)).toBe("Three.");
  });

  it("counts a heading's hashes, which exist only on disk", () => {
    // `## ` is three characters in the file and no positions at all in the editor.
    expect(taken("## In the body\n\nProtein is used.", 1, 12)).toBe("In the body");
    expect(taken("## In the body\n\nProtein is used.", 14, 30)).toBe("Protein is used.");
  });

  it("counts a citation as one position and all of its characters", () => {
    // The case that breaks any formula. In the editor the citation is a single position; on
    // disk it is thirty-five characters, and everything after it is that much further along.
    const text = `Nine acids.[^cite:${ID}] And more.`;
    expect(taken(text, 1, 12)).toBe("Nine acids.");
    expect(taken(text, 13, 23)).toBe(" And more.");
  });

  it("counts a picture and a link the same way", () => {
    const text = `See ![Diagram](d.png) and [[${ID}]] there.`;
    expect(taken(text, 5, 6)).toBe("![Diagram](d.png)");
    expect(taken(text, 11, 12)).toBe(`[[${ID}]]`);
  });

  it("puts a block boundary at the end of what came before it", () => {
    // The position between two paragraphs belongs to no text block, so no cursor can sit
    // there and the editor cannot be asked what it means. It still has to mean something:
    // answering with the start of the *next* paragraph would drag the blank line into
    // whatever a split takes, and somebody would lose a line they did not highlight.
    //
    // For "One.\n\nTwo." the boundary is position 6, and the end of "One." is offset 4.
    expect(offsetOf(parseBody("One.\n\nTwo."), 6)).toBe(4);
  });

  it("puts the end of a paragraph at the end of its text", () => {
    // Not at the start of the next one. A selection to the end of a paragraph must not drag
    // the blank line after it into what moves.
    expect(taken("One.\n\nTwo.", 1, 5)).toBe("One.");
  });

  it("takes whole paragraphs when the selection spans them", () => {
    expect(taken("One.\n\nTwo.\n\nThree.", 1, 11)).toBe("One.\n\nTwo.");
  });

  it("clamps rather than running off the end", () => {
    const doc = parseBody("Short.");
    expect(offsetOf(doc, 0)).toBe(0);
    expect(offsetOf(doc, 999)).toBe(6);
  });

  it("is zero for an empty document", () => {
    expect(offsetOf(parseBody(""), 1)).toBe(0);
  });
});

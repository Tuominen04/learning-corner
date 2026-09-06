import { describe, expect, it } from "vitest";

import { parseBody, serializeBody } from "./body";

// Every case here is a document that must survive being opened and saved untouched. A failure
// in this file is silent data loss in the user's own files, which is the worst thing this
// application can do.
const roundTrips = [
  ["empty", ""],
  ["one line", "Protein is built from amino acids."],
  ["two paragraphs", "First paragraph.\n\nSecond paragraph."],
  ["a citation", "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G]"],
  ["a citation with a locator", "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44-46]"],
  ["a document link", "See [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]] for the kinds."],
  [
    "both, in one paragraph",
    "Nine acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G] See [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]].",
  ],
  ["adjacent constructs", "[[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]][^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G]"],
  ["Finnish and Cyrillic", "Ääkköset ja öljy. Я вас любил."],
  ["Markdown left as written", "# Heading\n\n- a list item\n\n**bold** stays literal"],
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

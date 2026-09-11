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

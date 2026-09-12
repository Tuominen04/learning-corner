import { describe, expect, it } from "vitest";

import { citationKey, toLocator, writeLocator } from "./citation";
import type { Locator } from "./engine";

// The written form and the wire form have to agree, and the asymmetry between them is the
// whole risk: `para:` on disk is `paragraph` on the wire. A mistranslation here does not fail
// loudly — it renders a paragraph citation as a page number.

describe("reading a written locator", () => {
  it("treats a bare value as a page", () => {
    expect(toLocator("44")).toEqual({ kind: "page", value: "44" });
    expect(toLocator("44-46")).toEqual({ kind: "page", value: "44-46" });
  });

  it("maps each short prefix to its full kind", () => {
    expect(toLocator("para:7")).toEqual({ kind: "paragraph", value: "7" });
    expect(toLocator("chapter:3")).toEqual({ kind: "chapter", value: "3" });
    expect(toLocator("time:1:04:22")).toEqual({ kind: "timestamp", value: "1:04:22" });
  });

  it("keeps every colon of a timestamp", () => {
    // Splitting on all colons makes the value "1" and throws away the minutes and seconds.
    expect(toLocator("time:1:04:22")).toEqual({ kind: "timestamp", value: "1:04:22" });
    expect(toLocator("time:0:15")).toEqual({ kind: "timestamp", value: "0:15" });
  });

  it("is absent for nothing at all", () => {
    expect(toLocator(null)).toBeNull();
    expect(toLocator("")).toBeNull();
  });

  it("refuses an unrecognised kind rather than guessing at a page", () => {
    // `section:2` read as a page would cite a section as though it were a page number. A
    // citation that renders without a locator is honest; one that renders the wrong locator
    // is not.
    expect(toLocator("section:2")).toBeNull();
    expect(toLocator("page:44")).toBeNull();
    expect(toLocator("time:")).toBeNull();
  });
});

describe("writing a locator back", () => {
  const cases: Locator[] = [
    { kind: "page", value: "44" },
    { kind: "page", value: "44-46" },
    { kind: "paragraph", value: "7" },
    { kind: "chapter", value: "3" },
    { kind: "timestamp", value: "1:04:22" },
  ];

  it.each(cases)("survives a round trip through the written form (%o)", (locator) => {
    expect(toLocator(writeLocator(locator))).toEqual(locator);
  });

  it("writes a page bare, because that is the format's one spelling for it", () => {
    // `page:44` would be a second spelling, and two spellings for one value is how a document
    // stops round-tripping byte-identically.
    expect(writeLocator({ kind: "page", value: "44" })).toBe("44");
  });

  it("is absent for nothing at all", () => {
    expect(writeLocator(null)).toBeNull();
  });
});

describe("identifying a rendered citation", () => {
  it("tells two citations of one source apart", () => {
    // Same source, different sentence: one is "Nieminen (2021)", the other
    // "(Nieminen, 2021, p. 44)". Keyed on the source alone they would collide.
    const a = citationKey("01J8ZQ", null, "narrative");
    const b = citationKey("01J8ZQ", null, "parenthetical");
    const c = citationKey("01J8ZQ", "44", "parenthetical");
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("gives the same citation the same key every time", () => {
    expect(citationKey("01J8ZQ", "44", "parenthetical")).toBe(
      citationKey("01J8ZQ", "44", "parenthetical"),
    );
  });
});

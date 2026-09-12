import { describe, expect, it } from "vitest";

import { readEmphasis } from "./references";

// The two entries below are real engine output, taken from the citing example rather than
// invented, so this is tested against what it will actually be given.
const ARTICLE = "Nieminen, A. M. (2021a). Amino acids in adults. *Journal of Nutrition*, *151*.";
const VIDEO = "Chen, W. (2020). *How muscle repairs* [Video]. Aalto University.";

/** What the entry reads as, ignoring which parts are emphasised. */
const flatten = (entry: string) =>
  readEmphasis(entry)
    .map((s) => s.text)
    .join("");

describe("reading emphasis", () => {
  it("finds the journal name and volume in an article", () => {
    expect(readEmphasis(ARTICLE)).toEqual([
      { text: "Nieminen, A. M. (2021a). Amino acids in adults. ", emphasis: false },
      { text: "Journal of Nutrition", emphasis: true },
      { text: ", ", emphasis: false },
      { text: "151", emphasis: true },
      { text: ".", emphasis: false },
    ]);
  });

  it("finds a video's title", () => {
    expect(readEmphasis(VIDEO)).toEqual([
      { text: "Chen, W. (2020). ", emphasis: false },
      { text: "How muscle repairs", emphasis: true },
      { text: " [Video]. Aalto University.", emphasis: false },
    ]);
  });

  it("leaves an entry with no emphasis alone", () => {
    const plain = "Nieminen, A. M. (2021). Amino acids in adults.";
    expect(readEmphasis(plain)).toEqual([{ text: plain, emphasis: false }]);
  });

  it("keeps a lone asterisk as a character", () => {
    // A title can contain one, and swallowing the rest of the entry to look for a partner
    // would turn a typo in someone's source into a mangled reference list.
    expect(readEmphasis("Smith, J. (2020). Rated 5* and nothing else.")).toEqual([
      { text: "Smith, J. (2020). Rated 5* and nothing else.", emphasis: false },
    ]);
  });

  it("never loses a character", () => {
    // The property that matters: everything that is not an asterisk comes back, in order.
    // Emphasis is a way of drawing the entry, never a way of editing it.
    for (const entry of [ARTICLE, VIDEO, "a*b", "*a*b*c", "**", "*", "", "a**b", "*only*"]) {
      expect(flatten(entry).replaceAll("*", "")).toBe(entry.replaceAll("*", ""));
    }
  });

  it("keeps an unpaired asterisk but not a paired one", () => {
    // The two halves of the rule above, pinned so neither can drift: a partnered asterisk is
    // consumed as markup, a lone one is kept as text.
    expect(flatten("*How muscle repairs*")).toBe("How muscle repairs");
    expect(flatten("5* hotel")).toBe("5* hotel");
  });

  it("handles an empty entry", () => {
    expect(readEmphasis("")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { folded, lineDiff, MOST_PAIRS } from "./diff";

const kinds = (text: string, other: string) =>
  lineDiff(text, other)?.map((l) => `${l.kind[0]}:${l.text}`);

describe("lineDiff", () => {
  it("finds nothing different in the same text", () => {
    expect(kinds("a\nb\n", "a\nb\n")).toEqual(["s:a", "s:b"]);
  });

  it("shows a changed line as the library's, then the drive's", () => {
    expect(kinds("a\nmine\nc", "a\ntheirs\nc")).toEqual(["s:a", "l:mine", "d:theirs", "s:c"]);
  });

  it("keeps the longest common run, wherever the changes are", () => {
    expect(kinds("x\na\nb\nc", "a\nb\ny\nc")).toEqual(["l:x", "s:a", "s:b", "d:y", "s:c"]);
  });

  it("handles a version with lines added or taken away", () => {
    expect(kinds("a\nc", "a\nb\nc")).toEqual(["s:a", "d:b", "s:c"]);
    expect(kinds("a\nb\nc", "a\nc")).toEqual(["s:a", "l:b", "s:c"]);
    expect(kinds("", "new")).toEqual(["d:new"]);
  });

  it("does not count a final line break, or Windows line ends, as a difference", () => {
    expect(kinds("a\nb", "a\nb\n")).toEqual(["s:a", "s:b"]);
    expect(kinds("a\r\nb\r\n", "a\nb\n")).toEqual(["s:a", "s:b"]);
  });

  it("gives up on two versions too long to compare here", () => {
    const side = Math.ceil(Math.sqrt(MOST_PAIRS)) + 1;
    const a = Array.from({ length: side }, (_, i) => `a${i}`).join("\n");
    const b = Array.from({ length: side }, (_, i) => `b${i}`).join("\n");
    expect(lineDiff(a, b)).toBeNull();
  });

  it("is not put off by a long file with one change, since the shared ends need no table", () => {
    const many = Array.from({ length: 50_000 }, (_, i) => `line ${i}`);
    const changed = [...many];
    changed[25_000] = "changed";
    const diff = lineDiff(many.join("\n"), changed.join("\n"));
    expect(diff?.filter((l) => l.kind !== "same")).toEqual([
      { kind: "library", text: "line 25000" },
      { kind: "drive", text: "changed" },
    ]);
  });
});

describe("folded", () => {
  it("keeps a few lines around each change and folds the rest", () => {
    const a = Array.from({ length: 20 }, (_, i) => `${i}`);
    const b = [...a];
    b[10] = "ten";
    const shown = folded(lineDiff(a.join("\n"), b.join("\n"))!, 2);
    expect(shown).toEqual([
      { kind: "skip", count: 8 },
      { kind: "same", text: "8" },
      { kind: "same", text: "9" },
      { kind: "library", text: "10" },
      { kind: "drive", text: "ten" },
      { kind: "same", text: "11" },
      { kind: "same", text: "12" },
      { kind: "skip", count: 7 },
    ]);
  });

  it("folds nothing when every line is near a change", () => {
    const shown = folded(lineDiff("a\nb", "a\nc")!, 3);
    expect(shown.some((l) => l.kind === "skip")).toBe(false);
  });
});

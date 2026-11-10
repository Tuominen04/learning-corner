import { describe, expect, it } from "vitest";

import { linkable, titlesOf } from "./links";
import type { Page } from "./engine";

const page = (id: string, title: string, children: Page[] = []): Page => ({ id, title, children });

// The tree, as the sidebar holds it: pages, with pages under them.
const LIBRARY: Page[] = [
  page("P1", "Protein", [
    page("D1", "What protein is"),
    page("D2", "Notes"),
    page("P2", "In the body", [page("D3", "How protein is used")]),
  ]),
  page("P3", "Sleep", [page("D4", "Notes")]),
];

describe("what there is to link to", () => {
  it("finds every page, however deep, in the tree's order", () => {
    expect(linkable(LIBRARY).map((d) => d.id)).toEqual(["P1", "D1", "D2", "P2", "D3", "P3", "D4"]);
  });

  it("says where each one lives", () => {
    // The point of the path. Two documents called "Notes" are two different things, and a
    // list showing them as one line repeated twice is asking somebody to guess.
    const notes = linkable(LIBRARY).filter((d) => d.title === "Notes");
    expect(notes).toHaveLength(2);
    expect(notes.map((d) => d.where).sort()).toEqual(["Protein", "Sleep"]);
  });

  it("spells out the whole path to a nested document", () => {
    expect(linkable(LIBRARY).find((d) => d.id === "D3")?.where).toBe("Protein › In the body");
  });

  it("leaves out the document being written", () => {
    // A document linking to itself is not a connection, and offering it offers a mistake.
    expect(linkable(LIBRARY, "D1").map((d) => d.id)).not.toContain("D1");
    expect(linkable(LIBRARY, "D1")).toHaveLength(6);
  });

  it("is empty for an empty library rather than throwing", () => {
    expect(linkable([])).toEqual([]);
    // And a page at the top is under nothing: its path is empty.
    expect(linkable([page("T", "Alone")])).toEqual([{ id: "T", title: "Alone", where: "" }]);
  });
});

describe("titles, for drawing a link", () => {
  it("knows every page in the library", () => {
    const titles = titlesOf(LIBRARY);
    expect(titles.get("D1")).toBe("What protein is");
    expect(titles.get("D3")).toBe("How protein is used");
    expect(titles.get("P1")).toBe("Protein");
    expect(titles.size).toBe(7);
  });

  it("does not know a document that is not there", () => {
    // Which is how a link to a deleted document comes to be drawn as missing rather than as
    // an empty space somebody would never notice.
    expect(titlesOf(LIBRARY).get("GONE")).toBeUndefined();
  });

  it("includes the open document, unlike the picker", () => {
    // Different question. A document can carry a link to itself — typed by hand, or left
    // behind by a split — and it still has to draw as its title rather than as missing.
    expect(titlesOf(LIBRARY).get("D1")).toBe("What protein is");
  });
});

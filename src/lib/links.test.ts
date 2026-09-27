import { describe, expect, it } from "vitest";

import { linkable, titlesOf } from "./links";
import type { Topic } from "./engine";

// The tree, as the sidebar holds it: nested topics, each with documents.
const LIBRARY: Topic[] = [
  {
    id: "T1",
    name: "Protein",
    documents: [
      { id: "D1", title: "What protein is" },
      { id: "D2", title: "Notes" },
    ],
    children: [
      {
        id: "T2",
        name: "In the body",
        documents: [{ id: "D3", title: "How protein is used" }],
        children: [],
      },
    ],
  },
  {
    id: "T3",
    name: "Sleep",
    documents: [{ id: "D4", title: "Notes" }],
    children: [],
  },
];

describe("what there is to link to", () => {
  it("finds every document, however deep", () => {
    expect(linkable(LIBRARY).map((d) => d.id).sort()).toEqual(["D1", "D2", "D3", "D4"]);
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
    expect(linkable(LIBRARY, "D1")).toHaveLength(3);
  });

  it("is empty for an empty library rather than throwing", () => {
    expect(linkable([])).toEqual([]);
    expect(linkable([{ id: "T", name: "Empty", documents: [], children: [] }])).toEqual([]);
  });
});

describe("titles, for drawing a link", () => {
  it("knows every document in the library", () => {
    const titles = titlesOf(LIBRARY);
    expect(titles.get("D1")).toBe("What protein is");
    expect(titles.get("D3")).toBe("How protein is used");
    expect(titles.size).toBe(4);
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

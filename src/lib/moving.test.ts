import { describe, expect, it } from "vitest";

import type { Topic } from "./engine";
import {
  canMove,
  destinations,
  findMoving,
  placeName,
  placeOf,
  whyNot,
  type Moving,
} from "./moving";

// Protein
// ├── What protein is
// └── In the body
//     ├── How protein is used
//     └── Organs
// Vitamins
const TREE: Topic[] = [
  {
    id: "protein",
    name: "Protein",
    documents: [{ id: "what", title: "What protein is" }],
    children: [
      {
        id: "body",
        name: "In the body",
        documents: [{ id: "how", title: "How protein is used" }],
        children: [{ id: "organs", name: "Organs", documents: [], children: [] }],
      },
    ],
  },
  { id: "vitamins", name: "Vitamins", documents: [], children: [] },
];

const doc = (id: string, title = id): Moving => ({ kind: "document", id, title });
const topic = (id: string, name = id): Moving => ({ kind: "topic", id, name });

describe("where something is", () => {
  it("finds a document's topic, however deep", () => {
    expect(placeOf(TREE, doc("what"))).toBe("protein");
    expect(placeOf(TREE, doc("how"))).toBe("body");
  });

  it("finds a topic's parent, and says when it is at the top", () => {
    expect(placeOf(TREE, topic("organs"))).toBe("body");
    expect(placeOf(TREE, topic("protein"))).toBeNull();
  });

  it("says so when it is not in the tree", () => {
    expect(placeOf(TREE, doc("gone"))).toBeUndefined();
  });
});

describe("where something may go", () => {
  it("a document goes into any other topic", () => {
    expect(canMove(TREE, doc("what"), "vitamins")).toBe(true);
    expect(canMove(TREE, doc("what"), "organs")).toBe(true);
  });

  it("but not where it already is, and not loose at the top", () => {
    expect(whyNot(TREE, doc("what"), "protein")).toBe("where it is now");
    expect(whyNot(TREE, doc("what"), null)).toBe("a document belongs in a topic");
  });

  it("a topic goes into another topic, or to the top", () => {
    expect(canMove(TREE, topic("organs"), "vitamins")).toBe(true);
    expect(canMove(TREE, topic("organs"), null)).toBe(true);
    expect(canMove(TREE, topic("vitamins"), "body")).toBe(true);
  });

  it("but never into itself or anything inside it", () => {
    expect(whyNot(TREE, topic("protein"), "protein")).toBe("the topic itself");
    expect(whyNot(TREE, topic("protein"), "body")).toBe("inside the topic being moved");
    expect(whyNot(TREE, topic("protein"), "organs")).toBe("inside the topic being moved");
  });

  it("and not to where it already is", () => {
    expect(whyNot(TREE, topic("protein"), null)).toBe("where it is now");
    expect(whyNot(TREE, topic("organs"), "body")).toBe("where it is now");
  });
});

describe("the places on offer", () => {
  it("lists every topic in the sidebar's order, each saying whether it is open", () => {
    expect(destinations(TREE, doc("how")).map((d) => [d.name, d.depth, d.reason])).toEqual([
      ["Protein", 0, null],
      ["In the body", 1, "where it is now"],
      ["Organs", 2, null],
      ["Vitamins", 0, null],
    ]);
  });

  it("offers a topic the top level first", () => {
    const places = destinations(TREE, topic("body"));
    expect(places.map((d) => [d.place, d.reason])).toEqual([
      [null, null],
      ["protein", "where it is now"],
      ["body", "the topic itself"],
      ["organs", "inside the topic being moved"],
      ["vitamins", null],
    ]);
  });
});

describe("saying where", () => {
  it("names a topic with the topics it sits in", () => {
    expect(placeName(TREE, "organs")).toBe("Protein › In the body › Organs");
    expect(placeName(TREE, "vitamins")).toBe("Vitamins");
    expect(placeName(TREE, null)).toBe("the top level");
  });
});

describe("finding what to move", () => {
  it("finds a topic or a document by its identifier, with its name", () => {
    expect(findMoving(TREE, "topic", "organs")).toEqual(topic("organs", "Organs"));
    expect(findMoving(TREE, "document", "how")).toEqual(doc("how", "How protein is used"));
  });

  it("and nothing for an identifier of the other kind, or none at all", () => {
    expect(findMoving(TREE, "document", "organs")).toBeNull();
    expect(findMoving(TREE, "topic", "gone")).toBeNull();
  });
});

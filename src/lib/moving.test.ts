import { describe, expect, it } from "vitest";

import type { Page } from "./engine";
import {
  canMove,
  destinations,
  findMoving,
  parentOf,
  placeName,
  spotNear,
  spotOf,
  stepped,
  whyNot,
  type Moving,
} from "./moving";

const page = (id: string, title: string, children: Page[] = []): Page => ({ id, title, children });

// Protein, with three pages under it, one of which has a page of its own; and Sleep.
const tree: Page[] = [
  page("protein", "Protein", [
    page("what", "What protein is"),
    page("types", "Types of protein"),
    page("body", "In the body", [page("used", "How protein is used")]),
  ]),
  page("sleep", "Sleep"),
];

const moving = (id: string): Moving => findMoving(tree, id)!;

describe("where a page is", () => {
  it("knows its parent, and the top level", () => {
    expect(parentOf(tree, "used")).toBe("body");
    expect(parentOf(tree, "protein")).toBeNull();
    expect(parentOf(tree, "nowhere")).toBeUndefined();
  });

  it("knows its place among its siblings", () => {
    expect(spotOf(tree, "types")).toEqual({ parent: "protein", position: 1 });
    expect(spotOf(tree, "sleep")).toEqual({ parent: null, position: 1 });
  });

  it("names a place with the pages it is under", () => {
    expect(placeName(tree, "body")).toBe("Protein › In the body");
    expect(placeName(tree, null)).toBe("the top level");
  });
});

describe("where a page may go", () => {
  it("never under itself, or under a page under it", () => {
    expect(whyNot(tree, moving("protein"), { parent: "protein", position: null })).toBe(
      "the page itself",
    );
    expect(whyNot(tree, moving("protein"), { parent: "body", position: null })).toBe(
      "under the page being moved",
    );
  });

  it("not to where it already is", () => {
    expect(whyNot(tree, moving("types"), { parent: "protein", position: 1 })).toBe(
      "where it is now",
    );
    // Already the last there, so "at the end" is where it is.
    expect(whyNot(tree, moving("body"), { parent: "protein", position: null })).toBe(
      "where it is now",
    );
  });

  it("anywhere else, including another place among its siblings", () => {
    expect(canMove(tree, moving("types"), { parent: "protein", position: 0 })).toBe(true);
    expect(canMove(tree, moving("what"), { parent: "protein", position: null })).toBe(true);
    expect(canMove(tree, moving("used"), { parent: null, position: null })).toBe(true);
    expect(canMove(tree, moving("sleep"), { parent: "used", position: null })).toBe(true);
  });
});

describe("dropping beside or under a page", () => {
  it("under it goes at the end of its pages", () => {
    expect(spotNear(tree, moving("sleep"), "body", "under")).toEqual({
      parent: "body",
      position: null,
    });
  });

  it("before or after it counts among the others, the moving page left out", () => {
    // "What protein is" dropped after "Types of protein": the others are [Types, In the body],
    // so after Types is position 1.
    expect(spotNear(tree, moving("what"), "types", "after")).toEqual({
      parent: "protein",
      position: 1,
    });
    expect(spotNear(tree, moving("sleep"), "what", "before")).toEqual({
      parent: "protein",
      position: 0,
    });
  });
});

describe("one step up or down", () => {
  it("moves among its siblings, and not past either end", () => {
    expect(stepped(tree, moving("types"), -1)).toEqual({ parent: "protein", position: 0 });
    expect(stepped(tree, moving("types"), 1)).toEqual({ parent: "protein", position: 2 });
    expect(stepped(tree, moving("what"), -1)).toBeUndefined();
    expect(stepped(tree, moving("body"), 1)).toBeUndefined();
  });
});

describe("the move button's list", () => {
  it("offers the top level and every page, in tree order, saying which are closed", () => {
    const list = destinations(tree, moving("body"));
    expect(list.map((d) => d.name)).toEqual([
      "The top level",
      "Protein",
      "What protein is",
      "Types of protein",
      "In the body",
      "How protein is used",
      "Sleep",
    ]);
    const closed = Object.fromEntries(list.map((d) => [d.name, d.reason]));
    expect(closed["In the body"]).toBe("the page itself");
    expect(closed["How protein is used"]).toBe("under the page being moved");
    expect(closed["Protein"]).toBe("where it is now");
    expect(closed["The top level"]).toBeNull();
  });
});

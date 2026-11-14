import { describe, expect, it } from "vitest";

import type { Graph, GraphLine, GraphNode } from "./engine";
import {
  base64,
  beside,
  colours,
  degrees,
  fit,
  labelled,
  layout,
  neighbours,
  nodeAt,
  radius,
  SHOW_EVERYTHING,
  showingFrom,
  toSvg,
  towards,
  visible,
  type Point,
} from "./graph";

const page = (id: string, top: string, title = id): GraphNode => ({ id, kind: "page", title, top });
const source = (id: string, title = id): GraphNode => ({ id, kind: "source", title, top: null });
const line = (from: string, to: string, kind: GraphLine["kind"]): GraphLine => ({ from, to, kind });

// Subject ─ History, Type 1, Type 2 ─ Detail;  Other, at the top, links to History;
// Alone, joined to nothing; one source, cited by History.
const graph: Graph = {
  nodes: [
    page("subject", "subject"),
    page("history", "subject"),
    page("type-1", "subject"),
    page("type-2", "subject"),
    page("detail", "subject"),
    page("other", "other"),
    page("alone", "alone"),
    source("survey"),
  ],
  lines: [
    line("history", "subject", "under"),
    line("type-1", "subject", "under"),
    line("type-2", "subject", "under"),
    line("detail", "type-2", "under"),
    line("type-1", "type-2", "links-to"),
    line("other", "history", "links-to"),
    line("history", "survey", "cites"),
  ],
};

const ids = (g: Graph) => g.nodes.map((n) => n.id);
const all = { ...SHOW_EVERYTHING, sources: true };

describe("what is shown", () => {
  it("is every page and line, and sources only when they are switched on", () => {
    expect(visible(graph, all)).toEqual(graph);

    const pagesOnly = visible(graph, SHOW_EVERYTHING);
    expect(ids(pagesOnly)).not.toContain("survey");
    expect(pagesOnly.lines.some((l) => l.kind === "cites")).toBe(false);
  });

  it("drops the tree's lines, and no node, when the tree is switched off", () => {
    const flat = visible(graph, { ...all, tree: false });
    expect(flat.nodes).toHaveLength(8);
    expect(flat.lines.map((l) => l.kind)).toEqual(["links-to", "links-to", "cites"]);
  });

  it("keeps what is within reach of a focus, in either direction along a line", () => {
    const one = visible(graph, { ...all, focus: "history", reach: "1" });
    // Its parent, the page linking to it, and the source it cites.
    expect(ids(one).sort()).toEqual(["history", "other", "subject", "survey"]);
    expect(one.lines).toHaveLength(3);

    const two = visible(graph, { ...all, focus: "history", reach: "2" });
    expect(ids(two).sort()).toEqual(["history", "other", "subject", "survey", "type-1", "type-2"]);

    const three = visible(graph, { ...all, focus: "history", reach: "3" });
    expect(ids(three)).toContain("detail");
    expect(ids(three)).not.toContain("alone");
  });

  it("reaches only along lines that are shown", () => {
    const flat = visible(graph, { ...all, tree: false, focus: "history", reach: "3" });
    expect(ids(flat).sort()).toEqual(["history", "other", "survey"]);
  });

  it("keeps the pages under a focus at any depth, whether or not the tree is drawn", () => {
    for (const tree of [true, false]) {
      const below = visible(graph, { ...all, tree, focus: "subject", reach: "under" });
      expect(ids(below)).toEqual(["subject", "history", "type-1", "type-2", "detail"]);
    }
  });

  it("narrows nothing when the focus is a page that is gone", () => {
    expect(visible(graph, { ...all, focus: "deleted", reach: "1" })).toEqual(graph);
  });

  it("reads what was remembered, and takes anything unexpected as the default", () => {
    expect(showingFrom(null)).toEqual(SHOW_EVERYTHING);
    expect(showingFrom({ sources: true, tree: false, focus: "a", reach: "under" })).toEqual({
      sources: true,
      tree: false,
      focus: "a",
      reach: "under",
    });
    expect(showingFrom({ sources: false, tree: true, focus: null, reach: "9" }).reach).toBe("1");
  });
});

describe("what a node looks like", () => {
  it("counts a node's lines, and grows with them more slowly than they do", () => {
    const count = degrees(graph.lines);
    expect(count.get("history")).toBe(3);
    expect(count.get("subject")).toBe(3);
    expect(count.has("alone")).toBe(false);

    expect(radius(0)).toBeGreaterThan(0);
    expect(radius(4)).toBeGreaterThan(radius(1));
    expect(radius(100)).toBeLessThan(10 * radius(1));
  });

  it("gives a subject one colour, different subjects different ones, and sources grey", () => {
    const colour = colours(graph);
    expect(colour.get("detail")).toBe(colour.get("subject"));
    expect(colour.get("other")).not.toBe(colour.get("subject"));
    expect(colour.get("alone")).not.toBe(colour.get("other"));
    expect(colour.get("survey")).toMatch(/^#/);
  });

  it("names a node only when it is big enough on screen to have room", () => {
    expect(labelled(0, 1)).toBe(false);
    expect(labelled(0, 2)).toBe(true);
    expect(labelled(9, 1)).toBe(true);
  });
});

describe("what a node is joined to", () => {
  it("is told apart by the kind of line and its direction", () => {
    expect(neighbours(graph.lines, "history")).toEqual({
      linksTo: [],
      linkedFrom: ["other"],
      parent: ["subject"],
      children: [],
      cites: ["survey"],
      citedBy: [],
    });
    expect(neighbours(graph.lines, "subject").children).toEqual(["history", "type-1", "type-2"]);
    expect(neighbours(graph.lines, "survey").citedBy).toEqual(["history"]);
    expect([...beside(graph.lines, "type-2")].sort()).toEqual(["detail", "subject", "type-1"]);
    expect(beside(graph.lines, "alone").size).toBe(0);
  });
});

describe("the layout", () => {
  it("places every node, apart from every other, the same way every time", () => {
    const first = layout(graph);
    expect([...first.keys()]).toEqual(ids(graph));
    for (const p of first.values()) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);

    const places = [...first.values()];
    for (let i = 0; i < places.length; i += 1) {
      for (let j = i + 1; j < places.length; j += 1) {
        expect(Math.hypot(places[i]!.x - places[j]!.x, places[i]!.y - places[j]!.y)).toBeGreaterThan(8);
      }
    }
    expect(layout(graph)).toEqual(first);
  });

  it("puts pages that are joined nearer each other than pages that are not", () => {
    const at = layout(graph);
    const apart = (a: string, b: string) => Math.hypot(at.get(a)!.x - at.get(b)!.x, at.get(a)!.y - at.get(b)!.y);
    expect(apart("detail", "type-2")).toBeLessThan(apart("detail", "alone"));
    expect(apart("history", "subject")).toBeLessThan(apart("history", "alone"));
  });

  it("leaves what is already placed exactly where it is, and settles the rest around it", () => {
    const pages: Graph = visible(graph, SHOW_EVERYTHING);
    const before = layout(pages);

    const after = layout(graph, before);
    for (const [id, p] of before) expect(after.get(id)).toEqual(p);
    expect(after.has("survey")).toBe(true);
    // The source lands by the page that cites it, not across the picture.
    const from = after.get("history")!;
    const to = after.get("survey")!;
    expect(Math.hypot(from.x - to.x, from.y - to.y)).toBeLessThan(200);
  });

  it("lays out a library of two thousand pages in a moment", () => {
    const nodes: GraphNode[] = [];
    const lines: GraphLine[] = [];
    for (let i = 0; i < 2000; i += 1) {
      const top = `p${i - (i % 100)}`;
      nodes.push(page(`p${i}`, top));
      if (i % 100 !== 0) lines.push(line(`p${i}`, `p${i - (i % 10 === 0 ? i % 100 : i % 10)}`, "under"));
      if (i % 7 === 0) lines.push(line(`p${i}`, `p${(i * 37) % 2000}`, "links-to"));
    }
    const started = performance.now();
    const at = layout({ nodes, lines });
    expect(at.size).toBe(2000);
    // Generous: this is a guard against a layout that takes minutes, not a benchmark.
    expect(performance.now() - started).toBeLessThan(15_000);
  });
});

describe("the view", () => {
  const places = new Map<string, Point>([
    ["a", { x: -100, y: 0 }],
    ["b", { x: 100, y: 0 }],
    ["c", { x: 0, y: 100 }],
  ]);
  const nodes = [page("a", "a"), page("b", "a"), page("c", "a")];
  const lines = [line("a", "b", "links-to"), line("a", "c", "links-to")];

  it("fits what is shown inside the area, with room around it", () => {
    const view = fit(nodes, places, 800, 600);
    for (const p of places.values()) {
      const x = p.x * view.k + view.x;
      const y = p.y * view.k + view.y;
      expect(x).toBeGreaterThanOrEqual(50);
      expect(x).toBeLessThanOrEqual(750);
      expect(y).toBeGreaterThanOrEqual(50);
      expect(y).toBeLessThanOrEqual(550);
    }
    // One node, or none, is put in the middle rather than blown up to fill the area.
    expect(fit([nodes[0]!], places, 800, 600).k).toBeLessThanOrEqual(2);
    expect(fit([], places, 800, 600)).toEqual({ x: 400, y: 300, k: 1 });
  });

  it("finds the node under a point, and none where there is none", () => {
    const view = { x: 400, y: 300, k: 1 };
    const count = degrees(lines);
    expect(nodeAt(nodes, places, count, view, 300, 300)).toBe("a");
    expect(nodeAt(nodes, places, count, view, 500, 302)).toBe("b");
    expect(nodeAt(nodes, places, count, view, 400, 300)).toBe(null);
  });

  it("moves along a line in the direction of an arrow key, and nowhere when nothing lies that way", () => {
    expect(towards(lines, places, "a", "right")).toBe("b");
    expect(towards(lines, places, "a", "down")).toBe("c");
    expect(towards(lines, places, "a", "left")).toBe(null);
    expect(towards(lines, places, "b", "left")).toBe("a");
    // c is joined to a only: b is not a step away from it, whichever way it lies.
    expect(towards(lines, places, "c", "right")).toBe(null);
  });
});

describe("the picture", () => {
  it("has a shape for every node and a line for every line, with titles safe to put in it", () => {
    const tricky: Graph = {
      nodes: [page("a", "a", 'Salt & "pepper" <b>'), source("s", "A survey")],
      lines: [line("a", "s", "cites")],
    };
    const places = new Map<string, Point>([
      ["a", { x: 0, y: 0 }],
      ["s", { x: 50, y: 0 }],
    ]);
    const svg = toSvg(tricky, places, colours(tricky), { x: 100, y: 100, k: 2 }, 400, 300);

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"')).toBe(true);
    expect(svg.match(/<circle /g)).toHaveLength(1);
    expect(svg.match(/<rect x=/g)).toHaveLength(1);
    expect(svg.match(/<line /g)).toHaveLength(1);
    expect(svg).toContain('stroke-dasharray="4 3"');
    expect(svg).toContain("Salt &amp; &quot;pepper&quot; &lt;b&gt;");
    expect(svg).not.toContain("<b>");
    expect(svg).toContain('cx="100" cy="100"');
    expect(svg).toContain('x2="200" y2="100"');
  });

  it("is handed to the shell as base64, whatever alphabet its titles are in", () => {
    const text = "Я вас любил — Ääkköset";
    const bytes = Uint8Array.from(atob(base64(text)), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe(text);
  });
});

import { describe, expect, it } from "vitest";

import type { DiagramEdit, DiagramView, Page } from "./engine";
import {
  GONE,
  addLabelBox,
  addLine,
  addPageBox,
  arrange,
  arrangeAgain,
  begin,
  boxSize,
  boxText,
  clip,
  diagramPictureName,
  draw,
  fitted,
  isGone,
  moveBoxes,
  pageTitles,
  record,
  redo,
  removeBox,
  removeLine,
  reorderBox,
  reverseLine,
  setLabel,
  setLayout,
  setLineLabel,
  setPage,
  setWhen,
  timelineOrder,
  toEdit,
  toSvg,
  undo,
  yearOf,
} from "./diagram";
import { isId } from "./ids";

const page = (id: string, title: string, children: Page[] = []): Page => ({ id, title, children });
const titles = pageTitles([page("subject", "Subject", [page("history", "History")]), page("other", "Other")]);

const box = (id: string, over: Partial<DiagramEdit["nodes"][number]> = {}) => ({
  id,
  page: null,
  label: id.toUpperCase(),
  when: null,
  x: null,
  y: null,
  ...over,
});
const diagram = (over: Partial<DiagramEdit> = {}): DiagramEdit => ({
  title: "T",
  layout: "free",
  direction: "down",
  nodes: [],
  lines: [],
  ...over,
});
const line = (from: string, to: string, label: string | null = null) => ({ from, to, label });

/** a → b, a → c, b → d, c → d: a diamond, which a layered layout puts in three ranks. */
const diamond = (over: Partial<DiagramEdit> = {}) =>
  diagram({
    layout: "layered",
    nodes: ["a", "b", "c", "d"].map((id) => box(id)),
    lines: [line("a", "b"), line("a", "c"), line("b", "d"), line("c", "d")],
    ...over,
  });

describe("what a box says", () => {
  it("is its label, else its page as it is called now, else that the page is gone", () => {
    expect(boxText(box("a", { label: "Mother" }), titles)).toBe("Mother");
    expect(boxText(box("a", { label: null, page: "history" }), titles)).toBe("History");
    expect(boxText(box("a", { label: "  ", page: "history" }), titles)).toBe("History");
    expect(boxText(box("a", { label: null, page: "deleted" }), titles)).toBe(GONE);
    // A label wins, and the page can still be gone.
    expect(boxText(box("a", { label: "Founder", page: "deleted" }), titles)).toBe("Founder");
    expect(isGone(box("a", { page: "deleted" }), titles)).toBe(true);
    expect(isGone(box("a", { page: "history" }), titles)).toBe(false);
    expect(isGone(box("a"), titles)).toBe(false);
  });

  it("follows a page that is renamed, because the title is read from the tree each time", () => {
    const renamed = pageTitles([page("subject", "Kinds")]);
    expect(boxText(box("a", { label: null, page: "subject" }), renamed)).toBe("Kinds");
  });

  it("lists every page of a tree, at any depth", () => {
    expect([...titles.keys()]).toEqual(["subject", "history", "other"]);
  });
});

describe("a diagram as read and as saved", () => {
  it("goes back to the engine with pages by id alone", () => {
    const view: DiagramView = {
      id: "d",
      title: "Tree",
      layout: "layered",
      direction: "right",
      nodes: [
        { id: "a", page: { id: "subject", title: "Subject" }, label: null, when: null, x: null, y: null },
        { id: "b", page: null, label: "Mother", when: "c. 1200", x: 1, y: 2 },
      ],
      lines: [{ from: "a", to: "b", label: "child of" }],
      revision: "1:1" as DiagramView["revision"],
    };
    expect(toEdit(view)).toEqual({
      title: "Tree",
      layout: "layered",
      direction: "right",
      nodes: [
        { id: "a", page: "subject", label: null, when: null, x: null, y: null },
        { id: "b", page: null, label: "Mother", when: "c. 1200", x: 1, y: 2 },
      ],
      lines: [{ from: "a", to: "b", label: "child of" }],
    });
  });
});

describe("changing a diagram", () => {
  it("adds boxes with identifiers the engine would accept, and leaves the diagram it was given alone", () => {
    const before = diagram();
    const { diagram: after, id } = addLabelBox(before, "  Mother ", { x: 10.04, y: 20 });
    expect(before.nodes).toHaveLength(0);
    expect(isId(id)).toBe(true);
    expect(after.nodes[0]).toMatchObject({ id, label: "Mother", page: null, x: 10, y: 20 });

    const paged = addPageBox(after, "history");
    expect(paged.diagram.nodes[1]).toMatchObject({ page: "history", label: null, x: null, y: null });
    expect(addLabelBox(diagram(), "   ").diagram.nodes[0]!.label).toBe("New box");
  });

  it("takes a box away with every line to or from it", () => {
    const d = diamond();
    const without = removeBox(d, "b");
    expect(without.nodes.map((n) => n.id)).toEqual(["a", "c", "d"]);
    expect(without.lines).toEqual([line("a", "c"), line("c", "d")]);
  });

  it("changes words, trimmed, and an empty one is none", () => {
    let d = diagram({ nodes: [box("a", { when: "1850" })] });
    d = setLabel(d, "a", "  Mother ");
    expect(d.nodes[0]!.label).toBe("Mother");
    expect(setLabel(d, "a", "  ").nodes[0]!.label).toBeNull();
    expect(setWhen(d, "a", " 1900 ").nodes[0]!.when).toBe("1900");
    expect(setWhen(d, "a", "").nodes[0]!.when).toBeNull();
  });

  it("points a box at a page, and leaves one unlinked with something to say", () => {
    const d = diagram({ nodes: [box("a", { label: null, page: "deleted" })] });
    // Unlinking a box that said only its page's title keeps those words as its label.
    expect(setPage(d, "a", null, GONE).nodes[0]).toMatchObject({ page: null, label: GONE });
    // A label already there is kept; a page given takes the box's words from the page.
    const labelled = diagram({ nodes: [box("a", { label: "Founder", page: null })] });
    expect(setPage(labelled, "a", "history", "History").nodes[0]).toMatchObject({ page: "history", label: "Founder" });
    expect(setPage(d, "a", "history", "History").nodes[0]).toMatchObject({ page: "history", label: null });
  });

  it("moves boxes to places, rounded, and moves no others", () => {
    const d = diagram({ nodes: [box("a"), box("b")] });
    const moved = moveBoxes(d, new Map([["a", { x: 1.26, y: -3 }]]));
    expect(moved.nodes[0]).toMatchObject({ x: 1.3, y: -3 });
    expect(moved.nodes[1]).toMatchObject({ x: null, y: null });
  });

  it("reorders a box among the others, and stops at the ends", () => {
    const d = diagram({ nodes: [box("a"), box("b"), box("c")] });
    expect(reorderBox(d, "b", -1).nodes.map((n) => n.id)).toEqual(["b", "a", "c"]);
    expect(reorderBox(d, "b", 1).nodes.map((n) => n.id)).toEqual(["a", "c", "b"]);
    expect(reorderBox(d, "a", -1)).toBe(d);
    expect(reorderBox(d, "c", 1)).toBe(d);
    expect(reorderBox(d, "missing", 1)).toBe(d);
  });

  it("draws a line once, never to itself, and edits it by its place", () => {
    let d = diagram({ nodes: [box("a"), box("b")] });
    d = addLine(d, "a", "b");
    expect(addLine(d, "a", "b")).toBe(d);
    expect(addLine(d, "a", "a")).toBe(d);
    expect(addLine(d, "b", "a").lines).toHaveLength(2);
    d = setLineLabel(d, 0, " parent of ");
    expect(d.lines[0]!.label).toBe("parent of");
    expect(setLineLabel(d, 0, "").lines[0]!.label).toBeNull();
    expect(reverseLine(d, 0).lines[0]).toMatchObject({ from: "b", to: "a" });
    expect(removeLine(d, 0).lines).toHaveLength(0);
  });
});

describe("layouts", () => {
  it("lay a layered diagram out in ranks along its lines, and turn it sideways", () => {
    const down = arrange(diamond(), titles).boxes;
    const y = (id: string) => down.get(id)!.y;
    const x = (id: string) => down.get(id)!.x;
    expect(y("a")).toBeLessThan(y("b"));
    expect(y("b")).toBe(y("c"));
    expect(y("b")).toBeLessThan(y("d"));
    expect(x("b")).not.toBe(x("c"));

    const right = arrange(diamond({ direction: "right" }), titles).boxes;
    expect(right.get("a")!.x).toBeLessThan(right.get("b")!.x);
    expect(right.get("b")!.x).toBeLessThan(right.get("d")!.x);
  });

  it("keep siblings apart: boxes in one layer are a box's width from each other, not a gap's", () => {
    const family = diagram({
      layout: "layered",
      nodes: [box("parent"), box("first", { label: "A rather long label indeed" }), box("second"), box("third")],
      lines: [line("parent", "first"), line("parent", "second"), line("parent", "third")],
    });
    for (const direction of ["down", "right"] as const) {
      const at = [...arrange({ ...family, direction }, titles).boxes.values()];
      for (let i = 0; i < at.length; i += 1) {
        for (let j = i + 1; j < at.length; j += 1) {
          const a = at[i]!;
          const b = at[j]!;
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
          expect(apart, `${direction}: ${a.id} and ${b.id}`).toBe(true);
        }
      }
    }
  });

  it("keep two boxes from sitting on each other, however the lines run", () => {
    const loop = diamond({ lines: [line("a", "b"), line("b", "c"), line("c", "a"), line("c", "d")] });
    const boxes = [...arrange(loop, titles).boxes.values()];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
    }
  });

  it("put a timeline in order of year along one axis, with undated boxes after, in order held", () => {
    const d = diagram({
      layout: "timeline",
      nodes: [
        box("late", { when: "1850" }),
        box("quiet", { when: "the long quiet" }),
        box("early", { when: "c. 1200" }),
        box("bc", { when: "500 BC" }),
        box("same", { when: "1850" }),
        box("none"),
      ],
    });
    expect(timelineOrder(d.nodes).map((n) => n.id)).toEqual(["bc", "early", "late", "same", "quiet", "none"]);
    const at = arrange(d, titles).boxes;
    const xs = timelineOrder(d.nodes).map((n) => at.get(n.id)!.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(new Set(xs).size).toBe(xs.length);
  });

  it("read a year out of words", () => {
    expect(yearOf("1850")).toBe(1850);
    expect(yearOf("c. 1200")).toBe(1200);
    expect(yearOf("3 May 1850")).toBe(1850);
    expect(yearOf("1850s")).toBe(1850);
    expect(yearOf("1850–1860")).toBe(1850);
    expect(yearOf("500 BC")).toBe(-500);
    expect(yearOf("44 B.C.")).toBe(-44);
    expect(yearOf("the 12th century")).toBe(12);
    expect(yearOf("the late Bronze Age")).toBeNull();
    expect(yearOf("")).toBeNull();
    expect(yearOf(null)).toBeNull();
  });

  it("keep a free diagram where its boxes were put, and put new boxes below, not on top", () => {
    const d = diagram({
      nodes: [box("a", { x: 0, y: 0 }), box("b", { x: 300, y: 50 }), box("fresh")],
    });
    const at = arrange(d, titles).boxes;
    expect(at.get("a")).toMatchObject({ x: 0, y: 0 });
    expect(at.get("b")).toMatchObject({ x: 300, y: 50 });
    expect(at.get("fresh")!.y).toBeGreaterThan(50 + 29);
    expect(arrange(diagram({ nodes: [box("only")] }), titles).boxes.size).toBe(1);
    expect(arrange(diagram(), titles).boxes.size).toBe(0);
  });

  it("are decided from the diagram alone, so it looks the same each time", () => {
    expect(arrange(diamond(), titles)).toEqual(arrange(diamond(), titles));
  });

  it("size a box by what it says, within limits, and taller for a date", () => {
    expect(boxSize("A", null).w).toBe(96);
    expect(boxSize("x".repeat(200), null).w).toBe(240);
    expect(boxSize("A longer title here", null).w).toBeGreaterThan(boxSize("A", null).w);
    expect(boxSize("A", "1850").h).toBeGreaterThan(boxSize("A", null).h);
  });
});

describe("changing layout", () => {
  it("to free gives every box the place it had, to start from", () => {
    const layered = diamond();
    const free = setLayout(layered, "free", titles);
    const was = arrange(layered, titles).boxes;
    expect(free.layout).toBe("free");
    for (const n of free.nodes) expect(n).toMatchObject({ x: Math.round(was.get(n.id)!.x * 10) / 10 });
    expect(free.lines).toEqual(layered.lines);
  });

  it("away from free drops the places, and keeps the boxes, lines and dates", () => {
    const placed = diagram({
      layout: "free",
      nodes: [box("a", { x: 1, y: 2, when: "1850" }), box("b", { x: 3, y: 4 })],
      lines: [line("a", "b", "led to")],
    });
    const timeline = setLayout(placed, "timeline", titles);
    expect(timeline.nodes.map((n) => [n.x, n.y, n.when])).toEqual([[null, null, "1850"], [null, null, null]]);
    expect(timeline.lines).toEqual(placed.lines);
    expect(setLayout(placed, "free", titles)).toBe(placed);
  });

  it("can be undone, because what was there is still in the history", () => {
    const placed = diagram({ nodes: [box("a", { x: 1, y: 2 })] });
    let h = begin(placed);
    h = record(h, setLayout(placed, "layered", titles));
    expect(h.present.nodes[0]!.x).toBeNull();
    expect(undo(h).present).toBe(placed);
  });

  it("arrange again forgets where a free diagram's boxes were put", () => {
    const d = diagram({ nodes: [box("a", { x: 1, y: 2 })] });
    expect(arrangeAgain(d).nodes[0]).toMatchObject({ x: null, y: null });
  });
});

describe("undo", () => {
  it("steps back and forward through what was done, and a new change ends what could be redone", () => {
    const a = diagram({ title: "a" });
    const b = diagram({ title: "b" });
    const c = diagram({ title: "c" });
    let h = begin(a);
    h = record(record(h, b), c);
    expect(h.present.title).toBe("c");
    h = undo(undo(h));
    expect(h.present.title).toBe("a");
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present.title).toBe("b");
    h = record(h, diagram({ title: "d" }));
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
    // Recording what is already there records nothing.
    expect(record(h, h.present)).toBe(h);
  });

  it("keeps the last hundred states and no more", () => {
    let h = begin(diagram({ title: "0" }));
    for (let i = 1; i <= 150; i += 1) h = record(h, diagram({ title: String(i) }));
    expect(h.past).toHaveLength(100);
    expect(h.past[0]!.title).toBe("50");
  });
});

describe("the drawing", () => {
  it("is a space of its own with a margin, boxes at their sizes, and every line clipped to its boxes", () => {
    const drawing = draw(diamond(), titles);
    expect(drawing.boxes).toHaveLength(4);
    expect(drawing.lines).toHaveLength(4);
    for (const b of drawing.boxes) {
      expect(b.x).toBeGreaterThanOrEqual(28);
      expect(b.y).toBeGreaterThanOrEqual(28);
      expect(b.x + b.w).toBeLessThanOrEqual(drawing.width - 28 + 0.1);
      expect(b.y + b.h).toBeLessThanOrEqual(drawing.height - 28 + 0.1);
    }
    const a = drawing.boxes.find((b) => b.id === "a")!;
    const first = drawing.lines.find((l) => l.from === "a" && l.to === "b")!;
    // It leaves a's edge, not its middle.
    expect(first.y1).toBeCloseTo(a.y + a.h, 0);
    expect(draw(diagram(), titles)).toEqual({ width: 56, height: 56, boxes: [], lines: [] });
  });

  it("says what each box says, and marks a page that is gone", () => {
    const d = diagram({
      nodes: [box("a", { label: null, page: "history", when: "1850" }), box("b", { label: null, page: "deleted" })],
    });
    const [a, b] = draw(d, titles).boxes;
    expect(a).toMatchObject({ text: "History", when: "1850", page: "history", gone: false });
    expect(b).toMatchObject({ text: GONE, page: "deleted", gone: true });
  });

  it("clips a line to the edge of a box, whichever way it leaves", () => {
    const at = { id: "a", x: 100, y: 100, w: 100, h: 40 };
    expect(clip(at, { x: 300, y: 100 })).toEqual({ x: 150, y: 100 });
    expect(clip(at, { x: 100, y: 0 })).toEqual({ x: 100, y: 80 });
    expect(clip(at, { x: 100, y: 100 })).toEqual({ x: 100, y: 100 });
    const diagonal = clip(at, { x: 200, y: 200 });
    expect(diagonal.y).toBe(120);
    expect(diagonal.x).toBe(120);
  });

  it("cuts a long title to fit, and leaves a short one", () => {
    expect(fitted("Mother", 120)).toBe("Mother");
    const cut = fitted("A very long title indeed for such a box", 120);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.length).toBeLessThan(20);
  });
});

describe("the picture", () => {
  it("has a shape for every box and a line for every line, with words safe to put in it", () => {
    const d = diagram({
      nodes: [box("a", { label: 'Salt & "pepper" <b>' }), box("b", { when: "1850" }), box("c", { label: null, page: "deleted" })],
      lines: [line("a", "b", "led to <x>")],
    });
    const svg = toSvg(draw(d, titles));
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.match(/<rect x=/g)).toHaveLength(3);
    expect(svg.match(/<line /g)).toHaveLength(1);
    expect(svg).toContain("Salt &amp; &quot;pepper&quot; &lt;b&gt;");
    expect(svg).toContain("led to &lt;x&gt;");
    expect(svg).not.toContain("<b>");
    expect(svg).toContain('stroke-dasharray="4 3"');
    expect(svg).toContain(">1850<");
    expect(svg).toContain(GONE);
  });

  it("is named after the diagram", () => {
    expect(diagramPictureName("Family tree", "svg")).toBe("Family tree.svg");
    expect(diagramPictureName("  ", "png")).toBe("Diagram.png");
    expect(diagramPictureName("Who? A/B: kin", "svg")).toBe("Who A-B - kin.svg");
  });
});

// Diagrams (ADR 0011): what is done to one, where its boxes go, and what it looks like drawn.
//
// The engine keeps a diagram's structure — its boxes and lines — and checks it. It does not know
// where anything is drawn: a layered or timeline diagram is laid out from its structure here,
// every time, and only a free one keeps positions, the ones its boxes were dragged to. Nothing
// about a page is copied into a diagram: a box that points at a page says what that page is
// called now, from the tree of pages the application already holds.
//
// Everything in this file is a pure function of a diagram. The editor holds the diagram and
// calls these; the same drawing is made for the editor's canvas, for a page that shows the
// diagram, and for a saved picture, so the three cannot disagree.

import dagre from "@dagrejs/dagre";

import type {
  DiagramDirection,
  DiagramEdit,
  DiagramLayout,
  DiagramNodeEdit,
  DiagramView,
  Page,
} from "./engine";
import { fileBase } from "./export";
import { isId, newId } from "./ids";

export type Box = DiagramNodeEdit;

/** What a page's picture line has for an address when it shows a diagram: `diagram:<id>`. */
export const ADDRESS = "diagram:";

/** The diagram a picture's address names, or none when it is a file beside the page. */
export function diagramOf(address: string): string | null {
  if (!address.startsWith(ADDRESS)) return null;
  const id = address.slice(ADDRESS.length);
  return isId(id) ? id : null;
}

/** What every page is called now, by id. A page that is not here is gone. */
export type Titles = Map<string, string>;

/** Every page in the tree, with what it is called. */
export function pageTitles(pages: Page[]): Titles {
  const titles: Titles = new Map();
  const walk = (level: Page[]) => {
    for (const page of level) {
      titles.set(page.id, page.title);
      walk(page.children);
    }
  };
  walk(pages);
  return titles;
}

/** A diagram as read, as the editor holds it and saves it. */
export function toEdit(view: DiagramView): DiagramEdit {
  return {
    title: view.title,
    layout: view.layout,
    direction: view.direction,
    nodes: view.nodes.map((n) => ({
      id: n.id,
      page: n.page?.id ?? null,
      label: n.label,
      when: n.when,
      x: n.x,
      y: n.y,
    })),
    lines: view.lines.map((l) => ({ ...l })),
  };
}

export const GONE = "Page gone";

/** What a box says: its own label, else its page's title now, else that its page is gone. */
export function boxText(box: Box, titles: Titles): string {
  const label = box.label?.trim();
  if (label) return label;
  if (box.page !== null) return titles.get(box.page) ?? GONE;
  return "";
}

/** Whether a box points at a page that no longer exists. */
export function isGone(box: Box, titles: Titles): boolean {
  return box.page !== null && !titles.has(box.page);
}

// ---- what can be done to a diagram -----------------------------------------------------------
//
// Each returns a new diagram and leaves the one it was given alone, so that the editor can keep
// every state it has been in for undo.

export type At = { x: number; y: number };

const tidy = (text: string | null): string | null => {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

function placed(at: At | undefined): Pick<Box, "x" | "y"> {
  return at ? { x: round(at.x), y: round(at.y) } : { x: null, y: null };
}

export function addLabelBox(d: DiagramEdit, label: string, at?: At): { diagram: DiagramEdit; id: string } {
  const id = newId();
  const box: Box = { id, page: null, label: tidy(label) ?? "New box", when: null, ...placed(at) };
  return { diagram: { ...d, nodes: [...d.nodes, box] }, id };
}

export function addPageBox(d: DiagramEdit, page: string, at?: At): { diagram: DiagramEdit; id: string } {
  const id = newId();
  const box: Box = { id, page, label: null, when: null, ...placed(at) };
  return { diagram: { ...d, nodes: [...d.nodes, box] }, id };
}

/** A box taken away, and every line to or from it. */
export function removeBox(d: DiagramEdit, id: string): DiagramEdit {
  return {
    ...d,
    nodes: d.nodes.filter((n) => n.id !== id),
    lines: d.lines.filter((l) => l.from !== id && l.to !== id),
  };
}

function change(d: DiagramEdit, id: string, edit: (box: Box) => Box): DiagramEdit {
  return { ...d, nodes: d.nodes.map((n) => (n.id === id ? edit(n) : n)) };
}

export const setLabel = (d: DiagramEdit, id: string, label: string): DiagramEdit =>
  change(d, id, (n) => ({ ...n, label: tidy(label) }));

export const setWhen = (d: DiagramEdit, id: string, when: string): DiagramEdit =>
  change(d, id, (n) => ({ ...n, when: tidy(when) }));

/** Point a box at a page, or at none. A box left with nothing to say is given its page's words. */
export function setPage(d: DiagramEdit, id: string, page: string | null, say: string): DiagramEdit {
  return change(d, id, (n) => {
    const label = n.label?.trim() ? n.label : page === null ? tidy(say) : null;
    return { ...n, page, label };
  });
}

export function moveBoxes(d: DiagramEdit, to: Map<string, At>): DiagramEdit {
  return {
    ...d,
    nodes: d.nodes.map((n) => {
      const at = to.get(n.id);
      return at ? { ...n, x: round(at.x), y: round(at.y) } : n;
    }),
  };
}

/** Where a box comes in the order the diagram holds them — which is its order in a layer. */
export function reorderBox(d: DiagramEdit, id: string, by: -1 | 1): DiagramEdit {
  const from = d.nodes.findIndex((n) => n.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= d.nodes.length) return d;
  const nodes = [...d.nodes];
  [nodes[from], nodes[to]] = [nodes[to]!, nodes[from]!];
  return { ...d, nodes };
}

/** A line from one box to another. Not to itself, and not a second one where one already is. */
export function addLine(d: DiagramEdit, from: string, to: string): DiagramEdit {
  if (from === to) return d;
  if (d.lines.some((l) => l.from === from && l.to === to)) return d;
  return { ...d, lines: [...d.lines, { from, to, label: null }] };
}

export const removeLine = (d: DiagramEdit, index: number): DiagramEdit => ({
  ...d,
  lines: d.lines.filter((_, i) => i !== index),
});

export const setLineLabel = (d: DiagramEdit, index: number, label: string): DiagramEdit => ({
  ...d,
  lines: d.lines.map((l, i) => (i === index ? { ...l, label: tidy(label) } : l)),
});

export const reverseLine = (d: DiagramEdit, index: number): DiagramEdit => ({
  ...d,
  lines: d.lines.map((l, i) => (i === index ? { ...l, from: l.to, to: l.from } : l)),
});

export const setTitle = (d: DiagramEdit, title: string): DiagramEdit => ({ ...d, title });

export const setDirection = (d: DiagramEdit, direction: DiagramDirection): DiagramEdit => ({
  ...d,
  direction,
});

/**
 * A new layout, with every box and line kept.
 *
 * To *free*, each box is given the place the old layout had put it, as somewhere to start from.
 * Away from *free*, the stored places go: another layout decides where boxes are, and places
 * left in the file would only be stale. Undoing the change brings them back, because the editor
 * keeps the diagram as it was.
 */
export function setLayout(d: DiagramEdit, layout: DiagramLayout, titles: Titles): DiagramEdit {
  if (layout === d.layout) return d;
  if (layout === "free") {
    const now = arrange(d, titles);
    return {
      ...d,
      layout,
      nodes: d.nodes.map((n) => {
        const at = now.boxes.get(n.id);
        return at ? { ...n, x: round(at.x), y: round(at.y) } : n;
      }),
    };
  }
  return { ...d, layout, nodes: d.nodes.map((n) => ({ ...n, x: null, y: null })) };
}

/** Free: forget where everything was put, so the boxes are laid out afresh. */
export const arrangeAgain = (d: DiagramEdit): DiagramEdit => ({
  ...d,
  nodes: d.nodes.map((n) => ({ ...n, x: null, y: null })),
});

// ---- where boxes go ------------------------------------------------------------------------

export type Placed = { id: string; x: number; y: number; w: number; h: number };
export type Arranged = { boxes: Map<string, Placed> };

const MIN_WIDTH = 96;
const MAX_WIDTH = 240;
const HEIGHT = 40;
const HEIGHT_WITH_WHEN = 58;

/** About how big a box is for what it says: no font is measured, so this is a close guess. */
export function boxSize(text: string, when: string | null): { w: number; h: number } {
  const longest = Math.max(text.length, (when ?? "").length);
  return {
    w: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(28 + longest * 7.4))),
    h: when ? HEIGHT_WITH_WHEN : HEIGHT,
  };
}

/** The year a `when` can be read as, or none. Text, because history is not always a date. */
export function yearOf(when: string | null): number | null {
  if (!when) return null;
  // The first run of three to five digits, so "3 May 1850" is 1850 and not 3; failing that,
  // the first number at all, so "the 12th century" is 12.
  const run = /(?<!\d)\d{3,5}(?!\d)/.exec(when) ?? /\d+/.exec(when);
  if (!run) return null;
  const year = Number(run[0]);
  return /\b(?:bc|bce|b\.c\.|b\.c\.e\.)(?![a-z])/i.test(when) ? -year : year;
}

/**
 * The boxes of a timeline in order: those with a year in it, by year, then those without, in the
 * order the diagram holds them. Boxes with the same year stay in the order they are held in.
 */
export function timelineOrder(boxes: Box[]): Box[] {
  const dated = boxes.map((box, at) => ({ box, at, year: yearOf(box.when) }));
  return [
    ...dated.filter((b) => b.year !== null).sort((a, b) => a.year! - b.year! || a.at - b.at),
    ...dated.filter((b) => b.year === null),
  ].map((b) => b.box);
}

/** Where each box of a diagram goes, as the middle of the box. */
export function arrange(d: DiagramEdit, titles: Titles): Arranged {
  const sized = new Map(
    d.nodes.map((n) => [n.id, boxSize(boxText(n, titles), n.when)]),
  );
  const boxes = new Map<string, Placed>();
  const put = (id: string, x: number, y: number) => {
    const size = sized.get(id)!;
    boxes.set(id, { id, x: round(x), y: round(y), ...size });
  };

  if (d.layout === "layered") {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
      rankdir: d.direction === "right" ? "LR" : "TB",
      nodesep: 36,
      ranksep: 64,
      marginx: 0,
      marginy: 0,
    });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const n of d.nodes) {
      const size = sized.get(n.id)!;
      // dagre reads `width` and `height`.
      graph.setNode(n.id, { width: size.w, height: size.h });
    }
    for (const l of d.lines) graph.setEdge(l.from, l.to);
    dagre.layout(graph);
    for (const n of d.nodes) {
      const at = graph.node(n.id);
      put(n.id, at.x, at.y);
    }
  } else if (d.layout === "timeline") {
    for (const [id, at] of placeTimeline(d, sized)) put(id, at.x, at.y);
  } else {
    const stored = d.nodes.filter((n) => n.x !== null && n.y !== null);
    for (const n of stored) put(n.id, n.x!, n.y!);
    // A box with no place yet — added by hand to the file, or left when the layout was
    // changed — goes in a row below the rest, not on top of anything.
    const below = stored.length === 0 ? 0 : Math.max(...stored.map((n) => n.y! + HEIGHT_WITH_WHEN / 2)) + 60;
    let x = stored.length === 0 ? 0 : Math.min(...stored.map((n) => n.x!));
    for (const n of d.nodes.filter((n) => n.x === null || n.y === null)) {
      const size = sized.get(n.id)!;
      put(n.id, x + size.w / 2, below + size.h / 2);
      x += size.w + 40;
    }
  }
  return { boxes };
}

const COLUMN_GAP = 56;
const ROW_GAP = 24;

/**
 * A timeline: time runs left to right, and what happened together stands together.
 *
 * **One column for one year.** Boxes with the same year are stacked in one column, so the page
 * reads as a calendar and not as a queue; a box with no year in it has a column of its own,
 * after the dated ones.
 *
 * **One level for what does not split.** The main line runs along one level. A box whose lines
 * come from a single box stands at that box's level, so a chain of events is a straight line.
 * Where a line splits — one event leading to two — the branches grow out of it, above and below
 * the level it stood on, and a box that several lines lead to stands at their middle. A box
 * with no lines at all stands on the main level.
 */
function placeTimeline(
  d: DiagramEdit,
  sized: Map<string, { w: number; h: number }>,
): Map<string, { x: number; y: number }> {
  const at = new Map<string, { x: number; y: number }>();
  const order = timelineOrder(d.nodes);
  const held = new Map(d.nodes.map((n, i) => [n.id, i]));

  // Columns: the same year together; no year, alone.
  const columns: Box[][] = [];
  let last: number | null | undefined;
  for (const box of order) {
    const year = yearOf(box.when);
    if (year !== null && year === last) columns[columns.length - 1]!.push(box);
    else columns.push([box]);
    last = year;
  }

  const leadTo = new Map<string, string[]>();
  for (const l of d.lines) leadTo.set(l.to, [...(leadTo.get(l.to) ?? []), l.from]);

  let x = 0;
  for (const column of columns) {
    const width = Math.max(...column.map((b) => sized.get(b.id)!.w));
    const centre = x + width / 2;
    x += width + COLUMN_GAP;

    // Where each box would stand: level with what leads to it, or on the main level.
    const wanted = column.map((box) => {
      const from = (leadTo.get(box.id) ?? []).map((id) => at.get(id)?.y).filter((y): y is number => y !== undefined);
      return { box, want: from.length === 0 ? 0 : from.reduce((a, b) => a + b, 0) / from.length };
    });
    wanted.sort((a, b) => a.want - b.want || held.get(a.box.id)! - held.get(b.box.id)!);

    // Then pushed apart where they would overlap, and the group put back round its middle, so
    // two branches of one split stand one above and one below the level they grew from.
    const ys = wanted.map((w) => w.want);
    for (let i = 1; i < ys.length; i += 1) {
      const room = (sized.get(wanted[i - 1]!.box.id)!.h + sized.get(wanted[i]!.box.id)!.h) / 2 + ROW_GAP;
      ys[i] = Math.max(ys[i]!, ys[i - 1]! + room);
    }
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const shift = mean(wanted.map((w) => w.want)) - mean(ys);
    wanted.forEach((w, i) => at.set(w.box.id, { x: centre, y: ys[i]! + shift }));
  }
  return at;
}

// ---- what it looks like -------------------------------------------------------------------

export type Side = "top" | "right" | "bottom" | "left";

/** Which sides of two boxes a line leaves and arrives by. */
export function sides(d: DiagramEdit, from: Placed, to: Placed): { source: Side; target: Side } {
  if (d.layout === "layered") {
    return d.direction === "right"
      ? { source: "right", target: "left" }
      : { source: "bottom", target: "top" };
  }
  if (d.layout === "timeline") {
    // Two boxes in one column — the same year — are joined top to bottom.
    if (from.x === to.x) {
      return from.y <= to.y ? { source: "bottom", target: "top" } : { source: "top", target: "bottom" };
    }
    return from.x < to.x ? { source: "right", target: "left" } : { source: "left", target: "right" };
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { source: "right", target: "left" } : { source: "left", target: "right" };
  }
  return dy >= 0 ? { source: "bottom", target: "top" } : { source: "top", target: "bottom" };
}

export type DrawnBox = {
  id: string;
  /** Top left. */
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  when: string | null;
  /** Points at a page, and the page is there: it can be opened. */
  page: string | null;
  gone: boolean;
};

export type DrawnLine = {
  index: number;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string | null;
  /** Where the label sits: the middle of the line. */
  lx: number;
  ly: number;
};

export type Drawing = { width: number; height: number; boxes: DrawnBox[]; lines: DrawnLine[] };

const MARGIN = 28;

/** Where a straight line from the middle of `a` towards `towards` leaves the edge of `a`. */
export function clip(a: Placed, towards: { x: number; y: number }): { x: number; y: number } {
  const dx = towards.x - a.x;
  const dy = towards.y - a.y;
  if (dx === 0 && dy === 0) return { x: a.x, y: a.y };
  const scale = Math.min(
    dx === 0 ? Infinity : a.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : a.h / 2 / Math.abs(dy),
  );
  return { x: a.x + dx * scale, y: a.y + dy * scale };
}

/** The whole diagram as shapes in a space of its own, starting a margin in from the corner. */
export function draw(d: DiagramEdit, titles: Titles): Drawing {
  const { boxes: placed } = arrange(d, titles);
  const all = [...placed.values()];
  if (all.length === 0) return { width: MARGIN * 2, height: MARGIN * 2, boxes: [], lines: [] };

  const left = Math.min(...all.map((b) => b.x - b.w / 2));
  const top = Math.min(...all.map((b) => b.y - b.h / 2));
  const right = Math.max(...all.map((b) => b.x + b.w / 2));
  const bottom = Math.max(...all.map((b) => b.y + b.h / 2));
  const shift = (v: number, origin: number) => round(v - origin + MARGIN);

  const boxes: DrawnBox[] = d.nodes.map((n) => {
    const at = placed.get(n.id)!;
    return {
      id: n.id,
      x: shift(at.x - at.w / 2, left),
      y: shift(at.y - at.h / 2, top),
      w: at.w,
      h: at.h,
      text: boxText(n, titles),
      when: n.when,
      page: n.page,
      gone: isGone(n, titles),
    };
  });
  const middle = new Map(boxes.map((b) => [b.id, { id: b.id, x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h }]));
  const lines: DrawnLine[] = d.lines.map((l, index) => {
    const a = middle.get(l.from)!;
    const b = middle.get(l.to)!;
    const start = clip(a, b);
    const end = clip(b, a);
    return {
      index,
      from: l.from,
      to: l.to,
      x1: round(start.x),
      y1: round(start.y),
      x2: round(end.x),
      y2: round(end.y),
      label: l.label,
      lx: round((start.x + end.x) / 2),
      ly: round((start.y + end.y) / 2),
    };
  });
  return { width: round(right - left + MARGIN * 2), height: round(bottom - top + MARGIN * 2), boxes, lines };
}

/** The colours of a drawn diagram, the same in a saved picture and in a page. */
export const PALETTE = {
  ink: "#e6e4de",
  ground: "#14151a",
  box: "#23262f",
  boxLine: "#4a4e5e",
  line: "#9aa0b4",
  gone: "#c97a5a",
} as const;
const INK = PALETTE.ink;
const GROUND = PALETTE.ground;
const BOX = PALETTE.box;
const BOX_LINE = PALETTE.boxLine;
const LINE = PALETTE.line;
const GONE_LINE = PALETTE.gone;

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A title cut to fit a box, with an ellipsis, by the same guess `boxSize` makes. */
export function fitted(text: string, width: number): string {
  const room = Math.max(1, Math.floor((width - 20) / 7.4));
  return text.length <= room ? text : `${text.slice(0, Math.max(1, room - 1))}…`;
}

/** The drawing as a picture: text stays text, so it scales and can be searched. */
export function toSvg(drawing: Drawing): string {
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${drawing.width}" height="${drawing.height}" viewBox="0 0 ${drawing.width} ${drawing.height}" font-family="system-ui, sans-serif" font-size="13">`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="${LINE}"/></marker></defs>`,
    `<rect width="100%" height="100%" fill="${GROUND}"/>`,
  ];
  for (const l of drawing.lines) {
    out.push(
      `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${LINE}" stroke-width="1.5" marker-end="url(#arrow)"/>`,
    );
  }
  for (const l of drawing.lines) {
    if (!l.label) continue;
    out.push(
      `<text x="${l.lx}" y="${l.ly - 5}" fill="${INK}" text-anchor="middle" font-size="11" stroke="${GROUND}" stroke-width="3" paint-order="stroke">${escape(l.label)}</text>`,
    );
  }
  for (const b of drawing.boxes) {
    const stroke = b.gone ? GONE_LINE : BOX_LINE;
    out.push(
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="${BOX}" stroke="${stroke}" stroke-width="1.5"${b.gone ? ' stroke-dasharray="4 3"' : ""}><title>${escape(b.text)}</title></rect>`,
    );
    const mid = b.x + b.w / 2;
    if (b.when) {
      out.push(
        `<text x="${mid}" y="${b.y + 19}" fill="${LINE}" text-anchor="middle" font-size="11">${escape(fitted(b.when, b.w))}</text>`,
        `<text x="${mid}" y="${b.y + 40}" fill="${INK}" text-anchor="middle">${escape(fitted(b.text, b.w))}</text>`,
      );
    } else {
      out.push(`<text x="${mid}" y="${b.y + b.h / 2 + 4.5}" fill="${INK}" text-anchor="middle">${escape(fitted(b.text, b.w))}</text>`);
    }
  }
  out.push("</svg>");
  return out.join("\n");
}

/** What a saved picture of a diagram is called: after the diagram, by every export's rule. */
export function diagramPictureName(title: string, kind: "svg" | "png"): string {
  return `${fileBase(title) || "Diagram"}.${kind}`;
}

// ---- undo ----------------------------------------------------------------------------------

/** Every state a diagram has been in, for undo and redo. One diagram at a time, in memory. */
export type History = { past: DiagramEdit[]; present: DiagramEdit; future: DiagramEdit[] };

const KEEP = 100;

export const begin = (present: DiagramEdit): History => ({ past: [], present, future: [] });

/** A change made: the state it came from is kept, and what could have been redone is not. */
export function record(h: History, next: DiagramEdit): History {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-KEEP), present: next, future: [] };
}

export function undo(h: History): History {
  const before = h.past.at(-1);
  if (before === undefined) return h;
  return { past: h.past.slice(0, -1), present: before, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  const [after, ...rest] = h.future;
  if (after === undefined) return h;
  return { past: [...h.past, h.present], present: after, future: rest };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

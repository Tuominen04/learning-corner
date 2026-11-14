// The library graph (ADR 0010): what is shown, where it goes, and what it looks like saved.
//
// The engine says what is connected to what. Everything here is arithmetic on that answer —
// which nodes a focus keeps, how big and what colour a node is, where the layout puts it — and
// none of it is kept anywhere but the screen.

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

import type { Graph, GraphLine, GraphNode, GraphView } from "./engine";

export type Reach = "1" | "2" | "3" | "under";

/** What the screen shows of the graph: the toggles, and the node it is narrowed to, if any. */
export type Showing = {
  sources: boolean;
  tree: boolean;
  focus: string | null;
  reach: Reach;
};

export const SHOW_EVERYTHING: Showing = { sources: false, tree: true, focus: null, reach: "1" };

/** What was remembered, as something the screen can use: anything unexpected is the default. */
export function showingFrom(view: GraphView | null | undefined): Showing {
  if (!view) return SHOW_EVERYTHING;
  const reach = (["1", "2", "3", "under"] as const).find((r) => r === view.reach) ?? "1";
  return { sources: view.sources, tree: view.tree, focus: view.focus, reach };
}

export type Point = { x: number; y: number };

/**
 * The part of the graph that is shown.
 *
 * Sources and the tree's lines go when they are switched off. A focus keeps its node and what
 * is within reach of it along the lines that are shown — in either direction, because being
 * linked *to* is as much a connection as linking — or, for `under`, the pages under it at any
 * depth, whether or not the tree's lines are drawn. A focus on a node that is no longer there
 * narrows nothing.
 */
export function visible(graph: Graph, showing: Showing): Graph {
  let nodes = showing.sources ? graph.nodes : graph.nodes.filter((n) => n.kind === "page");
  const there = new Set(nodes.map((n) => n.id));
  let lines = graph.lines.filter(
    (l) => there.has(l.from) && there.has(l.to) && (showing.tree || l.kind !== "under"),
  );

  if (showing.focus !== null && there.has(showing.focus)) {
    const kept =
      showing.reach === "under"
        ? under(graph.lines, showing.focus)
        : within(lines, showing.focus, Number(showing.reach));
    nodes = nodes.filter((n) => kept.has(n.id));
    lines = lines.filter((l) => kept.has(l.from) && kept.has(l.to));
  }
  return { nodes, lines };
}

/** `start`, and every node at most `steps` lines from it. */
function within(lines: GraphLine[], start: string, steps: number): Set<string> {
  const beside = new Map<string, string[]>();
  for (const l of lines) {
    beside.set(l.from, [...(beside.get(l.from) ?? []), l.to]);
    beside.set(l.to, [...(beside.get(l.to) ?? []), l.from]);
  }
  const kept = new Set([start]);
  let edge = [start];
  for (let step = 0; step < steps; step += 1) {
    const next: string[] = [];
    for (const id of edge) {
      for (const other of beside.get(id) ?? []) {
        if (!kept.has(other)) {
          kept.add(other);
          next.push(other);
        }
      }
    }
    edge = next;
  }
  return kept;
}

/** `page`, and every page under it at any depth. */
function under(lines: GraphLine[], page: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const l of lines) {
    if (l.kind === "under") children.set(l.to, [...(children.get(l.to) ?? []), l.from]);
  }
  const kept = new Set([page]);
  const todo = [page];
  while (todo.length > 0) {
    for (const child of children.get(todo.pop()!) ?? []) {
      if (!kept.has(child)) {
        kept.add(child);
        todo.push(child);
      }
    }
  }
  return kept;
}

/** How many lines each node has, of those given. A node with none is not in the map. */
export function degrees(lines: GraphLine[]): Map<string, number> {
  const count = new Map<string, number>();
  for (const l of lines) {
    count.set(l.from, (count.get(l.from) ?? 0) + 1);
    count.set(l.to, (count.get(l.to) ?? 0) + 1);
  }
  return count;
}

/** A node's radius: bigger with more lines, by area rather than width, so ten is not a wall. */
export function radius(degree: number): number {
  return 4 + 2 * Math.sqrt(degree);
}

const SOURCE_COLOUR = "#8a8d9a";

/**
 * A node's colour: one per top-level page, so a subject reads as one colour. The hues step by
 * the golden angle, which keeps neighbours in the list far apart on the wheel however many
 * there are. Sources are grey: they are under nothing.
 */
export function colours(graph: Graph): Map<string, string> {
  const tops: string[] = [];
  for (const n of graph.nodes) {
    if (n.top !== null && !tops.includes(n.top)) tops.push(n.top);
  }
  const out = new Map<string, string>();
  for (const n of graph.nodes) {
    if (n.top === null) out.set(n.id, SOURCE_COLOUR);
    else out.set(n.id, `hsl(${Math.round((tops.indexOf(n.top) * 137.508) % 360)} 55% 62%)`);
  }
  return out;
}

/** What a node is joined to, by the kind of line and its direction. */
export type Neighbours = {
  linksTo: string[];
  linkedFrom: string[];
  /** The page it is under. */
  parent: string[];
  /** The pages directly under it. */
  children: string[];
  cites: string[];
  citedBy: string[];
};

export function neighbours(lines: GraphLine[], id: string): Neighbours {
  const out: Neighbours = { linksTo: [], linkedFrom: [], parent: [], children: [], cites: [], citedBy: [] };
  for (const l of lines) {
    if (l.from === id) {
      (l.kind === "links-to" ? out.linksTo : l.kind === "under" ? out.parent : out.cites).push(l.to);
    } else if (l.to === id) {
      (l.kind === "links-to" ? out.linkedFrom : l.kind === "under" ? out.children : out.citedBy).push(l.from);
    }
  }
  return out;
}

/** Every node joined to `id` by any line, once each. */
export function beside(lines: GraphLine[], id: string): Set<string> {
  const out = new Set<string>();
  for (const l of lines) {
    if (l.from === id) out.add(l.to);
    else if (l.to === id) out.add(l.from);
  }
  return out;
}

/**
 * Where every node goes.
 *
 * A force simulation run to rest before anything is drawn, so the picture does not swim. It
 * starts from the same arrangement and the same random numbers every time, so the same library
 * gives the same picture. Nodes that already have a place (`placed`) keep it exactly, and the
 * rest settle around them: reading the graph again after a page was written adds the page
 * without rearranging what somebody was looking at.
 *
 * Laid out on the whole graph — every line, whatever is switched off — so narrowing the view
 * hides nodes and never moves them.
 */
export function layout(graph: Graph, placed: Map<string, Point> = new Map()): Map<string, Point> {
  type Body = { id: string; x?: number; y?: number; fx?: number; fy?: number };
  const count = degrees(graph.lines);
  const bodies: Body[] = graph.nodes.map((n) => {
    const at = placed.get(n.id);
    return at ? { id: n.id, x: at.x, y: at.y, fx: at.x, fy: at.y } : { id: n.id };
  });
  if (bodies.every((b) => b.fx !== undefined)) return new Map(bodies.map((b) => [b.id, { x: b.x!, y: b.y! }]));

  // The same numbers every run: d3's own generator, started from the same place.
  let seed = 1;
  const random = () => {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const links = graph.lines.map((l) => ({ source: l.from, target: l.to, kind: l.kind }));
  const simulation = forceSimulation(bodies)
    .randomSource(random)
    .force(
      "link",
      forceLink<Body, (typeof links)[number]>(links)
        .id((b) => b.id)
        // The tree holds a subject together loosely; a link pulls two pages close.
        .distance((l) => (l.kind === "under" ? 70 : 50))
        .strength((l) => (l.kind === "under" ? 0.5 : 0.25)),
    )
    .force("charge", forceManyBody().strength(-160).distanceMax(600))
    .force("collide", forceCollide<Body>((b) => radius(count.get(b.id) ?? 0) + 6))
    // Towards the middle, gently: what keeps pages with no lines at all from drifting away.
    .force("x", forceX(0).strength(0.04))
    .force("y", forceY(0).strength(0.04))
    .force("center", placed.size === 0 ? forceCenter(0, 0) : null)
    .stop();

  // Enough to come to rest for a small library; fewer rounds for a big one, which is slower
  // per round and settles into its broad shape early.
  const rounds = bodies.length > 1500 ? 120 : bodies.length > 400 ? 200 : 300;
  simulation.tick(rounds);

  return new Map(bodies.map((b) => [b.id, { x: b.x ?? 0, y: b.y ?? 0 }]));
}

/** How the graph sits in the window: moved by (x, y), then scaled by k. */
export type View = { x: number; y: number; k: number };

/** The view that shows all of `nodes` in a `width` by `height` area, with room around them. */
export function fit(nodes: GraphNode[], places: Map<string, Point>, width: number, height: number): View {
  const at = nodes.map((n) => places.get(n.id)).filter((p): p is Point => p !== undefined);
  if (at.length === 0 || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, k: 1 };
  const left = Math.min(...at.map((p) => p.x));
  const right = Math.max(...at.map((p) => p.x));
  const top = Math.min(...at.map((p) => p.y));
  const bottom = Math.max(...at.map((p) => p.y));
  const margin = 60;
  const k = Math.min(
    2,
    (width - 2 * margin) / Math.max(right - left, 1),
    (height - 2 * margin) / Math.max(bottom - top, 1),
  );
  const scale = Math.max(k, 0.02);
  return {
    x: width / 2 - ((left + right) / 2) * scale,
    y: height / 2 - ((top + bottom) / 2) * scale,
    k: scale,
  };
}

/** The node under a point on screen, or none: the nearest whose circle the point is in. */
export function nodeAt(
  nodes: GraphNode[],
  places: Map<string, Point>,
  count: Map<string, number>,
  view: View,
  x: number,
  y: number,
): string | null {
  let found: string | null = null;
  let nearest = Infinity;
  for (const n of nodes) {
    const p = places.get(n.id);
    if (!p) continue;
    const distance = Math.hypot(p.x * view.k + view.x - x, p.y * view.k + view.y - y);
    // A few pixels of grace: a small node should not need a steady hand.
    if (distance <= radius(count.get(n.id) ?? 0) * view.k + 4 && distance < nearest) {
      nearest = distance;
      found = n.id;
    }
  }
  return found;
}

/**
 * From `from`, the node joined to it that lies most nearly in a direction — what an arrow key
 * moves to. None when nothing joined to it lies that way.
 */
export function towards(
  lines: GraphLine[],
  places: Map<string, Point>,
  from: string,
  direction: "left" | "right" | "up" | "down",
): string | null {
  const here = places.get(from);
  if (!here) return null;
  const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
  const dy = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  let best: string | null = null;
  let bestScore = 0;
  for (const id of beside(lines, from)) {
    const p = places.get(id);
    if (!p) continue;
    const length = Math.hypot(p.x - here.x, p.y - here.y) || 1;
    // How squarely it lies that way, from 1 (dead ahead) down; anything more than about
    // sixty degrees off is not "that way".
    const score = ((p.x - here.x) * dx + (p.y - here.y) * dy) / length;
    if (score > 0.5 && score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

export const LINE_STYLE = {
  "links-to": { colour: "#9aa0b4", width: 1.2, dash: [] as number[] },
  under: { colour: "#4a4e5e", width: 1, dash: [] as number[] },
  cites: { colour: "#7a6a4a", width: 1, dash: [4, 3] },
} as const;

export const GROUND = "#14151a";
export const LABEL = "#e6e4de";

/** Whether a node's title is written beside it: when it is big enough on screen to have room. */
export function labelled(degree: number, k: number): boolean {
  return radius(degree) * k >= 7;
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * What is on screen, as an SVG picture: the same nodes, lines, colours and titles, in a
 * picture `width` by `height`. Text stays text, so it can be searched and scales cleanly.
 */
export function toSvg(
  shown: Graph,
  places: Map<string, Point>,
  colour: Map<string, string>,
  view: View,
  width: number,
  height: number,
): string {
  const count = degrees(shown.lines);
  const at = (id: string) => {
    const p = places.get(id) ?? { x: 0, y: 0 };
    return { x: round(p.x * view.k + view.x), y: round(p.y * view.k + view.y) };
  };
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif" font-size="12">`,
    `<rect width="100%" height="100%" fill="${GROUND}"/>`,
  ];
  for (const l of shown.lines) {
    const a = at(l.from);
    const b = at(l.to);
    const style = LINE_STYLE[l.kind];
    const dash = style.dash.length > 0 ? ` stroke-dasharray="${style.dash.join(" ")}"` : "";
    out.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${style.colour}" stroke-width="${style.width}"${dash}/>`,
    );
  }
  for (const n of shown.nodes) {
    const p = at(n.id);
    const r = round(radius(count.get(n.id) ?? 0) * view.k);
    const fill = colour.get(n.id) ?? SOURCE_COLOUR;
    out.push(
      n.kind === "source"
        ? `<rect x="${round(p.x - r)}" y="${round(p.y - r)}" width="${round(2 * r)}" height="${round(2 * r)}" fill="${fill}"><title>${escape(n.title)}</title></rect>`
        : `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}"><title>${escape(n.title)}</title></circle>`,
    );
  }
  for (const n of shown.nodes) {
    const degree = count.get(n.id) ?? 0;
    if (!labelled(degree, view.k)) continue;
    const p = at(n.id);
    out.push(
      `<text x="${round(p.x + radius(degree) * view.k + 4)}" y="${round(p.y + 4)}" fill="${LABEL}">${escape(n.title)}</text>`,
    );
  }
  out.push("</svg>");
  return out.join("\n");
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A string's bytes in base64, as the shell takes a picture to save. */
export function base64(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

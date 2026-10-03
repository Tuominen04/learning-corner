// Where a topic or a document may be moved to, worked out from the tree the sidebar shows.
//
// Pure, so every way of moving — dragging, the keyboard, the move button — asks the same
// questions and gets the same answers. The engine refuses a topic moved inside itself; these
// keep anybody from being offered it in the first place, along with moving something to where
// it already is, which would be a move that does nothing at best.

import type { Topic } from "./engine";

/** Something on its way somewhere else. */
export type Moving =
  | { kind: "document"; id: string; title: string }
  | { kind: "topic"; id: string; name: string };

/** Where something can go: a topic, or for a topic the top level. */
export type Place = string | null;

/** What a thing being moved is called, for saying what happened to it. */
export function nameOf(what: Moving): string {
  return what.kind === "document" ? what.title : what.name;
}

/**
 * Where something is now: the topic a document is in, or the topic a topic is in — `null` at
 * the top level. `undefined` when it is not in the tree at all.
 */
export function placeOf(topics: Topic[], what: Moving): Place | undefined {
  function search(level: Topic[], parent: Place): Place | undefined {
    for (const topic of level) {
      if (what.kind === "topic" && topic.id === what.id) return parent;
      if (what.kind === "document" && topic.documents.some((d) => d.id === what.id)) return topic.id;
      const found = search(topic.children, topic.id);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  return search(topics, null);
}

/** A topic and every topic below it, by identifier. */
function within(topics: Topic[], id: string): Set<string> {
  const found = new Set<string>();
  function collect(topic: Topic) {
    found.add(topic.id);
    topic.children.forEach(collect);
  }
  function search(level: Topic[]) {
    for (const topic of level) {
      if (topic.id === id) collect(topic);
      else search(topic.children);
    }
  }
  search(topics);
  return found;
}

/** Why something cannot go to a place, or `null` when it can. */
export function whyNot(topics: Topic[], what: Moving, to: Place): string | null {
  if (to === null && what.kind === "document") return "a document belongs in a topic";
  if (placeOf(topics, what) === to) return "where it is now";
  if (what.kind === "topic" && to !== null && within(topics, what.id).has(to)) {
    return to === what.id ? "the topic itself" : "inside the topic being moved";
  }
  return null;
}

export function canMove(topics: Topic[], what: Moving, to: Place): boolean {
  return whyNot(topics, what, to) === null;
}

/** One place a thing could go, in the order the sidebar shows them. */
export type Destination = { place: Place; name: string; depth: number; reason: string | null };

/**
 * Every place, in tree order, each saying whether it is open to this one — the top level first
 * for a topic, which is the one place that is not itself a topic.
 */
export function destinations(topics: Topic[], what: Moving): Destination[] {
  const out: Destination[] = [];
  if (what.kind === "topic") {
    out.push({ place: null, name: "The top level", depth: 0, reason: whyNot(topics, what, null) });
  }
  function walk(level: Topic[], depth: number) {
    for (const topic of level) {
      out.push({ place: topic.id, name: topic.name, depth, reason: whyNot(topics, what, topic.id) });
      walk(topic.children, depth + 1);
    }
  }
  walk(topics, what.kind === "topic" ? 1 : 0);
  return out;
}

/** A place said in words: "the top level", or the topic with the topics it sits in. */
export function placeName(topics: Topic[], place: Place): string {
  if (place === null) return "the top level";
  function search(level: Topic[], trail: string[]): string[] | null {
    for (const topic of level) {
      const here = [...trail, topic.name];
      if (topic.id === place) return here;
      const found = search(topic.children, here);
      if (found) return found;
    }
    return null;
  }
  return (search(topics, []) ?? ["a topic"]).join(" › ");
}

/** The topic or document with this identifier, as something that can be moved. */
export function findMoving(topics: Topic[], kind: Moving["kind"], id: string): Moving | null {
  for (const topic of topics) {
    if (kind === "topic" && topic.id === id) return { kind, id, name: topic.name };
    if (kind === "document") {
      const doc = topic.documents.find((d) => d.id === id);
      if (doc) return { kind, id, title: doc.title };
    }
    const found = findMoving(topic.children, kind, id);
    if (found) return found;
  }
  return null;
}

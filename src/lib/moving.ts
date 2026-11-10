// Where a page may be moved to, worked out from the tree the sidebar shows.
//
// Pure, so every way of moving — dragging, the keyboard, the move button — asks the same
// questions and gets the same answers. The engine refuses a page moved under itself; these keep
// anybody from being offered it in the first place, along with moving something to where it
// already is, which would be a move that does nothing at best.

import type { Page } from "./engine";

/** A page on its way somewhere else. Every page moves with every page under it. */
export type Moving = { id: string; title: string };

/** A parent: a page, or `null` for the top level. */
export type Place = string | null;

/**
 * Where something lands: under `parent`, at `position` among the pages there — counted from 0
 * among the others, the page being moved left out — or at the end with `null`.
 */
export type Spot = { parent: Place; position: number | null };

/** What a page being moved is called, for saying what happened to it. */
export function nameOf(what: Moving): string {
  return what.title;
}

/** The pages under `parent`, in order: the top level for `null`. `[]` for no such page. */
export function childrenOf(pages: Page[], parent: Place): Page[] {
  if (parent === null) return pages;
  return find(pages, parent)?.children ?? [];
}

/** The page with this identifier, wherever it is. */
export function find(pages: Page[], id: string): Page | null {
  for (const page of pages) {
    if (page.id === id) return page;
    const found = find(page.children, id);
    if (found) return found;
  }
  return null;
}

/** The page `id` is under — `null` at the top level, `undefined` when it is not in the tree. */
export function parentOf(pages: Page[], id: string): Place | undefined {
  function search(level: Page[], parent: Place): Place | undefined {
    for (const page of level) {
      if (page.id === id) return parent;
      const found = search(page.children, page.id);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  return search(pages, null);
}

/** Where a page is now: its parent and its place among its siblings. */
export function spotOf(pages: Page[], id: string): Spot | undefined {
  const parent = parentOf(pages, id);
  if (parent === undefined) return undefined;
  return { parent, position: childrenOf(pages, parent).findIndex((p) => p.id === id) };
}

/** A page and every page under it, by identifier. */
function within(pages: Page[], id: string): Set<string> {
  const found = new Set<string>();
  function collect(page: Page) {
    found.add(page.id);
    page.children.forEach(collect);
  }
  const page = find(pages, id);
  if (page) collect(page);
  return found;
}

/** Why a page cannot go to a spot, or `null` when it can. */
export function whyNot(pages: Page[], what: Moving, to: Spot): string | null {
  if (to.parent !== null && within(pages, what.id).has(to.parent)) {
    return to.parent === what.id ? "the page itself" : "under the page being moved";
  }
  const here = spotOf(pages, what.id);
  if (here && here.parent === to.parent) {
    const last = childrenOf(pages, to.parent).length - 1;
    const position = to.position ?? last;
    if (position === here.position || (to.position === null && here.position === last)) {
      return "where it is now";
    }
  }
  return null;
}

export function canMove(pages: Page[], what: Moving, to: Spot): boolean {
  return whyNot(pages, what, to) === null;
}

/**
 * The spot beside or under `target`: before or after it among its siblings, or under it at the
 * end. The position is counted among the others, the page being moved left out, which is how
 * the engine counts it.
 */
export function spotNear(
  pages: Page[],
  what: Moving,
  target: string,
  where: "before" | "after" | "under",
): Spot | undefined {
  if (where === "under") return { parent: target, position: null };
  const parent = parentOf(pages, target);
  if (parent === undefined) return undefined;
  const others = childrenOf(pages, parent).filter((p) => p.id !== what.id);
  const at = others.findIndex((p) => p.id === target);
  if (at < 0) return undefined;
  return { parent, position: where === "before" ? at : at + 1 };
}

/** One step up or down among its siblings, or `undefined` at either end. */
export function stepped(pages: Page[], what: Moving, by: -1 | 1): Spot | undefined {
  const here = spotOf(pages, what.id);
  if (!here || here.position === null) return undefined;
  const position = here.position + by;
  if (position < 0 || position >= childrenOf(pages, here.parent).length) return undefined;
  return { parent: here.parent, position };
}

/** One place a page could go, in the order the sidebar shows them. */
export type Destination = { place: Place; name: string; depth: number; reason: string | null };

/** Every parent, in tree order — the top level first — each saying whether it is open. */
export function destinations(pages: Page[], what: Moving): Destination[] {
  const out: Destination[] = [
    {
      place: null,
      name: "The top level",
      depth: 0,
      reason: whyNot(pages, what, { parent: null, position: null }),
    },
  ];
  function walk(level: Page[], depth: number) {
    for (const page of level) {
      out.push({
        place: page.id,
        name: page.title,
        depth,
        reason: whyNot(pages, what, { parent: page.id, position: null }),
      });
      walk(page.children, depth + 1);
    }
  }
  walk(pages, 1);
  return out;
}

/** A place said in words: "the top level", or the page with the pages it is under. */
export function placeName(pages: Page[], place: Place): string {
  if (place === null) return "the top level";
  function search(level: Page[], trail: string[]): string[] | null {
    for (const page of level) {
      const here = [...trail, page.title];
      if (page.id === place) return here;
      const found = search(page.children, here);
      if (found) return found;
    }
    return null;
  }
  return (search(pages, []) ?? ["a page"]).join(" › ");
}

/** The page with this identifier, as something that can be moved. */
export function findMoving(pages: Page[], id: string): Moving | null {
  const page = find(pages, id);
  return page ? { id: page.id, title: page.title } : null;
}

# ADR 0010 · The library graph: computed whole, stored nowhere, a screen of its own

> **Audience:** People building Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-11-14

## Context

M4 was planned as one feature, the "mind map". The first draft of this record found that it is
really two features, which want opposite things:

- **A picture of the whole library**: every page, how the pages link, and how the tree branches,
  growing as the library grows. Nobody draws it. It is there to be explored, and it is most
  useful exactly when the library is too big to hold in mind. With three hundred pages, nobody
  places nodes by hand.
- **Diagrams a person makes**: a family tree, a network map, a historical path. These have a few
  nodes, a structure that means something, and an arrangement chosen on purpose. Their nodes
  may or may not be pages.

Storing hand positions, hiding nodes and opening in a second window are right for the second
and wrong for the first. So the two are split. This record is the **library graph** (M4a).
Diagrams are [ADR 0011](0011-diagrams.md) (M4b).

What the graph can draw is already in the index. The engine keeps every `[[id]]` link (that is
how backlinks work), every citation (that is how `source.citingDocuments` works), and every
page's parent ([ADR 0009](0009-pages-not-topics.md)).

## Decision

The library graph is a **screen in the main window**, beside *Pages*, *Sources* and *Works*. It
shows every page in the library, and optionally every source, as nodes. Its lines are the links
between pages, each page's place in the tree, and citations. **All of it is computed** from what
the library already holds, each time the screen is shown. Nothing about the graph is written into
the library. The engine supplies the nodes and lines in one call. The interface lays them out
and draws them.

### What is on it

- **Nodes** are pages, and also sources when *Show sources* is on. Each node is sized by how many
  lines it has, and coloured by the top-level page it sits under, so a subject reads as one
  colour and the pages that connect subjects stand out. A page with no links at all is easy to
  spot, and that is worth knowing.
- **Lines** come in three kinds, drawn differently:
  - *links to*: from `[[id]]` in a page's text;
  - *under*: a page to its parent, drawn faint, so the tree shows without drowning the links;
  - *cites*: a page to a source, only when sources are shown.
- Works, and the diagrams of [ADR 0011](0011-diagrams.md), can join later as further kinds of
  node. Neither is needed for the graph to be useful.

### Using it

- **Hovering or selecting** a node highlights it and its neighbours, and dims everything else.
  **Opening** it (double-click, or Enter) goes to the page on the *Pages* screen.
- **Find** puts a node in the middle, typed by title as in search. This is also the keyboard's
  way into the graph: find a node, then step to its neighbours with the arrow keys.
- **Focus** narrows the graph to one page and everything within one, two or three steps of it,
  or to the pages under one page. **Show sources** and **Show the tree** turn those kinds of node
  and line on and off.
- **Export** saves what is on screen as SVG or PNG. The interface renders the image and the
  shell writes it through the engine's atomic write, as for every export.
- Which focus and toggles were last used is remembered per library, in the application's
  settings, as the panes of a work are ([Packaging](../packaging-fedora.md#directories)). It is a
  convenience on this computer, not part of the library.

### The engine's operation

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `library.graph` | whether to include sources | every node (id, kind, title, its top-level page) and every line (from, to, kind) |

It is answered from the index, so it is one read, not a walk over the files. It returns ids and
titles only, never text, so even a large library costs a few hundred kilobytes at most. Focus is
done in the interface on what was returned, and needs no second call.

### Layout and drawing

- **The layout is a force simulation (`d3-force`) in the interface**, run to rest before
  anything is drawn. It starts from the same arrangement and the same random numbers every
  time, so the same library looks the same each time the screen opens. It is laid out on the
  whole graph, so narrowing the view hides nodes and never moves them. While the screen is
  open, nodes already placed keep their places when the graph is read again — when sources are
  switched on, say — so the picture is added to rather than rearranged.
- **It is drawn on a canvas, not as page elements.** A library of a few thousand pages has to
  pan and zoom smoothly, and one element per node does not manage that. The drawing is the
  application's own, about a hundred lines on the canvas, rather than a graph-drawing library:
  it needs circles, lines and titles, and owning it keeps every node reachable from the panel
  beside the picture, which a canvas alone is not. React Flow, named in [Stack](../stack.md)
  for the map, is for the diagrams of ADR 0011, where nodes are few and are edited one by one.
- **Everything the picture can do is also beside it, as ordinary controls**: finding a node,
  what it is joined to, opening it, narrowing to it. A canvas says nothing to a keyboard or a
  screen reader, so the picture is never the only way to anything.

### Updating

The graph is read again whenever its screen is shown. Every change a person makes, they make
on another screen, so returning to the graph always shows it. That is why it needs **no events
and no second window.** A change made outside the application shows the next time the screen is
shown, or after the folder is watched, which is a separate promise and not part of M4.

## Alternatives considered

**One kind of map for both purposes**, the first draft of this record. A map with a scope, hand
positions and hidden nodes, in a second window. Rejected because the two purposes pull apart. At
library scale, stored positions are positions nobody chose. For a family tree, a scope of "the
pages under a page" is the wrong structure entirely, because a person's parents are not their
sub-pages.

**Storing the graph's layout**, so that it never moves. Rejected because the file would hold
nothing the person decided, and would need rewriting on every new page. A seeded layout that
keeps placed nodes still while the screen is open gives the stability without the file.

**A second window**, as the architecture always planned for maps. Rejected for the graph, by
choice: it is a place you go to explore, not something kept beside the page you are writing. A
screen of the main window needs no change events, no window management and no rule for what
happens to a second window when the library closes. ADR 0011 makes the same choice for diagrams,
for now.

**React Flow, as [Stack](../stack.md) names.** Rejected for this screen only: it draws every node
as an element, which is right for a diagram of thirty editable nodes and slow for a graph of two
thousand nodes that are only looked at.

**The engine computing the layout**, so every client draws the same picture. Rejected because a
layout is pixels, and pixels are the interface's ([Architecture](../architecture.md#where-logic-is-allowed-to-live)).
Getting it wrong cannot harm a library.

## Consequences

- **M4 becomes M4a, the graph, and M4b, diagrams**, in that order. M4a changes nothing on disk,
  so it ships without touching the format, the fixtures or the backup.
- **One engine operation, `library.graph`, and one new screen.** The contract's *Maps* section
  moves to ADR 0011. `export.map` becomes the interface's for the graph too.
- **The user guide's *Mind maps* page splits** into *The library graph* and *Diagrams*. The
  glossary gains *graph* and keeps *map* only if diagrams are still called that.
- **[Stack](../stack.md) changes:** React Flow is for diagrams, and a canvas renderer is for the
  graph.
- **Forecloses**, without a new decision: arranging the graph by hand, and keeping more than one
  saved view of it. Both are what diagrams are for.

## Revisit if

- People want the graph open beside the page while writing. That is the case for a second
  window, with the change events it needs.
- A real library makes the graph unreadable even with focus, as one solid ball. That would call
  for grouping, where a top-level page is drawn as one node until it is opened, rather than for a
  better layout.
- People ask to pin a node of the graph in place. That would be the first stored state, and
  probably a sign that a diagram was wanted instead.

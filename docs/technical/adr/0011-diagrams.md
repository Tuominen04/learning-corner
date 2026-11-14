# ADR 0011 · Diagrams are files of their own, shown in a page by reference

> **Audience:** People building Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-11-14

## Context

[ADR 0010](0010-library-graph.md) splits M4 in two. The library graph is computed and stores
nothing. This record covers the other half, M4b: **diagrams a person makes**. Three kinds came
out of using the application:

- **A family tree**, or any hierarchy: a person and their parents, a field and its schools.
  It is not a tree in the strict sense, because a person has two parents and two lines can meet
  again. Its structure is not the page tree either: someone's parents are not their sub-pages.
- **A historical path**: events in time order, some joined to show what led to what.
- **A network map**: things and the connections between them, arranged by hand so the picture
  means something.

All three share these needs:

- the structure is the person's, so it has to be stored;
- a node may point at a page that has the details, and opening the node opens the page;
- a node may also be only a label, such as a person not written about yet;
- a diagram belongs *in* the page it illustrates, not only beside it.

Two constraints from earlier decisions apply:

- **Pages stay readable outside the app** ([Storage format](../storage-format.md)). Whatever a
  page holds to show a diagram has to read sensibly in a text editor or a Markdown viewer.
- **The editor round-trips a page exactly** ([ADR 0008](0008-narrow-editor-schema.md)). A new
  construct in a page must be written back character for character.

The person chose to keep a diagram as **a file of its own that a page refers to**. It can then
be dragged and edited freely, at the cost of being drawn only by Learning Corner. The other
choice was a Mermaid block written as text into the page: drawn by many Markdown viewers, but
laid out by Mermaid and never by hand.

## Decision

A diagram is a TOML file in `maps/`. It holds its own nodes and lines, and it has a **layout**:
*layered*, *timeline* or *free*. The layout decides how positions come about. *Layered* and
*timeline* diagrams are laid out by the computer from their structure. *Free* diagrams store the
positions the person dragged nodes to. A node can point at a page by id, and then shows that
page's current title and opens it. A page shows a diagram with a picture line whose address is
the diagram's id: `![Family tree](diagram:01JB…)`. Diagrams are edited on a screen of their own
in the main window. A page shows a diagram drawn in place, and its linked nodes can be opened.

### What a diagram file holds

```toml
# maps/family-tree.toml
id = "01JB…"
title = "Family tree"
layout = "layered"      # layered | timeline | free
direction = "down"      # layered only: down | right
created = "2026-11-13T10:00:00Z"

[[node]]
id = "01JC…"            # the node's own id, inside this diagram
page = "01J9…"          # optional: shows that page's title, and opens it

[[node]]
id = "01JD…"
label = "Not written about yet"   # a node with no page has a label

[[node]]
id = "01JE…"
page = "01JA…"
label = "Shown differently here"  # a label overrides a page's title, when wanted
when = "1850"           # timeline only: what puts it in order
x = 120.0               # free only: where it was dragged to
y = -40.0

[[line]]
from = "01JC…"
to = "01JD…"
label = "parent of"     # optional
```

- **A node's id is its own**, so the same page can appear twice in one diagram (a family tree
  sometimes needs that), and a node keeps its place in the structure when its page changes.
- **A linked node with no label shows its page's title as it is now.** Renaming the page renames
  the node. Nothing is copied, so nothing goes stale.
- **A linked node whose page no longer exists** is drawn as a label saying so, with *Unlink* to
  turn it into a plain node. It is not a problem with the library, and deleting a page never
  looks at diagrams. The node keeps its place in the structure, so a deleted page does not
  break a family tree into pieces.
- **`when`** is text, because history is not always a date: *1850*, *c. 1200*, *the late Bronze
  Age*. A timeline sorts by the year it can read from it, and by the order of the nodes in the
  file where it can read none. The text is shown exactly as written.
- **Lines have a direction**, from and to, and an optional label. A *layered* diagram lays out
  along that direction. A line drawn back up a layered diagram is drawn, not refused.

### The three layouts

| Layout | For | Positions | What dragging does |
| ------ | --- | --------- | ------------------ |
| **Layered** | family trees, hierarchies, what led to what | computed from the lines (`@dagrejs/dagre`) | reorders a node among its neighbours in the same layer |
| **Timeline** | historical paths | computed from `when`, along one axis | nothing; you change `when` |
| **Free** | network maps, anything arranged by hand | stored, as dragged | moves it |

Changing a diagram's layout keeps its nodes and lines. Changing to *free* stores the positions
the old layout had produced, as a starting point. Changing away from *free* drops the stored
positions, and the undo for the change brings them back.

### Showing one in a page

```markdown
The family over four generations:

![Family tree](diagram:01JB…)
```

- **It is ordinary Markdown picture syntax**, alone on its line, with `diagram:` and an id as its
  address. A text editor shows a line that says what it is. A Markdown viewer shows a broken
  picture whose text is the diagram's title. Learning Corner draws the diagram there, at the
  page's width, with its linked nodes opening their pages and an **Edit** button.
- **The text in brackets is the page's, not the diagram's.** It is what a reader without the app
  sees, and the person writes it. Renaming a diagram does not rewrite the pages that show it.
- **The engine indexes these references** as it does `[[id]]` links. A diagram can say which
  pages show it, a page lists the diagrams on it among its backlinks, and search finds diagrams
  by title and node label.
- **Split** moves a diagram line with the section it is in, like any other line.

### The engine's operations

The contract's *Maps* section becomes *Diagrams*:

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `diagram.list` | — | id, title and layout of every diagram |
| `diagram.create` | title, layout | the diagram |
| `diagram.read` | id | the diagram, with each linked node's current page title, or that its page is gone |
| `diagram.write` | id, revision, the whole diagram | the diagram, or `Conflict` |
| `diagram.shownIn` | id | the pages that show it |
| `diagram.deletePlan` / `diagram.delete` | id | the pages that show it; then nothing |

- **One `write` for the whole diagram, with a revision**, as for a document: the editor holds
  the diagram and saves it whole. That makes undo the editor's, one diagram at a time, and a
  change made outside the app a `Conflict`, as for any file. A diagram is small, so writing it
  whole costs nothing.
- **Deleting a diagram** lists the pages that show it. Applying the delete removes their
  `diagram:` lines, as deleting a source removes its citations from works, so no page is left
  pointing at nothing. A deleted page, on the other hand, leaves its diagram nodes alone (above).

### Where it is edited

On a **screen of its own in the main window**, opened from **Edit** on a diagram in a page, or
from the list of diagrams. It has the diagram and its tools, and a way back to the page it came
from. It is a screen rather than a second window for the reasons in
[ADR 0010](0010-library-graph.md): no change events and no window management. A diagram in a
page is drawn from the file each time the page is opened. Editing is done with React Flow
(`@xyflow/react`), which [Stack](../stack.md) chose for this.

### Format

`maps/` keeps its name, as `topics/` did. It has been part of the documented layout since
format 1, and engines from format 1 on already count it as the library's own: a library holding
`maps/` still has its folder to itself, so renaming the library still renames the folder. A new
`diagrams/` folder would make every older engine believe the folder held something else. An
older engine leaves `maps/` alone, and a backup copies it like any other folder. So **format 2
stays format 2.**

An older application opening a page with a diagram line shows a missing picture with the
diagram's title, and writes the line back unchanged. This has to be checked against 0.24.0
before M4b ships, not assumed.

## Alternatives considered

**A Mermaid block in the page.** The diagram is text in the `.md`, drawn by GitHub, by many
editors and by static sites, and readable even undrawn. It would fit the readable-files promise
best. Rejected by the person's choice, because Mermaid lays every diagram out itself: nothing can
be dragged, a network map cannot be arranged, and a node cannot be told to sit where it means
something. Mermaid stays a sensible *export*: a layered or timeline diagram can be written out as
Mermaid text for use elsewhere.

**A rendered picture beside each page, kept up to date**, so that every Markdown viewer shows the
diagram. Rejected because the picture would be a second copy, rewritten on every change to the
diagram or to a linked page's title. It would also have to sit beside every page that shows the
diagram, and move whenever such a page moved. The same reasoning led ADR 0010 to store nothing.

**Using the page tree as the family tree**: make people pages, parents above children. Rejected
because a person has two parents and a page has one, and because the tree of pages is how the
writing is organised, which is a different question from how the subject is shaped.

**Nodes that are always pages.** Simpler, because every node opens something. Rejected because
the start of a family tree is mostly people with no page yet. Forcing a page per node would fill
the library with empty pages, which ADR 0009 named as the sign of a wrong design.

**A diagram embedded *inside* the page's file**, as a TOML or JSON block. The page stays one
file. Rejected because the page would then carry positions and ids that are not writing, which
makes every viewer show noise. It would also stop one diagram being shown on two pages.

**ELK for layered layout.** It is more capable than dagre, with better crossing reduction and
ports. Rejected for now: its licence (EPL-2.0) is weak copyleft, unlike everything else the app
depends on (MIT and Apache-2.0), and dagre covers family trees and hierarchies. Revisit if large
layered diagrams come out tangled.

**A second window for editing.** Kept for later, for the same reason as the graph's. Unlike the
graph, this is the one place a second window might really be wanted: drawing a diagram while
reading the page beside it.

## Consequences

- **The format gains a documented file** in `maps/`, and a `diagram:` address for pictures in
  pages. The storage format's *Maps* section becomes *Diagrams*. A frozen fixture,
  `diagrams`, holds one diagram of each layout and a page showing each.
- **The index learns diagrams and their references**, and still rebuilds to exactly what was
  written.
- **The editor gains one node type**: a diagram, written back as the line it was read from. The
  round-trip tests cover it.
- **Backup** copies `maps/` like any other folder. A diagram changed in both places is a file
  changed in both places, and its line diff is readable because the file is TOML, one node to a
  block.
- **New dependencies:** `@xyflow/react` (MIT) and `@dagrejs/dagre` (MIT).
- **The user guide gains *Diagrams***, which replaces the *Mind maps* page together with
  ADR 0010's *The library graph*. Whether the word *map* survives anywhere in the interface is
  decided when the user guide is written. The folder keeps it either way.
- **Forecloses**, without a new decision: a diagram that is computed from the library. That is
  the graph's job.

## Revisit if

- People keep wanting a diagram readable outside the app: pasting pages into a forge, or
  publishing a site. That is the case for a Mermaid export kept beside the page, or for Mermaid
  after all.
- Free diagrams turn out to be what everyone uses, and layered and timeline diagrams are dragged
  into *free* just to arrange them by hand. That would mean computed layouts are only ever a
  starting point.
- Nodes whose pages are gone pile up unnoticed. That would argue for listing them as problems
  with the library after all.
- People draw a diagram while reading a page, switching screens back and forth. That is the case
  for the second window.

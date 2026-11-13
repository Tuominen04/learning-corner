# ADR 0010 · A map is a scope and the positions you chose, in a window of its own

> **Audience:** People building Learning Corner
> **Status:** Proposed
> **Last reviewed:** 2026-11-13

## Context

M4 adds mind maps ([roadmap](../roadmap.md#m4--mind-maps), [user guide](../../user/mind-maps.md)).
Much of their shape was settled before any of it was built, and is not reopened here:

- **A map is a view, not a copy.** A node points at a page or a source by id and never holds its
  text. Deleting a map loses an arrangement, never writing.
- **Edges drawn from links are computed, never stored** ([Storage format](../storage-format.md#maps)),
  so a map cannot go stale.
- **Maps live in `maps/`, one TOML file each.** The layout has listed `maps/` since format 1.
- **The map opens in a second window**, which the shell owns ([Architecture](../architecture.md)).
- **The engine keeps positions and the interface handles dragging** (the logic table in
  [Architecture](../architecture.md#where-logic-is-allowed-to-live)).
- **React Flow draws the map** ([Stack](../stack.md), [ADR 0005](0005-react-tiptap-interface.md)).

Four questions are still open, and each is expensive to change once maps exist in people's
libraries:

1. **Which pages are on a map?** The test M4 must pass is a map of a page that "updates as it
   is written". A page added under that page has to appear on the map without anyone putting it
   there. If a map were only a list of nodes added by hand, it would be stale the
   moment a page was added.
2. **What is stored for positions?** Storing every node's position would freeze the automatic
   layout the first time a map was saved. A page added later would then land somewhere arbitrary
   among positions nobody chose.
3. **How does the second window hear about changes?** The contract lists events
   (`entityChanged`, `externalChange`), but nothing implements them: the one window has never
   needed them, because it makes every change itself.
4. **Where is an image made?** The contract has `export.map` in the engine, returning an image.
   But the picture, with its layout, curves, labels and fonts, exists only in the interface.

## Decision

A map is a **scope** plus **what the person chose**: the pages it covers, the positions they put
nodes in, the nodes they added or hid, and the lines they drew. Everything else is computed each
time the map is drawn: which pages are in scope now, the lines from links and from the tree, and
where to put every node that was not placed by hand. The map opens in a second window of the
same application. That window talks to the same engine through the same shell, and it redraws
when the shell announces that something changed. Layout and image export happen in the
interface. The engine stores and checks what a map says, and never draws it.

### What a map file holds

```toml
# maps/<name>.toml
id = "01JC…"
name = "An overview"
created = "2026-11-13T10:00:00Z"

[scope]
page = "01J8…"         # this page and every page under it, at any depth; absent = the whole library

[[node]]                # a page in scope, placed by hand
ref = "01J9…"
x = 120.0
y = -40.0

[[node]]                # a page or source from outside the scope, added by hand (unplaced: no x, y)
ref = "01JA…"

[[node]]                # a free node: a question or a reminder, not a page
id = "01JB…"
text = "An open question, not yet a page"
x = 300.0
y = 80.0

[[hidden]]              # a page in scope the person took off this map
ref = "01JD…"

[[edge]]                # a line drawn by hand
from = "01J9…"
to = "01JB…"
label = "contradicts"
```

- **The scope decides which pages appear.** A page created under the scope's page is on the map
  the next time it is drawn. Hiding a page writes `[[hidden]]` and leaves the page itself alone.
- **Only positions chosen by hand are stored.** A node without `x` and `y` is placed by the
  layout each time the map is drawn. Dragging a node gives it a position. **Arrange
  automatically** removes every stored position, and can be undone.
- **A reference that no longer resolves is left out of the drawing.** For example, a page
  deleted inside the app or by hand. It is not a problem with the library. The engine removes it
  from the file the next time it writes that map, so a map never blocks deleting a page and
  deleting a page never needs to look at maps.
- **Lines that are computed, never stored:** *under* (a page to its parent, drawn faint), *links
  to* (from `[[id]]` in the page's text), and *cites* (a page to a source, only when the source
  is on the map). Lines drawn by hand are drawn differently, with their label.
- **The file name comes from the map's name**, by the same rule as pages, with `-2` when the name
  is taken. Identity is the `id` inside, as everywhere else ([ADR 0003](0003-files-as-source-of-truth.md)).

### No new format version

Maps change the format the way works did in M3. `maps/` has been part of the documented layout
since format 1, and no engine before M4 reads or writes it. An older engine opening a library
with maps in it leaves them alone, and a backup copies them like any other files. So format 2
stays format 2, and the `v2` fixture gains a sibling, `maps`, rather than a replacement.

### The engine's operations

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `map.list` | — | id and name of every map |
| `map.create` | name, scope (a page, or none) | the map |
| `map.read` | id | the map as drawn: nodes in scope or added, each with its title and its position if it has one, and every line, computed and drawn by hand |
| `map.place` | id, a list of (node, position or none) | — |
| `map.addNode` / `map.hide` | id, a page or source, or free text | the node |
| `map.addEdge` / `map.removeEdge` | id, from, to, label | — |
| `map.rename` | id, name | the map |
| `map.deletePlan` / `map.delete` | id | what goes (its name, how many nodes were placed by hand and lines drawn); then nothing |
| `map.makePage` | id, free node, parent page | the page, at the free node's position, with its lines kept |

`map.place` takes a list because one drag can move a selection, and *Arrange automatically*
clears every position in one call. It is sent when a drag ends, never on every frame. Deleting a
map is two-phase like every destructive operation, because a hand-made arrangement is the
person's work even though it is not writing.

### The second window

- The shell opens a second webview window labelled `map:<id>`, loading the same interface bundle
  at `?map=<id>`. If that map is already open, the shell focuses its window and opens no second
  one. There is still one process, one open library and one engine behind one lock, so the
  single-writer assumption ([Architecture](../architecture.md#deliberate-non-goals)) holds.
- **After every write the shell routes to the engine, it emits `entityChanged`** to every window,
  with the ids of what changed. This is the event the contract already describes, now
  implemented. The map window reads its map again, at most a few times a second while someone is
  typing. A change made outside the application is not announced until the engine watches the
  folder. That was promised separately and is not part of M4.
- **Opening a node** sends `openPage` to the main window, which shows the page and comes to the
  front. The map window never edits text.
- Closing the main window closes the library's map windows. Switching library closes them too.

### Layout and the image

- **The layout is a force simulation (`d3-force`) in the interface.** Positions chosen by hand
  are fixed points in it, so a node that was not placed settles *around* what the person
  arranged. A layered or tree layout (ELK, dagre) cannot treat some nodes as fixed. The
  simulation is seeded from the map's id, so the same map with the same pages looks the same
  every time it opens.
- **Filtering by distance** ("this page and everything within two steps") is a view, chosen in
  the window and not stored in the map. A narrower map that should last is a new map with a
  narrower scope.
- **`export.map` moves to the interface.** The map window renders the picture it is showing to
  SVG or PNG. The shell writes the bytes where the save dialog says, using the engine's atomic
  write, as for every export. The engine has nothing to contribute: an image of a layout cannot
  corrupt a library, and redrawing the layout in Rust would mean two layouts that disagree.

## Alternatives considered

**A map is only the nodes added to it by hand.** It is the simplest file: a list of ids and
positions. Rejected because it fails M4's own test. A page written under the map's page would not
appear on the map until someone remembered to add it, which makes the map a second copy
of the tree that drifts, the very thing the user guide promises a map is not.

**Store every node's position, including the layout's.** Every node then has the same shape, and
reading a map needs no layout at all. Rejected because the first save freezes the automatic
layout forever, so the file can no longer tell an arrangement the person chose from one the
computer guessed. *Arrange automatically* would then have nothing to keep, and every page added
later would need a position invented for it among fixed ones.

**The scope as a stored filter (depth, kinds of node, distance from a node).** It is more
powerful. Rejected for now because each filter stored is a rule an older engine has to
understand and a reader of the file has to work out. One scope, a page or the whole library,
answers *a map of this subject*. Anything narrower is either a view or a second map.

**A separate process, or a second engine, for the map window.** It would isolate the windows.
Rejected because two engines on one library are two writers, and the storage format, the index
and the conflict model all assume one ([ADR 0003](0003-files-as-source-of-truth.md)).

**The map inside the main window, as a pane.** No events and no second window. Rejected because
the point of the map is to stay in view *while* writing, on a second screen or beside the page,
which is what the shell's second window was always planned for. A pane may come later as well,
and would work the same way.

**ELK or dagre for the layout.** Both draw neat layered pictures of a tree. Rejected because
neither respects nodes the person has already placed, and keeping hand placement is the
milestone's requirement. *Under* lines are drawn faint precisely because the force layout does
not draw them as a strict tree.

**Rendering the image in the engine**, as the contract had it. Rejected for the reason above: it
would need a second implementation of the layout and of the drawing. The contract's line was
written before anything was drawn.

## Consequences

- **The shell starts announcing changes.** `entityChanged` becomes real for every write, which
  the main window can use too, for example to refresh backlinks when another page links to the
  open one. Every check that stubs the engine gains a way to fire the event.
- **The contract changes:**
  - `map.setNodePosition` becomes `map.place`;
  - `map.removeNode` becomes `map.hide` for pages in scope, and removal for added nodes;
  - `map.list`, `map.rename`, `map.deletePlan` and `map.makePage` are added;
  - `export.map` leaves the engine.
  The storage format's *Maps* section gains the file above. The user guide's *Mind maps* page
  loses its **Planned** status as each part ships.
- **The index learns maps**, so search finds a map by name and a free node by its text, and
  rebuilding equals what was written, as for everything else in it.
- **Backup copies `maps/` like any other folder.** A map changed on the drive and in the library
  is a file changed in both places. It is answered like any other, and a map's line diff
  is readable because the file is TOML, one node to a block.
- **Two new interface dependencies**, `@xyflow/react` (MIT) and `d3-force` (ISC), each pinned
  like every other.
- **Deleting a page never touches a map**, and a map never stops a page from being deleted. The
  cost is that a map file can hold a reference to nothing for a while. That is acceptable, because
  the engine removes it on the next write and nothing ever shows it.
- **Forecloses:** a node whose picture differs from its page (a different title, a colour that
  means something) without a later decision. A node is the page it points at.

## Revisit if

- People make several maps of the same page that differ only in what they hide. That is a sign
  the scope needed a stored filter after all.
- The force layout's pictures are found hard to read for a deep tree, so that people arrange
  every node by hand. That would mean a tree layout was the better starting point, with fixed
  nodes handled some other way.
- A map file is often found with references to nothing, and they matter to someone: a backup
  diff full of removed nodes, or a hand-edited map losing lines.
- Typing in the main window makes the map window lag. That would mean announcing every write
  costs more than it is worth, and the map should be told less often or told less.

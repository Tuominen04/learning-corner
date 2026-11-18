# Diagrams

> **Audience:** People using Learning Corner
> **Status:** In progress — making and changing diagrams works; showing one inside a page comes next
> **Last reviewed:** 2026-11-18

[The library graph](library-graph.md) draws itself from what you wrote. A **diagram** is the
opposite: a picture you build on purpose, whose shape means something — a family tree, a
historical path, a map of a network.

Choose **Diagrams**, beside **Documents**, **Sources**, **Works** and **Graph**, give a new
diagram a name, and pick what kind it is.

## Three kinds

- **Layered** — a family tree, or any hierarchy: who descends from whom, which school of
  thought came out of which. The app arranges it in layers, following the lines you draw. A line
  from a parent to a child puts the parent above; **Running down** turns the whole thing to run
  to the right instead. **Earlier** and **Later** move a box among its neighbours in the same
  layer.
- **Timeline** — a historical path: boxes in order of when. Each box says *when* in your own
  words — *1850*, *c. 1200*, *3 May 1850*, *500 BC*, *the late Bronze Age*. The app puts boxes in
  order of the year it can read from the words; those with no year in them come after, in the
  order you made them.
- **Free** — a map of a network, or anything else you want to arrange yourself. Boxes stay
  where you drag them. **Arrange again** forgets where they were put and lays them out afresh.

You can change a diagram's kind whenever you like, and nothing is lost: every box and line stays,
and so does every *when*. Changing to **Free** starts each box where it was; changing away from it
lets go of where you dragged things, and **Undo** brings them back.

## What is on one

- **Boxes.** **+ Box** adds one that is only a label — a person you have not written about yet, an
  event you only know the name of. **+ Page…** adds one for a page you have written.
- **Lines**, from one box to another. Drag from the edge of a box to another box, and a line is
  drawn. A line can say something: *parent of*, *led to*, *connects to*. It has a direction, and
  **Reverse** turns it round.

A box for a page is not a copy of it. It says the page's title as it is now, so renaming the page
renames the box — unless you give the box words of its own, which win. Double-click the box, or
choose **Open the page**, and you are at the page with the details. A box can be pointed at
another page, or **Unlink**ed and left as a label.

If the page is later deleted, the box stays where it was, marked as pointing at a page that is
gone, so a family tree does not fall apart because one page did. You can open nothing from it,
but you can unlink it and keep the box.

## Working on one

Everything you do is saved a moment after you do it. **Undo** and **Redo** (Ctrl+Z, Ctrl+Shift+Z)
step through what you have done to this diagram. Leaving a diagram, or closing the library, saves
what is waiting first.

If the diagram was changed somewhere else since you opened it — in a text editor, or on another
computer — the app does not write over it. It tells you, and asks which you want: the changed
one, or yours.

Everything the picture can do is also beside it, as ordinary controls: every box and line is in a
list, and choosing one there lets you change its words, its page and its place in order from the
keyboard alone.

## Saving it as a picture

**Save as a picture** saves the diagram as **SVG**, which stays sharp at any size, or **PNG**,
which opens anywhere. The file is named after the diagram.

## Deleting one

**Delete this diagram…** says what goes before anything does. A diagram's boxes and lines are
deleted. Nothing you wrote is touched, except that a page which shows the diagram loses the picture
line that shows it — and you are told which pages those are first.

## Finding one

Search finds a diagram by its name and by what its boxes say.

## Coming next

Showing a diagram **inside a page**, where the writing is about it, with each box opening its
page — and putting one there from the writing tools.

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

# ADR 0009 · Every page is a document, and any page can have pages under it

> **Audience:** People building Learning Corner
> **Status:** Proposed
> **Last reviewed:** 2026-11-10

## Context

Format 1 has two kinds of thing in the tree. A **topic** is a folder holding `topic.toml` (an
id, a name, a date) and nothing a person writes. A **document** is a `.md` file inside a topic.
A topic has no text of its own.

Using the application showed that this is the wrong shape for how a subject is actually
written up. A person studying protein wants a page called *Protein* that says what protein is,
in a paragraph or two, and then pages under it — *History*, *Current*, *Type 1*, *Type 2* — each
of which may grow pages of its own. That is the shape of a wiki such as Azure DevOps Wiki: one
kind of thing, a page, at every level. In format 1 it can only be faked: a topic named *Protein*
with a document inside it, also named *Protein* or *Overview*, which the sidebar shows as two
entries for one idea.

Three facts constrain the answer:

- **Identity is the id inside a file, never its path** ([ADR 0003](0003-files-as-source-of-truth.md),
  `store`). Links (`[[id]]`), citations' back-references, search and the index already name
  documents by id, so moving files does not break them.
- **The folder must stay readable** ([Storage format](../storage-format.md#layout)): opening it in
  a file manager shows the shape the sidebar shows.
- **Format 1 is frozen** as the `v1` fixture, and the format's rule is that an older library is
  migrated by writing a full copy beside it first, never by editing it in place
  ([Storage format](../storage-format.md#librarytoml)). No migration has been written yet.

## Decision

Format 2 has one kind of entry in the tree: the **page**, which is a document — the same
Markdown file with the same front matter as today — that can have pages under it. A page's
sub-pages live in a folder named like the page's file, beside it. The folder exists only while
the page has sub-pages. The order of pages under one parent is the person's, written in a plain
list in that folder. Topics, and `topic.toml`, are gone. Libraries in format 1 are migrated when
they are opened, after a full copy has been written beside them.

### Layout

```
topics/
├── .order                  # protein, history, current — the order at this level
├── protein.md              # the Protein page's own text
├── protein/                # its sub-pages: present only while it has some
│   ├── .order              # type-1, type-2
│   ├── type-1.md
│   ├── type-2.md
│   └── type-2/
│       ├── stuff-1.md
│       └── stuff-2.md
├── history.md              # no sub-pages yet, so no folder
└── current.md
```

- **A page is `<name>.md`**, named from its title by today's rule (`slug`), with `-2`, `-3` when
  the name is taken. Renaming a page renames its file *and its folder* together.
- **Its sub-pages are in `<name>/`** beside it. Adding the first sub-page creates the folder;
  removing the last removes it. A folder with no page of its name beside it — made by hand, or
  left by a page deleted outside the app — is reported as a problem with the library, as an
  unreadable file is today, and its pages are still listed, under a stand-in named after the
  folder.
- **`.order`** lists the pages at that level, one file name without `.md` per line, top to
  bottom. A page not on the list comes after the listed ones, by title; a name on the list with
  no page is ignored. So a hand-made page, or a hand-deleted one, never breaks the tree — the
  list only ever orders what is there. Absent, the level is in title order.
- **`topics/` keeps its name.** It is the root of the tree, and renaming it would move every
  file in every library for a word.
- **Pictures** stay beside the page that shows them, as today. A picture's file always has an
  extension and a sub-page folder never does, so the two cannot collide.

### What changes for a person

- One **+** on any page makes a page under it, and one at the top makes a page at the top. There
  is no *New topic*.
- Pages are dragged, or moved from the keyboard or the move button, to another parent *and* to
  another place among their siblings.
- Deleting a page with sub-pages asks first, as deleting a topic does today: delete them too, or
  move them up to where the page was.
- Splitting a document makes the new one a sub-page of the original, rather than a sibling — a
  part split out of a page belongs under it. (Reconsider if that is not how it gets used.)

### Migration from format 1

Opening a format 1 library offers to convert it; nothing is written until the person agrees,
and the first thing written is a full copy of the library beside it, as the format already
promises. Then, for every topic, from the deepest up:

1. Its `topic.toml` becomes a page `<folder>.md` beside the folder, **keeping the topic's id**,
   name (as the title) and creation date, with an empty body. Anything that named the topic by
   id names the page.
2. The folder keeps its name and its documents and nested topics, which are now its sub-pages.
   A topic with nothing in it becomes a page with no folder.
3. If a document already has the name the new page needs, the page and its folder take the next
   free name (`protein-2.md` and `protein-2/`), so nothing is overwritten.
4. `.order` is written at every level in the order the sidebar showed before — a topic's
   documents first, then its nested topics, each by file name — so the tree looks the same after
   as before, with a page where each topic was.

`format_version` becomes 2 last, so an interrupted migration leaves a library that still says
format 1 and can be converted again from its copy. The migration is tested against the frozen
`v1` fixture, and a `v2` fixture is frozen when this ships.

## Alternatives considered

**The page's text inside its folder (`protein/index.md`).** One folder per page with children,
and the page's own text inside it. Rejected because a page with no sub-pages and one with
sub-pages would be different shapes on disk, so adding the first sub-page would have to move
the page's file into a new folder — a change to the page that the person did not make, visible
to a backup as a delete and an add.

**Every page always has a folder, empty or not.** The most uniform layout. Rejected because
empty folders do not survive: the backup compares files and has nothing to copy for an empty
folder, and git and many sync tools drop them. The folder would come and go anyway, so the
format would be promising something it cannot keep.

**Keep topics, and give each one an optional overview text.** The smallest change: a
`topic.md` beside `topic.toml`. Rejected because it keeps two kinds of thing where the person
sees one, so every operation — create, move, delete, split, search — keeps two versions, and a
document still cannot have pages under it.

**Alphabetical order only.** Nothing stored; the person orders pages by naming them `1 History`.
Rejected because the order of pages is part of what a write-up says — overview, history, then
the kinds — and putting numbers in titles leaks into every citation of the page.

**`order.toml` or front matter for the order.** A `position` in each page's front matter would
make moving one page rewrite every sibling. A TOML file holds the same list with more syntax to
get wrong by hand. `.order` is the format Azure DevOps Wiki uses, which some people will know,
and is hidden in a file manager because it is not something to open.

## Consequences

- The engine's `topic_*` operations go: `document_create` takes a parent page (or none, for the
  top), `document_move` takes a parent and a position, and deleting asks what becomes of
  sub-pages. The backend contract, bindings and every check that makes a topic change with it.
- The index's topics and documents become one table of pages with a parent; search finds pages.
- Backups compare paths, so the first backup after converting shows every page as moved: copied
  to its new path and removed from its old. It warns about nothing it should not, because the
  drive's files are unchanged since the last backup. Bringing back from a format 1 copy into a
  format 2 library is refused by the existing format check, with the advice to back up first.
- Maps (M4) reference pages; there are no topics left to reference. This is the reason to do
  it **before M4**.
- An older application opening a format 2 library opens it for reading only, as the format
  already requires of a newer library.
- The user guide's words change throughout: *topic* goes from the glossary and the screens.

## Revisit if

- People make pages whose only purpose is to hold others, and leave them empty — a sign that
  folders without text were wanted after all.
- Splitting into a sub-page turns out to be undone more often than kept.
- `.order` files are found edited by hand often enough, or wrongly enough, that a format with
  more structure would have caught the mistakes.

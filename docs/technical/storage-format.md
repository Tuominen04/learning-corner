# Storage format

> **Audience:** People building Personal Learning Corner
> **Status:** In progress — M0 implemented
> **Last reviewed:** 2026-09-06

The library on disk is the source of truth ([ADR 0003](adr/0003-files-as-source-of-truth.md)).
This document specifies it. It is normative: the engine implements this, and the format is
versioned independently of the application.

## Design constraints

1. **Readable and editable by hand,** in any text editor, without this application.
2. **Diffable line by line,** so a user can keep a library under version control if they
   want, and so backup comparison can show a meaningful difference.
3. **Survives renaming.** Identity is not the file path.
4. **Survives hand-editing.** A user who breaks something should get a clear diagnostic, not
   silent data loss.
5. **No file requires another file to be understood.** Every file says what it is.

## Layout

```
MyLibrary/
├── library.toml                  # library identity and format version
├── topics/
│   └── protein/
│       ├── topic.toml
│       ├── what-protein-is.md
│       ├── types-of-protein.md
│       └── in-the-body/          # nested topic
│           ├── topic.toml
│           └── how-protein-is-used.md
├── sources/
│   ├── nieminen-2021.toml
│   └── who-protein-intake-2019.toml
├── works/
│   └── ya-vas-lyubil/
│       ├── work.toml
│       ├── original.txt
│       ├── pronunciation.txt
│       ├── translation.fi.txt
│       └── translation.en.txt
├── maps/
│   └── protein-overview.toml
├── .plc/                         # derived — safe to delete, see search-index.md
│   ├── index.sqlite
│   └── format-version
└── .conflicts/                   # copies kept from conflict resolution
```

Folders mirror the structure the user sees. A topic is a directory; a nested topic is a
nested directory; a document is a file inside one. Opening the folder in a file manager shows
the same shape as the sidebar — that is worth a lot on the day something goes wrong.

## Why TOML

Structured metadata is TOML: `library.toml`, `topic.toml`, sources, works, maps, and the
front matter block inside documents. One format throughout, so there is one parser, one set
of rules, and one thing for a user to learn if they hand-edit.

TOML over YAML specifically, for a reason this application runs into immediately: YAML's
implicit typing turns the bare token `no` into the boolean `false`. This is a
language-learning application that stores language codes, and `no` is Norwegian. A format
that silently corrupts one of our primary data values is not a candidate. TOML has no
implicit typing, no significant indentation, and a stricter grammar, all of which help a
hand-edited file fail loudly rather than quietly.

JSON is rejected for the same job because it has no comments and is unpleasant to hand-edit.

## Identifiers

Every entity carries an `id`: a [ULID](https://github.com/ulid/spec) — 26 characters,
lexicographically sortable by creation time, generated locally without coordination.

- The ID lives **in the file**, never in the filename. Filenames are human-chosen slugs and
  may be changed freely, by the application or by the user in a file manager.
- Links and citations reference IDs, so renaming never breaks them.
- Resolving an ID to a path is the [index](search-index.md)'s job, and a full scan of the
  library rebuilds that mapping — the ID→path relation is derived, never stored.

If two files carry the same ID — a user copied a document in a file manager to duplicate it —
the engine reports it as a library problem naming both files, and offers to assign a new ID to
the later one. It does not pick silently.

**The library still opens.** The first occurrence in a sorted walk wins, the rest are skipped,
and the clash appears in `library.status`. A duplicated file is a routine accident; refusing to
open the library over it would turn a copied file into a lockout.

## `library.toml`

```toml
id            = "01J8ZQ5X9K3M7P2R4T6V8W0Y1Z"
name          = "Learning"
format_version = 1
created        = 2026-09-06T10:14:00Z
```

`format_version` is the format's version, not the application's. On opening a library the
engine compares it against what it supports:

| Situation | Behaviour |
| --------- | --------- |
| Same version | Open |
| Library older | Offer to migrate. Migration writes a full copy of the library beside it first, and never edits in place |
| Library newer | Refuse to open, read-only, with a clear message. **Never** open a future-format library for writing |

## Documents

Markdown with a TOML front matter block delimited by `+++`:

```markdown
+++
id       = "01J8ZQ7B2N4Q6S8U0W2Y4A6C8E"
title    = "Types of protein"
created  = 2026-09-06T10:22:00Z
modified = 2026-09-06T11:03:00Z
+++

Complete proteins contain all nine essential amino acids.[^cite:01J8ZQ8...]

See also [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]].
```

Everything below the front matter is the user's writing, in ordinary Markdown. Two
extensions, both chosen so that a file remains readable when the syntax is not understood:

| Syntax | Means |
| ------ | ----- |
| `[^cite:<source-id>]` or `[^cite:<source-id>@44-46]` | A citation, optionally with a locator (page, chapter, timestamp) |
| `[[<document-id>]]` | A link to another document |

Rendering a citation into APA 7 form is done at display and export time from the source
record, never stored in the document. A source corrected once is correct everywhere it is
cited — see [Citation model](citation-model.md).

**Backlinks are derived.** No file records what points at it; that relation is computed by
scanning `[[…]]` references into the index.

## Sources

One file per source in `sources/`, named from a slug of author and year.

```toml
id      = "01J8ZQ8D4Q6S8U0W2Y4A6C8E0G"
type    = "journal-article"
title   = "Protein requirements in adults"
year    = 2021
authors = [ { family = "Nieminen", given = "A." } ]
container = "Journal of Nutrition"
volume  = "151"
issue   = "4"
pages   = "612-620"
doi     = "10.1000/example"

[appraisal]
trust = "high"
note  = "Peer reviewed, replicated by Kim et al."
```

`type` selects which fields APA 7 requires; the full per-type field list is in
[Citation model](citation-model.md). Missing required fields make the source *incomplete* —
stored, citable, and reported — never silently defaulted or invented.

## Works and editions

`work.toml` describes the text and lists its editions; each edition is a plain `.txt` file.

```toml
id    = "01J8ZQA1B2C3D4E5F6G7H8J9K0"
title = "Я вас любил"
unit  = "line"            # line | sentence | paragraph

[[editions]]
file = "original.txt"
kind = "original"
language = "ru"

[[editions]]
file = "pronunciation.txt"
kind = "pronunciation"
language = "ru"
scheme = "bgn-pcgn"

[[editions]]
file = "translation.fi.txt"
kind = "translation"
language = "fi"
```

Edition files are the text itself, one segment per line — deliberately plain, so that a
translation can be pasted in and read by anything:

```
Я вас любил: любовь ещё, быть может,
В душе моей угасла не совсем;
```

Alignment is by line number, with two markers for the cases where texts do not correspond
one-to-one:

| Marker | Means |
| ------ | ----- |
| A line containing only `~` | This edition has nothing for this segment |
| A line beginning `+ ` | Continues the previous segment rather than starting a new one |

Blank lines are ignored. If two editions have different segment counts after applying these
rules, the engine reports a misalignment naming the first line where they diverge, and shows
the text unaligned from that point. It does **not** silently re-pair lines: a wrong alignment
that looks right is worse than a visible error. The reasoning is in
[Parallel text model](parallel-text-model.md).

## Maps

A map stores only its arrangement: which entities are on it, where the user put them, and the
edges the user drew by hand. Edges derived from `[[…]]` links are not stored — they are
recomputed, so a map cannot go stale.

## Writing files

Every write is: create a temporary file in the **same directory**, write, `fsync`, rename over
the target, `fsync` the directory. Same-directory rename is atomic on the filesystems Fedora
uses, so a crash or a pulled power cable leaves either the previous complete file or the new
complete file — never a truncated one.

Multi-file operations are not atomic as a group, and are not pretended to be. They are ordered
so that an interruption leaves the library valid but incomplete rather than invalid: entities
are written before the references to them.

## Reserved names

`.plc/` and `.conflicts/` are the application's. Everything else in the library belongs to
the user, and the engine does not delete anything outside those two directories without an
explicit user action.

## Related

- [Search index](search-index.md) — what is derived from all this
- [Citation model](citation-model.md) — source types and their required fields
- [Parallel text model](parallel-text-model.md) — segmentation and alignment
- [Backup and synchronisation](backup-and-sync.md) — how two copies are compared

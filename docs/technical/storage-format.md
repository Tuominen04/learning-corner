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
│   ├── who-protein-intake-2019.toml
│   └── files/                    # the library's own copies of source PDFs
│       └── nieminen-2021.pdf
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

- The ID lives **in the file**, never in the filename. Filenames are slugs and may be changed
  freely, by the application or by the user in a file manager.
- A name **follows what it holds**: renaming a document renames its `.md`, and renaming a
  topic renames its folder. Free to do precisely because the ID is not in the name — and worth
  doing, because a folder of `untitled-2.md` keeps the letter of files-as-source-of-truth
  while losing the point of it. See [ADR 0003](adr/0003-files-as-source-of-truth.md).
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
id       = "01J8ZQ7B2N4Q6S8W0W2Y4A6C8E"
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
| `[^cite:<source-id>]` | A citation of a source |
| `[[<document-id>]]` | A link to another document |

Ordinary Markdown means ordinary Markdown: `# Heading` is a heading and
`![Diagram](diagram.png)` is a picture, in this application and in every other reader of the
file. Which of it the editor *renders* is a separate question, decided by whether a construct
can be written back character for character — see
[What the editor renders](#what-the-editor-renders).

### Pictures

A picture lives **beside the document that shows it**, in the same folder, and the body names
it by a bare filename:

```
topics/protein/
  what-protein-is.md      ![Amino acid diagram](amino-acid-diagram.png)
  amino-acid-diagram.png
```

Beside rather than in a folder of its own, because that is what makes the `.md` show its
pictures everywhere else: a Markdown viewer, a text editor's preview, a forge, a static site
generator. A library-wide `images/` folder would be tidier to look at and would leave every
document's pictures broken outside this application.

Three rules follow from the file being the source of truth:

**The name is a name, never a path.** A body is plain text somebody may type anything into, so
`![x](../../elsewhere.png)` is not followed out of the folder. The reference is simply broken,
which is visible and harmless.

**A document takes its pictures with it.** Moving a document to another topic moves the files
its body names, so the bare names keep working and the body needs no rewriting.

**A name is made unique when the picture is filed.** Two pictures both called `diagram.png` are
two pictures; the second is stored under a name of its own rather than landing on the first.

Pictures are copied into the library, never referenced where they were found — so the
downloads folder they came from can be emptied afterwards. Whether the original is left alone
or taken away is the user's choice at the time, exactly as it is for a source's PDF.

### What a citation can say

A citation names a source, and may also say **where** in it and **how** the sentence uses it.

| Written | Renders as |
| ------- | ---------- |
| `[^cite:<id>]` | `(Nieminen, 2021)` |
| `[^cite:<id>@44]` | `(Nieminen, 2021, p. 44)` |
| `[^cite:<id>@44-46]` | `(Nieminen, 2021, pp. 44–46)` |
| `[^cite:<id>@para:7]` | `(Nieminen, 2021, para. 7)` |
| `[^cite:<id>@chapter:3]` | `(Nieminen, 2021, Chapter 3)` |
| `[^cite:<id>@time:1:04:22]` | `(Nieminen, 2021, 1:04:22)` |
| `[^cite:<id>!narrative]` | `Nieminen (2021)` |
| `[^cite:<id>@44!narrative]` | `Nieminen (2021, p. 44)` |

Three rules decide the shape, and each one is paying for something:

**A page is written bare.** It is what almost every citation carries, and it is what this
format already meant by `@44-46` before locator kinds existed. Every file written before the
syntax grew reads identically afterwards — no migration and no `format_version` change.

**Parenthetical is never written.** It is the default. Writing it out would add five redundant
characters to the great majority of citations in every document.

**Exactly one spelling per value.** `@page:44` is refused rather than accepted as a synonym for
`@44`. Two spellings for one value means a document cannot be opened and saved without its
bytes changing, and that guarantee is worth more than the convenience of a second spelling.

A locator kind nobody recognises — `@section:2` — stays ordinary text rather than being read as
a page. Citing a chapter as though it were a page number is wrong output; unrecognised text is
merely unrecognised, and the person can see it and fix it.

Rendering a citation into APA 7 form is done at display and export time from the source
record, never stored in the document. A source corrected once is correct everywhere it is
cited — see [Citation model](citation-model.md).

**Backlinks are derived.** No file records what points at it; that relation is computed by
scanning `[[…]]` references into the index.

### What the editor renders

A document opened and saved without being touched must produce **byte-identical** text. That
single requirement decides which Markdown the editor draws, and it is a stricter test than
"can we display it":

| Construct | Rendered | Why |
| --------- | -------- | --- |
| Paragraphs, `[^cite:…]`, `[[…]]` | Yes | One spelling each |
| `# ` to `###### ` | Yes | ATX has one spelling; the editor writes back exactly the hashes it read |
| `![alt](name)` | Yes | One spelling, and the name is a slug the engine chose |
| Setext headings (`===` underlines) | No | A second spelling of `# `, so reading one and writing the other would rewrite the file |
| `*a*`, `_a_` | No | Two spellings of emphasis |
| Lists | No | Four spellings of a bullet, and indentation that is not free to normalise |

Everything in the "no" column is still **kept perfectly**. It stays literal text in the editor,
survives every save untouched, and renders correctly in any Markdown reader. The editor not
drawing something is not the file losing it — and that is the trade the rule is protecting.

Anything malformed is treated the same way. `#Heading` with no space is not a heading in any
reader, and `![Diagram](my file.png)` is a name this editor could not write back, so both stay
text rather than being guessed at.

## Sources

One file per source in `sources/`, named from a slug of author and year.

A source may also carry **the paper itself**. The file is copied into `sources/files/` and
named after the source's own record, so a folder listing pairs `nieminen-2021.toml` with
`nieminen-2021.pdf` by eye. What the record holds is a filename:

```toml
file = "nieminen-2021.pdf"
```

**A filename, never a path.** A library has to survive being moved to another disk or another
computer, and recording where the PDF sat on one machine would break that on the first move.
The name is also treated as a name when it is read back: a hand-edited record naming
`../../../elsewhere.pdf` resolves to nothing rather than reaching outside the library.

**Brought in, not referenced.** That is the whole point of the field — the original can be gone
afterwards and the source still has its paper. The copy goes through the same temp-fsync-rename
sequence as every other write here, so an interrupted copy leaves the previous file or the new
one and never half a PDF.

The caller chooses what becomes of the original: **copy** leaves it alone, **move** removes it
once the library's copy is written, recorded and indexed — never before, since removing it any
earlier risks taking away the only one anybody can find. A removal that fails is not a failed
attach: the outcome is then exactly *copy*, and nothing has been lost.

Deleting a source deletes its copy. Attaching a second one replaces the first. Only PDFs are
accepted today, checked by extension *and* by content, because a renamed `.docx` carries a
`.pdf` extension just as well.

```toml
id = "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G"
type = "journal-article"
title = "Protein requirements in adults"
container = "Journal of Nutrition"
volume = "151"
issue = "4"
pages = "612-620"
doi = "10.1000/example"

[date]
year = 2021

[[contributors]]
role = "author"
family = "Nieminen"
given = "Anna Maria"

[appraisal]
trust = "high"
note = "Peer reviewed, replicated by Kim et al."
```

`type` selects which fields APA 7 requires; the full per-type field list is in
[Citation model](citation-model.md). Missing required fields make the source *incomplete* —
stored, citable, and reported — never silently defaulted or invented.

### Contributors

One `[[contributors]]` block each, in the order they are credited. A `role` is always present:
`author`, `editor`, `translator`, `director` or `host`, because who did what to a thing changes
how it is cited.

A person is `family` plus `given`. A name that is not two Western parts — an organisation, or
simply a name that does not split that way — is a single `literal`, optionally with the
`abbreviation` it is known by after first use:

```toml
[[contributors]]
role = "author"
literal = "World Health Organization"
abbreviation = "WHO"
```

Assuming every name in the world decomposes into two parts is a bug, not a simplification, so
both shapes are first-class and neither is derived from the other.

### Dates

A date is one of three things, and `no-date` is a **value** rather than a missing field — APA 7
prints `n.d.` for it, which an absent field could not express:

```toml
date = "no-date"          # the year is genuinely unknown

[date]
year = 2021               # a year is all that is needed

[date]
full = [2021, 3, 4]       # year, month, day — where the day matters
```

`retrieved` takes the same three shapes, and appears only where content is designed to change
and is not archived — not on every web page.

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

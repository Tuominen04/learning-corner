# Search index

> **Audience:** People building Personal Learning Corner
> **Status:** Planned
> **Last reviewed:** 2026-09-06

A SQLite database at `.plc/index.sqlite` inside the library. It is a **cache**. Everything in
it is derived from the library files, and deleting it must never lose anything.

## The rule

> Anything in the index that cannot be recomputed from the library files is a bug.

Concretely, this means the index is allowed to hold:

- extracted text for full-text search
- resolved identifier → path mappings
- backlinks, derived from `[[…]]` references
- citation → source relations, derived from `[^cite:…]` references
- computed titles, counts, incompleteness flags, modification times

and is **not** allowed to hold anything the user typed that is not also in a file. No
"just this one setting", no draft state, no map positions. Map positions are user data and
live in the map file ([Storage format](storage-format.md#maps)).

The test that keeps this honest is in [Testing](testing.md): delete the index, rebuild it, and
assert that every engine read returns exactly what it returned before.

## Why a derived index at all

Without one, every search is a full scan of the library and every backlink lookup reads every
document. With one, [the stack's performance constraints](stack.md#constraints-these-choices-must-keep-satisfying)
are reachable on a library of ten thousand documents.

Why not make it authoritative, since it is there? Because a binary database as the source of
truth costs the things this product is for: backups become opaque blobs instead of readable
folders, partial restore becomes impossible, hand-editing becomes impossible, and the
file-by-file conflict comparison in [Backup and synchronisation](backup-and-sync.md) has
nothing to compare. See [ADR 0003](adr/0003-files-as-source-of-truth.md).

## Contents

| Table | Holds |
| ----- | ----- |
| `entity` | id, kind, path, title, modified, content digest |
| `entity_fts` | full-text index over document text, source fields, and work editions |
| `link` | from-entity, to-entity, derived from `[[…]]` |
| `citation` | document, source, locator, position, derived from `[^cite:…]` |
| `problem` | incomplete sources, misaligned works, duplicate identifiers, unresolved citations |
| `meta` | index format version, the library format version it was built from, last full scan |

Full-text search uses SQLite's FTS5 with the `unicode61` tokeniser and diacritic folding —
non-negotiable for an application whose users search Finnish and Russian text.

## Staying current

- **On write.** Every engine write updates the affected rows in the same operation. The index
  is never behind after a write the application made.
- **On external change.** The engine watches the library folder. A changed file is re-read
  and its rows refreshed.
- **On open.** A quick pass comparing recorded modification times and sizes against the
  filesystem catches anything changed while the application was closed.
- **On demand.** `library.rebuildIndex` discards and rebuilds from scratch.

## Rebuilding

Triggered when the index is missing, when its format version is unrecognised, when the
library's format version has changed, when a consistency check fails, or when the user asks.

It is a full scan: read every file, parse the front matter, extract text, resolve references,
write rows. Progress is reported through `indexProgress`
([Engine contract](backend-contract.md#events)), because on a large library it is long enough
that a frozen window would look like a crash.

A rebuild writes to a new file and renames it into place, so an interrupted rebuild leaves the
previous index intact rather than a half-built one.

## Corruption

Assume it will happen — a drive with a bad sector, a process killed at the wrong moment, a
library folder copied while open.

Detection is a `PRAGMA integrity_check` on open plus the version check in `meta`. The response
is always the same and never involves asking the user: log it, delete the index, rebuild.
There is nothing to salvage, by construction, and that is exactly the property this design was
chosen for.

## Related

- [Storage format](storage-format.md) — what the index is derived from
- [ADR 0003](adr/0003-files-as-source-of-truth.md) — the decision
- [Testing](testing.md) — the rebuild-equivalence test

# ADR 0003 · Files are the source of truth; the index is derived

> **Audience:** People building Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-09-06

## Context

The application needs full-text search, backlinks, and identifier resolution across a library
that may hold tens of thousands of documents. That needs an index. The question is whether the
index is authoritative or derived.

The original project notes are unambiguous about what the user's storage is for: files saved
locally, backed up to a drive the user chooses, with the user deciding which copy is right
when the two disagree. Every part of that requirement constrains this decision.

## Decision

The library's files are the only source of truth. The SQLite index at `.plc/index.sqlite` is a
cache: everything in it is derived from the files, deleting it loses nothing, and it can be
rebuilt from a full scan. Nothing the user typed is stored only in the index.

## Alternatives considered

**SQLite as the source of truth, with export to files on demand.** Faster queries,
transactional multi-entity edits, no parsing on load, and no class of bugs where a file and
the index disagree. A conventional choice, and for many applications the right one.

Rejected because it costs four things this product is specifically for:

1. **Backups become opaque.** The user's backup would be a binary file. They could not read
   their own work from the drive without a working installation — which is exactly the day
   they need it most.
2. **Partial restore becomes impossible.** Recovering one document out of a database means
   restoring the whole database over the current one.
3. **Hand-editing becomes impossible.** The
   [user documentation promises it](../../user/libraries-and-files.md#editing-your-files-outside-the-app),
   and it is a real part of the "your library outlives the application" principle.
4. **The conflict model loses its subject.** The
   [three-outcome comparison](../backup-and-sync.md#the-three-outcomes) works file by file and
   shows the user a readable difference. Against two binary databases, the only honest report
   is "these differ", and the only resolution is all-or-nothing — precisely the automatic
   guess the user asked not to have.

**Files only, no index.** Simplest, and fine at a few hundred documents. Rejected because
search and backlinks would then be a full scan, which fails the
[performance constraints](../stack.md#constraints-these-choices-must-keep-satisfying) at the
scale the product is meant to reach.

## Consequences

**Easier.** Backups are readable folders. Restore is a copy. Conflicts are line diffs. A
corrupt index is never a data-loss event — it is deleted and rebuilt, with nothing to salvage
by construction. The user can hand-edit, and can put a library under version control if they
want.

**Harder.** Every write goes to a file and then to the index, so they can disagree if a write
path is written carelessly. Startup pays a consistency check. A full rebuild on a large library
is slow enough to need progress reporting. Multi-entity operations cannot be transactional
across files, so they are ordered to fail safe instead
([Storage format](../storage-format.md#writing-files)).

**Enforced by.** The rebuild-equivalence test in [Testing](../testing.md), from M0 rather than
later. Adding it after the fact means discovering everything that already violates it.

## Revisit if

The rebuild-equivalence test starts needing exceptions. That is the signal that something
authoritative has moved into the index, and the decision either has to be re-argued or the
code corrected.

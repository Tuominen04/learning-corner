# Backup and synchronisation

> **Audience:** People building Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-10-29

The library lives on the user's computer, and that copy is the one they work in. A backup is a
copy of it on a drive they chose. This document is the rules for keeping the two in step: what
is copied, when the user is asked, and what is kept so that nothing becomes unrecoverable.

## The model: the library leads, the drive follows

There are two actions, and each copies in one direction:

| Action | Direction | What it does |
| ------ | --------- | ------------ |
| **Back up** | library → drive | The drive becomes exactly like the library |
| **Bring back** | drive → library | Changes made on the drive come into the library |

The ordinary case is only ever *back up*: work on the computer, back up to the drive, repeat.
*Bring back* is for the occasional detour — the library opened from the drive on another
computer, to show somebody or to work away from home, with a few changes made there. The user
brings those changes back, then carries on as before.

*Restore* — onto a new computer, after a disaster — is *bring back* into an empty folder: the
whole drive is copied in.

This is not synchronisation between equals, and not version control. There is no merging and
no history of who changed what. The library is the master; the drive is its copy, which can
occasionally carry changes home.

## What a backup is

A **mirror** of the library onto a destination the user chose: the same folders, the same
files, readable without this application. Not an archive, not a container, not a delta chain.

The reason is the day it is needed. A backup you can only restore with a working copy of the
application is worthless precisely when the application will not start. A mirror is restorable
by copying a folder.

`.plc/` is excluded — it is derived ([Search index](search-index.md)) and rebuilding it is
faster than copying it. `.conflicts/` is included, because those are copies of the user's work.
The notes a file manager leaves in a folder it has shown (`.directory`, `.DS_Store`,
`Thumbs.db`, `desktop.ini`) are excluded too: they describe how one computer displayed the
folder, and differ between computers for no reason anyone would want to hear about. So are the
temporary files a write in progress leaves (`.<name>.<id>.tmp`), which the next run removes.

### Which drive is which

A library can be backed up to more than one place — two drives, one kept elsewhere, is the
advice the [user guide](../user/backup-and-restore.md#how-often) gives. Each place is a **copy**,
and each copy has its own identity:

- On the first backup to a destination, the engine writes `.plc/backup.toml` **in the
  destination**, holding a fresh `copy` identifier. It lives under `.plc/`, so it is never
  compared and never travels back.
- The library keeps a record of each copy as of its last backup or bring-back, in
  `.plc/sync-state/<copy>.toml`: the digest of every file the two last had in common.

That record is what lets the engine tell *the drive is just older* from *something was changed
on the drive* — without it, every file on a months-old drive would look like a change.

A destination is accepted only if it is **empty**, or holds **a copy of this same library** (its
`library.toml` names the same library `id`). A folder holding a different library, or holding
anything else at all, is refused. A backup never mixes a library into somebody's own folder or
into another library.

## Comparison

Each run begins by comparing the library and the drive file by file:

- the **content digest** (BLAKE3 — fast enough to hash a whole library on every run),
- the **modification time**, shown to the user, never used to decide — clocks disagree between
  machines, and copying a file changes its time — and
- the **recorded digest** from the last run with this copy.

Two files with the same digest are the same file. They are never reported, and the run records
them, so a second run after an interrupted one skips them.

For each path, with **L** and **D** the digests in the library and on the drive (or absent) and
**R** the recorded digest (or none):

| Library | Drive | Recorded | Outcome |
| ------- | ----- | -------- | ------- |
| L | D = L | — | Unchanged |
| L | absent | none | **New in the library** |
| absent | D | none | **New on the drive** |
| L | D | R = D | **Changed in the library** |
| L | D | R = L | **Changed on the drive** |
| L | D | neither, or none | **Changed in both** |
| L | absent | R = L | **Removed on the drive** |
| L | absent | R ≠ L | **Removed on the drive, changed in the library** |
| absent | D | R = D | **Removed in the library** |
| absent | D | R ≠ D | **Removed in the library, changed on the drive** |

Every outcome that involves the drive's own change — the drive's file differs from the record,
or there is no record — is a **change on the drive**. Those are the ones that matter, and the
only ones the user is ever asked about.

A drive with no record (a new drive, or one whose `.plc/` was deleted) has no way to tell old
from changed, so every file on it that differs counts as a change on the drive. That is the
conservative direction: one question, not a lost change.

## Back up

The drive is made exactly like the library: new and changed files are copied to it, and files
the library no longer has are removed from it. The user sees the totals — *142 new, 8 changed,
3 removed* — and confirms. There is no question per file.

**One safety net.** If the drive holds changes on the drive, the backup says so before
anything is written — *the drive has 2 changes made since your last backup* — with the files
named, and offers two answers:

- **Bring them back first** — nothing is written; the user runs *bring back*, then backs up.
- **Overwrite them** — the backup goes ahead, and the drive's versions of those files are kept
  in the library's `.conflicts/`.

It is one question for the whole backup, however many files it covers. Forgetting to bring
changes home before the next backup is the mistake it exists to catch.

A months-old drive with no changes of its own is therefore the simple case: *back up*, confirm,
and the drive is the library again. Nothing is kept aside, because nothing on it is anything the
library has not already had.

## Bring back

Changes on the drive come into the library: files new or changed on the drive are copied in,
and files removed on the drive are removed from the library. Changes made only in the library
are left alone — they go to the drive on the next backup.

Where **the same file changed in both** — on the drive and in the library since the last run —
the user is asked, one file at a time, showing what it is, when each side changed, and a
difference of the content (readable because the storage format is
[line-diffable by design](storage-format.md#design-constraints)):

| Answer | Result |
| ------ | ------ |
| **Keep mine** | The library's version stays; the drive's goes to the next backup as usual |
| **Take the drive's** | The drive's version replaces the library's |
| **Keep both** | The drive's version is saved beside the library's as `<name> (from backup YYYY-MM-DD).<ext>` |

If the user follows the routine — bring back, then work — this almost never happens.

Bringing back into an **empty** folder is a restore: every file is new on the drive and is
copied. Bringing back into an existing folder is allowed only when it holds the same library.

A bring-back updates the record for that copy, so the next backup from this computer — or from a
new one the library was restored onto — sees the drive as up to date, not as a wall of changes.

## What is kept

Every version a backup or bring-back replaces or removes **in the library** is kept first under
`.conflicts/<timestamp>/<original path>` in the library — as is every version of a **change on
the drive** that a backup overwrites. Versions on the drive that are merely older than the
library are not kept: the library already has everything they held.

Retained copies are never deleted automatically. They are backed up with everything else; the
user is told how much space they use and can clear them.

Three promises hold in every case:

1. **Nothing the user made is lost without a decision.** A change that exists in only one place
   is never overwritten or removed without the user having been shown it and having chosen.
2. **The library is the default.** Cancelling or closing at any point before confirming leaves
   both sides untouched. During a run, every library file is either as it was or as the user
   chose — never half of each — so losing the drive midway costs nothing in the library.
3. **A run is resumable.** The record is updated after **each** file. Interrupted, the drive is
   left partly updated and the library intact; running again starts from a fresh comparison,
   and files already in step are skipped.

## Two-phase, without exception

`backup.plan` and `restore.plan` compute and return the full picture. `backup.apply` and
`restore.apply` take that plan plus the user's answers.

The plan is what the user is shown. There is no single-call path, no "quick backup" that skips
it, and no scheduled or background run. Backups that happen without the user noticing also go
wrong without the user noticing.

Between plan and apply, either side may have changed — a drive can be swapped, a document
saved. The apply step re-checks **both** digests of each file against the plan before touching
it, and stops with `Conflict` on any surprise rather than act on a stale plan. What it had
already done stays done and recorded; planning again shows only what is left.

An apply must carry every answer the plan asks for. A missing one is `Invalid`, and nothing is
written: the engine never fills in an answer the user did not give.

## Format versions

A drive can hold a library older than the application. The
[format version check](storage-format.md#librarytoml) applies exactly as it does on open, at
**plan** time, before anything is written: a copy written by a newer version is refused with
`FormatTooNew`, and an older one is `MigrationRequired`, migrated with the pre-migration copy
kept. Format 1 is the only format so far, so there is nothing yet to migrate; the check is in
place for the day there is. Restoring a two-year-old backup into a current build must work, and
[Testing](testing.md) covers it with real fixtures.

## What this is not

Not synchronisation, and not version control. There is no automatic reconciliation, no
background daemon, no merging of edits within a file. Working on two computers is supported
through the drive — bring back before starting, back up before leaving — and the documentation
[says so plainly to the user](../user/backup-and-restore.md#two-computers) rather than
implying more.

Users are also told not to place a library inside a cloud sync folder. Those tools resolve
conflicts by their own rules, silently, on files they assume only one program writes —
precisely the decision this design exists to keep with the user.

## Related

- [Storage format](storage-format.md) — what is being compared
- [Engine contract](backend-contract.md#backup) — the operations
- [Backup and restore](../user/backup-and-restore.md) — what the user sees

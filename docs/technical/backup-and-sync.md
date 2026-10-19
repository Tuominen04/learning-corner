# Backup and synchronisation

> **Audience:** People building Learning Corner
> **Status:** Planned
> **Last reviewed:** 2026-10-19

The user's README stated the requirement plainly: *importing must confirm whether the source
of truth is correct — local or external — defaulting to local.* This document turns that into
rules an implementation can be held to.

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
folder, and differ between computers for no reason anyone would want to be asked about. So are
the temporary files a write in progress leaves (`.<name>.<id>.tmp`), which the next apply
removes.

### Which copy is which

A library can be backed up to more than one place — two drives, one kept elsewhere, is the
advice the [user guide](../user/backup-and-restore.md#how-often) gives. Each place is a **copy**,
and each copy has its own identity:

- On the first backup to a destination, the engine writes `.plc/backup.toml` **in the
  destination**, holding a fresh `copy` identifier. It lives under `.plc/`, so it is never
  compared and never travels back.
- The local library keeps what it last agreed with each copy separately, in
  `.plc/sync-state/<copy>.toml`.

A copy whose `backup.toml` is missing — a new drive, or one whose `.plc/` somebody deleted — has
no last-agreed state, so every file that differs is a conflict: noisy, and correct.

A destination is accepted only if it is **empty**, or holds **a copy of this same library** (its
`library.toml` names the same library `id`). A folder holding a different library, or holding
anything else at all, is refused. Merging two libraries, or a library into somebody's own
folder, is never what a backup was asked to do.

## Comparison

Every operation begins by comparing the two copies file by file. Three inputs per file:

- the **content digest** (BLAKE3 — fast enough to hash a whole library on every run),
- the **modification time**, used for reporting, never for deciding, and
- the **last-agreed digest** from the previous run with this copy, recorded per file in
  `.plc/sync-state/<copy>.toml`.

The last-agreed digest is what makes a three-way comparison possible, and a three-way
comparison is what separates *changed here* from *changed there* from *both changed*. Without
it, all you can say is "these two files differ", and the only honest response to that is to
ask about every file — which trains the user to click through the questions, which is how work
gets lost.

Modification times are reported to the user because they help a human decide. They are never
used to decide automatically: clocks disagree between machines, filesystems round differently,
and copying a file changes its time.

`.plc/sync-state/` is derived like everything else in `.plc/`. If it is missing, every
differing file is reported as a conflict — correct, conservative, and noisy, which is the
right failure direction.

Two files with the same digest are the same file, whatever the last-agreed state says. They are
never reported, and the apply step records them as agreed, so a second run after an
interrupted one skips them.

## The outcomes

For each path, *here* is the library being worked on and *there* is the copy. With **H** and
**T** the digests on each side (or absent) and **A** the last-agreed digest (or none), every
case is exactly one row:

| Here | There | Last agreed | Outcome |
| ---- | ----- | ----------- | ------- |
| H | T = H | — | Unchanged |
| H | absent | none | **New here** |
| absent | T | none | **New there** |
| H | T | A = T | **Changed here** |
| H | T | A = H | **Changed there** |
| H | T | neither, or none | **Conflict** |
| H | absent | A = H | **Deleted there** |
| H | absent | A ≠ H | **Deleted there, changed here** — a conflict |
| absent | T | A = T | **Deleted here** |
| absent | T | A ≠ T | **Deleted here, changed there** — a conflict |

What happens to each depends on which way the copy runs. The side being copied **from** is the
*source* — the library on a backup, the copy on a restore — and the rule is the same both ways:

| Outcome, seen from the source | Action |
| ----------------------------- | ------ |
| New on the source | Copied, without asking |
| Changed on the source only | Copied, without asking |
| Unchanged | Nothing |
| **Anything else** | **Asked** |

So on a backup, *changed there* is a question rather than an automatic copy: files changing on
the backup drive without the user knowing is unusual enough to be worth mentioning. A deletion
on either side is always a question, never something copied silently.

A topic renamed or moved is a set of files deleted at their old paths and new at their new
ones. The interface may ask about such a group as one question; the plan still carries a
decision per file.

## Conflict resolution

Presented one file at a time, showing what it is, when each side changed, and a difference of
the content — which is readable because the storage format is
[line-diffable by design](storage-format.md#design-constraints).

Three choices, the same in both directions and for every question, whatever its outcome:

| Decision | Leaves both sides holding |
| -------- | ------------------------- |
| **Keep local** | the local version — copied to the other side, or removed there if local has none |
| **Take the copy's** | the copy's version — copied in, or removed locally if the copy has none |
| **Keep both** | both versions, side by side — offered only when both sides have the file |

Four promises, which hold in every case and are what the whole design is for:

1. **Nothing is overwritten without an explicit decision.** Where intent cannot be determined,
   the operation stops and asks. It never guesses.
2. **The rejected copy is retained** under `.conflicts/<timestamp>/<original path>` in the
   **local library**, whichever side it came from — and so is any version a decision replaces
   or removes, a confirmed deletion included. One place to look, and it is backed up with
   everything else. Retained copies are never deleted automatically; the user is told how
   much space they use and can clear them.
3. **Local is the default.** Cancelling or closing the window at any point before the apply
   leaves the local library untouched. During an apply, the local library is only ever written
   where the user decided it should be — every local file is either as it was or as they
   chose, never half of each, with the version it replaced kept — so losing the drive midway
   costs nothing local. This is the user's stated requirement, and it is the right default
   independently: local is where they were working, and it is the copy whose loss they would
   notice.
4. **The operation is resumable.** Interrupting it leaves a partially-updated destination and
   a valid source. The last-agreed state is updated after **each** file, so running it again
   picks up from the comparison, and files already agreed are skipped.

`keep both` writes the copy's file alongside the local one as
`<name> (from backup YYYY-MM-DD).<ext>`, keeps both in the library, and copies both out. It exists because the honest answer to "which of these two is right" is
sometimes "parts of each", and a tool that forces a choice there will be answered wrongly.

## Two-phase, without exception

`backup.plan` and `restore.plan` compute and return the full picture. `backup.apply` and
`restore.apply` take that plan plus a decision for every conflict.

The plan is what the user is shown. There is no single-call path, no "quick backup" that skips
it, and no scheduled or background run. Backups that happen without the user noticing also go
wrong without the user noticing.

Between plan and apply, either side may have changed — a drive can be swapped, a document
saved. The apply step re-verifies **both** digests of each file against the plan before
touching it, and stops with `Conflict` on any surprise rather than proceeding on a stale plan.
What it had already done stays done and agreed; planning again shows only what is left.

An apply must carry a decision for every question in the plan. A missing one is `Invalid`, and
nothing is written: the engine never fills in an answer the user did not give.

## Restore

The same machinery in the other direction, with the same outcomes and the same promises.
Restoring into an **empty** folder is the simple case: every file is new on the source, and is
copied. Restoring **over** an existing library is a full comparison, allowed only when it is the
same library, and the default the interface offers flips — the incoming copy is what the user
asked for — but any local file that changed is still asked about.

A restore records the copy it came from in the restored library's own
`.plc/sync-state/<copy>.toml`. The first backup from the new computer to that drive is then a
three-way comparison, not a wall of conflicts.

## Format versions across a restore

A backup can be older than the application restoring it. The
[format version check](storage-format.md#librarytoml) applies exactly as it does on open, and
at **plan** time, before anything is written: a copy written by a newer version is refused with
`FormatTooNew`, and an older one is `MigrationRequired`, migrated with the pre-migration copy
kept. Format 1 is the only format so far, so there is nothing yet to migrate; the check is in
place for the day there is. Restoring a two-year-old backup into a current build is a case that must
work, and [Testing](testing.md) covers it with real fixtures.

## What this is not

Not synchronisation. There is no automatic reconciliation, no background daemon, no merge of
concurrent edits within a file. Two machines are supported through deliberate, reviewed copies
via a drive, and the documentation
[says so plainly to the user](../user/backup-and-restore.md#two-computers) rather than
implying more.

Users are also told not to place a library inside a cloud sync folder. Those tools resolve
conflicts by their own rules, silently, on files they assume only one program writes —
precisely the decision this design exists to keep with the user.

## Related

- [Storage format](storage-format.md) — what is being compared
- [Engine contract](backend-contract.md#backup) — the operations
- [Backup and restore](../user/backup-and-restore.md) — what the user sees

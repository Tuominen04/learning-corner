# Backup and synchronisation

> **Audience:** People building Learning Corner
> **Status:** Planned
> **Last reviewed:** 2026-09-06

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

## Comparison

Every operation begins by comparing the two copies file by file. Three inputs per file:

- the **content digest** (BLAKE3 — fast enough to hash a whole library on every run),
- the **modification time**, used for reporting, never for deciding, and
- the **last-agreed digest** from the previous run, recorded per file in `.plc/sync-state`.

The last-agreed digest is what makes a three-way comparison possible, and a three-way
comparison is what separates *changed here* from *changed there* from *both changed*. Without
it, all you can say is "these two files differ", and the only honest response to that is to
ask about every file — which trains the user to click through the questions, which is how work
gets lost.

Modification times are reported to the user because they help a human decide. They are never
used to decide automatically: clocks disagree between machines, filesystems round differently,
and copying a file changes its time.

`.plc/sync-state` is derived like everything else in `.plc/`. If it is missing, every
differing file is reported as a conflict — correct, conservative, and noisy, which is the
right failure direction.

## The three outcomes

| Digest here | Digest there | vs. last agreed | Outcome | Action |
| ----------- | ------------ | --------------- | ------- | ------ |
| present | absent | — | **New here** | Copy out |
| absent | present | matches last agreed | **Deleted here** | Ask before deleting there |
| absent | present | differs | **Deleted here, changed there** | Conflict |
| changed | unchanged | — | **Changed here** | Copy out |
| unchanged | changed | — | **Changed there** | Ask before bringing in |
| changed | changed | both differ | **Conflict** | Ask, always |
| equal | equal | — | Unchanged | Nothing |

Note that *changed there* is a question rather than an automatic copy. Files changing on the
backup drive without the user knowing is unusual enough to be worth mentioning.

## Conflict resolution

Presented one file at a time, showing what it is, when each side changed, and a difference of
the content — which is readable because the storage format is
[line-diffable by design](storage-format.md#design-constraints).

Three choices: **keep local**, **take external**, **keep both**.

Four promises, which hold in every case and are what the whole design is for:

1. **Nothing is overwritten without an explicit decision.** Where intent cannot be determined,
   the operation stops and asks. It never guesses.
2. **The rejected copy is retained** under `.conflicts/<timestamp>/<original path>`, whichever
   side it came from. Retained copies are never deleted automatically; the user is told how
   much space they use and can clear them.
3. **Local is the default.** Cancelling, closing the window, or losing the drive mid-operation
   leaves the local library untouched. This is the user's stated requirement, and it is the
   right default independently: local is where they were working, and it is the copy whose
   loss they would notice.
4. **The operation is resumable.** Interrupting it leaves a partially-updated destination and
   a valid source. Running it again picks up from the comparison, and files already agreed are
   skipped.

`keep both` writes the incoming file alongside the local one under a suffixed name and keeps
both in the library. It exists because the honest answer to "which of these two is right" is
sometimes "parts of each", and a tool that forces a choice there will be answered wrongly.

## Two-phase, without exception

`backup.plan` and `restore.plan` compute and return the full picture. `backup.apply` and
`restore.apply` take that plan plus a decision for every conflict.

The plan is what the user is shown. There is no single-call path, no "quick backup" that skips
it, and no scheduled or background run. Backups that happen without the user noticing also go
wrong without the user noticing.

Between plan and apply, the destination may have changed — a drive can be swapped. The apply
step re-verifies each file's digest against the plan and stops on any surprise rather than
proceeding on a stale plan.

## Restore

The same machinery in the other direction, with the same three outcomes and the same
promises, plus one addition: restoring into a folder that is **not** a library is the simple
case and copies everything. Restoring **over** an existing library is a full conflict
comparison, and the default flips — the incoming copy is what the user asked for, but any
local file that differs is still a conflict and still asked about.

## Format versions across a restore

A backup can be older than the application restoring it. The
[format version check](storage-format.md#librarytoml) applies exactly as it does on open: the
restored library is migrated, with the pre-migration copy kept, or refused if it was written by
a newer version. Restoring a two-year-old backup into a current build is a case that must
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

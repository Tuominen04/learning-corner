# Roadmap

> **Audience:** People building Personal Learning Corner
> **Status:** In progress — M0 implemented
> **Last reviewed:** 2026-09-06

Milestones in order. Each is shippable on its own — a person could install it, use it, and get
something out of it — and each has a definition of done that is checkable rather than a
feeling.

No dates. This is one person's project; the order is the commitment, not a schedule.

---

## M0 · Foundations

The skeleton, with nothing interesting on top of it.

**Engine — done.**

- [x] The engine repository exists, with the contract's shape and its test harness.
- [x] Library create, open, and close. `library.toml`, format version 1, the version checks.
- [x] Atomic writes, exactly as [specified](storage-format.md#writing-files).
- [x] Topic tree; document create, read, write, rename, move, delete.
- [x] The index, with the rebuild-equivalence property asserted from the first commit rather
      than retrofitted.
- [x] Engine CI: tests, `clippy -D warnings`, `rustfmt --check`.

**Shell and interface — built, not yet seen running.**

- [x] A Tauri window that opens, pinning the engine immutably
      ([ADR 0006](adr/0006-engine-dependency-pinning.md)).
- [x] Framework and editor chosen ([ADR 0005](adr/0005-react-tiptap-interface.md)); bindings
      generated ([ADR 0007](adr/0007-bindings-with-ts-rs.md)); editor schema narrowed for
      round-trip fidelity ([ADR 0008](adr/0008-narrow-editor-schema.md)).
- [x] Library picker, topic tree, document editor with continuous saving and conflict handling.
- [x] Interface CI: lint, typecheck, round-trip tests, bindings freshness, `docs/check-docs.sh`.
- [ ] **Seen running by a person.** The release binary builds (15 MB) and stays up under a
      virtual display, but the webview renders nothing in a container with no GPU, so nobody
      has yet watched the interface work. This is the one item M0 cannot close by itself.

**Done when:** a library can be created, documents written and read back, the application
restarted with everything intact, `.plc/` deleted and rebuilt with no observable difference,
and every file readable in a text editor.

The engine half is provable today — `cargo run --example walkthrough` in the engine repository
runs it end to end. The interface half is built and every automated check passes; what remains
is running it on a desktop and using it.

---

## M1 · Documents and sources ← *the first release*

The reason the product exists: [claims anchored to sources](architecture.md#principles), and
APA 7 that is actually correct.

- Sources: all seven types, structured contributors, the incomplete-source path.
- The [disambiguation pass](citation-model.md#disambiguation) — all three cases, library-wide.
- In-text citation in both forms; the generated reference list.
- Citing while writing; `source.citingDocuments` in both directions.
- Document splitting, `[[…]]` links, backlinks.
- Claim marking — the visible difference between what is sourced and what is not.
- Search across documents and sources.
- Export to a formatted document and to plain text, hanging indent included.
- The APA fixture suite passing in full.

**Done when:** the protein example from the README can be worked end to end — one topic
becoming six documents, sources saved and cited, a correct reference list on every one, and a
source corrected once being correct everywhere.

---

## M2 · Backup and restore

Before more features. A person using M1 has work worth losing, and the honest thing is to make
it safe before making it bigger.

- Mirror backup and restore, both two-phase.
- The [three-outcome comparison](backup-and-sync.md#the-three-outcomes), digests, `sync-state`.
- Conflict resolution with retention under `.conflicts/`, local as the default.
- Resumable after interruption.
- Format migration on restore, with the frozen-library fixtures.
- The backup round-trip property test.

**Done when:** a library backs up to a drive, restores onto a different machine, and every row
of the outcome table has been produced deliberately and resolved every possible way with
nothing unrecoverable.

---

## M3 · Parallel texts

- Works, editions, all three kinds; the pronunciation/translation distinction.
- Segmentation by line, sentence, paragraph; two-phase re-segmentation.
- Pane selection, both layouts, synchronised scrolling and selection.
- Misalignment reporting, `~` and `+ ` markers, split and join.
- Repeated segments.
- Segment notes; sources on a work.
- Pane hiding, for practice.

**Done when:** the Russian/Finnish example works — original, pronunciation, Finnish and
English, panes chosen freely, hand-edited alignment surviving a round trip through the files.

---

## M4 · Mind maps

- A map in a second window, updating live.
- Nodes referencing entities, never copying them.
- Derived edges from links; user edges with labels; free nodes for open questions.
- Automatic arrangement, then hand placement that is kept.
- Filtering by topic and by distance from a node.
- Export as an image.

**Done when:** a map of the protein topic opens beside a document, updates as it is written,
and can be deleted without touching a single document.

---

## M5 · Beyond Fedora

- Windows and macOS builds, packaging and signing.
- Cross-platform path, filesystem, and locale differences — the actual work of this milestone.
- A library folder proven to move between the three systems unchanged.

**Done when:** the same library, copied between Fedora, Windows, and macOS, opens correctly on
all three with identical results.

---

## Later, deliberately unscheduled

Wanted, but not before M5. Listed so they are not forgotten and not smuggled in early.

| | Notes |
| --- | --- |
| Optional source lookup from a code | Network, therefore an ADR, off by default, never the supported path |
| Citation styles beyond APA 7 | Cheap by design — a second formatter, no re-entry ([Citation model](citation-model.md)) |
| Import from other note applications | |
| Spaced-repetition review over claims and segments | The obvious next thing for a learning tool; large enough to be its own product decision |
| Audio alongside a parallel text | For pronunciation and songs |
| Plugins | Not until the data model has stopped moving |

## Related

- [Architecture](architecture.md)
- [Decision records](adr/)
- [Testing](testing.md)

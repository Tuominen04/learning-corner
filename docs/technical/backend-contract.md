# Engine contract

> **Audience:** People building Personal Learning Corner
> **Status:** In progress — M0 implemented
> **Last reviewed:** 2026-09-06

Every operation the interface may ask of the engine. This document is normative for both
repositories and is the specification the engine is built against — see
[Repositories](repositories.md) for the change procedure.

It is written language-neutrally on purpose. The engine is Rust today and the interface calls
it through the shell, but the contract must stay implementable by a command-line client or a
future mobile client without redefining anything.

## Rules that hold for every operation

1. **Nothing implicit.** No operation depends on a "currently open document" the engine
   remembers. The only session state is the open library.
2. **Identifiers, not paths.** The interface never sends a path inside a library. Paths are
   the engine's business.
3. **Failures are values, not surprises.** Every operation can fail; the error names a cause
   from the table below, and the interface is expected to handle each.
4. **Destructive operations are two-phase.** Anything that could lose user content is a
   `plan` call returning what would happen, followed by an `apply` call taking the plan and
   the user's decisions. The engine never destroys anything in a single call.
5. **Reads are cheap, writes are durable.** A write call returns only after the bytes are on
   disk ([Storage format](storage-format.md)).

## Errors

| Cause | Meaning | Interface should |
| ----- | ------- | ---------------- |
| `NotFound` | No such entity | Refresh; it may have been deleted externally |
| `LibraryNotOpen` | No library is open | Send the user to the library picker |
| `FormatTooNew` | Library written by a newer version | Show read-only, offer to update the app |
| `MigrationRequired` | Library is older | Offer migration |
| `Conflict` | Content changed underneath this operation | Show both, ask |
| `Incomplete` | Accepted, but required fields are missing | Save, and show what is missing |
| `Invalid` | Rejected; names the field and the reason | Show it against the field |
| `LibraryError` | The library on disk is inconsistent | Show the diagnostic; do not retry |
| `Io` | Disk full, permissions, drive removed | Show it plainly; never claim success |
| `Unimplemented` | Named in this contract, not yet built | Hide or disable the control; never present it as a failure |

`Unimplemented` exists because the whole operation surface is fixed before the whole of it is
built. An operation from a later milestone is present, named, and returns this — so the
interface can be written against the entire contract now, and filling one in later is a body
change rather than a shape change.

`Incomplete` is not an error path. A source that is missing its publisher is saved, is
citable, and is reported as incomplete — because the alternative is that a user in a hurry
loses the source altogether. See [Citation model](citation-model.md).

## Library

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `library.create` | path, name | library summary |
| `library.open` | path | library summary, or `FormatTooNew` / `MigrationRequired` |
| `library.close` | — | — |
| `library.rename` | name | library summary. The name only: the library's folder is the user's, and is never renamed or moved |
| `library.migrate` | path | summary, and the path of the pre-migration copy |
| `library.status` | — | counts, index freshness, unresolved conflicts, incomplete sources |
| `library.rebuildIndex` | — | progress events, then a summary |

Which libraries have been opened before is not part of this contract. The shell keeps that list
for the start screen, in the application's settings rather than in any library
([Packaging](packaging-fedora.md#directories)), and a command-line client would have no use for
it.

## Topics and documents

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `topic.create` | parent topic (optional), name | topic |
| `topic.rename` | id, name | topic |
| `topic.move` | id, new parent | topic |
| `topic.deletePlan` | id | every document anywhere below it, by name, and how many topics |
| `topic.delete` | id, `delete` / `move-up` | nothing — there is no default for the contents, on purpose |
| `topic.tree` | — | the full topic tree |
| `document.create` | topic id, title | document |
| `document.read` | id | document, with resolved citations and links |
| `document.write` | id, content, expected revision | document, or `Conflict` |
| `document.split` | id, range, new title, expected revision | both documents; citations in the range move; a link is left behind |
| `document.rename` | id, title | document |
| `document.move` | id, topic id | document |
| `document.delete` | id | `plan` / `apply` |
| `document.backlinks` | id | documents linking here, derived from `[[…]]` and never stored |
| `document.attachImage` | id, path, `copy`/`move` | the filename to write into the body |
| `document.image` | id, filename | the picture, or `null` when there is nothing to show |

`document.attachImage` brings the picture **into** the library rather than referencing it,
exactly as `source.attach` does for a PDF, and with the same `copy`/`move` choice. It answers
with the filename to write — `![alt](diagram.png)` — which is the engine's, not the picked
file's: it has been made unique against everything already beside the document, so two
pictures called `diagram.png` stay two pictures. The layout rules are in
[storage format](storage-format.md#pictures).

`document.image` takes an identifier and a **name out of that document's own body**, never a
path, for the same reason `source.open` does: nothing the interface can say reaches a file the
engine did not resolve, and the interface needs no filesystem permission of its own. `null`
rather than an error when there is nothing to show — a body is plain text, so it may name a
picture the user has since deleted, or something that is not a filename at all, and neither
may fail the document around it.

`document.split` is one operation rather than three calls, because a crash between writing the
new document and rewriting the old one would lose writing. The order makes the worst outcome a
duplicate rather than a hole: the new document is written first, so a failure afterwards leaves
the text in two places, which is visible and fixable.

Its `range` is a **character range into the body the caller last read**, which is why it takes
a revision as well: offsets into a file that changed underneath address different text, and
splitting on them takes the wrong words out of a document. The interface works in editor
positions, which are a different thing entirely — a citation is one position and thirty-five
characters — so the conversion happens on the interface side and arrives here in the file's own
terms. A range landing inside a character is refused rather than panicking.

`document.write` takes the **revision** the interface received from the last read: an opaque
token the interface stores and passes back, never interprets. If the file changed underneath —
the user edited it externally, as they are
[explicitly allowed to](../user/libraries-and-files.md) — the engine returns `Conflict` rather
than overwriting.

The revision is derived from the file on disk (its modification time and size), **not** from
the document's own `modified` field. That distinction is the whole point: an external editor
changes the body without touching the front matter, so a check against `modified` would miss
precisely the case this exists to catch.

## Sources and citations

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `source.create` | type, fields | source, with any missing required fields listed |
| `source.update` | id, fields | source |
| `source.read` | id | source |
| `source.list` | filter, sort | sources |
| `source.delete` | id | `plan` (lists every citing document) / `apply` |
| `source.citingDocuments` | id | the documents citing it, each once |
| `source.requiredFields` | type | the fields APA 7 requires for that type |
| `source.attach` | id, path, `copy`/`move` | source, now carrying the copy's filename |
| `source.detach` | id | source, with the copy deleted |
| `source.open` | id | `false` when there is nothing to open |
| `citation.format` | source id, locator, form | the formatted in-text citation |
| `citation.referenceList` | document id | ordered, formatted reference list |

`source.attach` brings the file **into** the library rather than referencing it, so the original
being gone afterwards is safe. Whether it goes is the caller's choice: `move` removes it once
the library's copy is safe, `copy` leaves it where it was — see
[storage format](storage-format.md). `source.update` never
changes the attachment: an interface sends the fields its form knows about, and one that had not
heard of attachments would otherwise detach a paper every time somebody corrected a title.

`source.open` takes an identifier and not a path, on purpose. The path is the engine's answer,
so nothing the interface can say reaches a file outside the library, and the interface needs no
filesystem permission of its own.

`source.delete` can orphan citations across the library, so it is two-phase without
exception. The plan lists every affected document; the apply step records the user's choice
of removing the citations or leaving them marked as unresolved.

`citation.format` and `citation.referenceList` live in the engine, not the interface. The
reasoning is in [Architecture](architecture.md#where-logic-is-allowed-to-live).

## Works and parallel texts

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `work.create` | title, unit, original text, language | work |
| `work.addEdition` | work id, kind, language, text | work |
| `work.read` | id, editions to include | aligned segments, plus any misalignment report |
| `work.writeSegment` | work id, edition id, segment index, text | segment |
| `work.splitSegment` / `work.joinSegments` | work id, index | the re-aligned work |
| `work.resegment` | id, new unit | `plan` (what moves) / `apply` |
| `work.delete` | id | `plan` / `apply` |

`work.read` returns rows across the requested editions, and always returns the misalignment
report alongside rather than hiding a bad alignment behind a plausible-looking one.

## Maps

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `map.create` / `map.delete` | … | map |
| `map.read` | id | nodes with positions, user edges, plus edges derived from document links |
| `map.setNodePosition` | map id, node id, position | — |
| `map.addEdge` / `map.removeEdge` | map id, from, to, label | — |
| `map.addNode` / `map.removeNode` | map id, entity id or free node | — |

Derived edges are computed on read, never stored. See
[Storage format](storage-format.md#maps).

## Search

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `search.query` | text, filters (topic, source, entity kind) | ranked results with excerpts |
| `search.suggest` | prefix | titles, for `[[` completion |

## Backup

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `backup.plan` | destination path | per-file outcomes: new, changed here, changed there, conflicted, unchanged |
| `backup.apply` | plan, decision per conflict | what was written, and where retained copies went |
| `restore.plan` | source path, destination path | the same shape, in the other direction |
| `restore.apply` | plan, decisions | result |

Always two-phase. The plan is what the user is shown before anything is written, and the
apply step carries their decisions. Rules in [Backup and synchronisation](backup-and-sync.md).

## Export

| Operation | Takes | Returns |
| --------- | ----- | ------- |
| `export.document` | id, format | the exported bytes, reference list included |
| `export.map` | id, format | an image |

## Events

The engine pushes these; the interface subscribes. They exist because the library can change
without the interface asking — an external edit, a long rebuild.

| Event | When |
| ----- | ---- |
| `entityChanged` | An entity changed on disk, from any cause |
| `externalChange` | A change the application did not make |
| `indexProgress` | During a rebuild |
| `libraryError` | An inconsistency was found |

## Related

- [Architecture](architecture.md) — where logic is allowed to live
- [Repositories](repositories.md) — how to change this document
- [Testing](testing.md) — contract tests

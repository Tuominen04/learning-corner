# ADR 0008 · The editor's schema stays narrow until Markdown serialisation exists

> **Audience:** People building Personal Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-09-06

## Context

Documents are [Markdown on disk](../storage-format.md#documents), and the user is promised the
files stay readable and hand-editable. A document opened and saved without being touched must
therefore produce byte-identical text. Anything else is quiet data loss in the user's own
files, which is [the worst thing this application can do](../testing.md#what-the-risk-actually-is).

TipTap's `StarterKit` supplies headings, lists, emphasis, code blocks, and more. Enabling it is
one line. Serialising all of it back to Markdown faithfully is not.

## Decision

The M0 editor registers only `document`, `paragraph`, `text`, `history`, and the two inline
node types the storage format defines — `citation` and `documentLink`. No headings, no
emphasis, no lists.

Round-trip fidelity is tested directly, in `src/lib/body.test.ts`, over prose, both inline
constructs, adjacent constructs, Cyrillic and Finnish text, Markdown left as literal text, and
malformed syntax that must stay ordinary text.

## Alternatives considered

**Enable `StarterKit` now, serialise later.** The tempting option, and the dangerous one. A
user presses Ctrl+B, sees bold text, saves, and the formatting is silently dropped on write —
a data-loss bug that looks like a working feature. Shipping a control that discards work is
worse than not shipping the control.

**Add a Markdown serialiser now.** Correct eventually, and out of scope for a milestone whose
job is proving the storage foundation. It also wants doing properly alongside M1's citation
rendering, where a citation node has an actual source record to render from.

**Edit raw text in a plain textarea.** Perfectly faithful, and it gives up the custom node
types that [ADR 0005](0005-react-tiptap-interface.md) says to register from the start —
precisely so they do not have to be retrofitted into a working editor later.

## Consequences

**Easier.** Round-trip fidelity is provable rather than hoped for, and it is proved by tests
that will keep proving it. The two node types that matter are in place from the first commit.

**Harder.** The M0 editor is plainer than people expect from an editor, and Markdown a user
types is stored and shown as literal text. The interface says so, in a line under the editor,
rather than letting someone discover it.

## Revisit if

M1's citation rendering lands — that is when a Markdown serialiser is wanted anyway, and when
the schema should widen to match it in the same change.

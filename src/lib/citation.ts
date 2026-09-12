// Citations on this side of the wire: how a locator is written, and where a citation goes.
//
// The editor keeps a locator exactly as the file spells it — `44-46`, `time:1:04:22` — because
// this side's first duty is handing back the bytes it read. The engine wants it typed, because
// `p. 44` and `1:04:22` are different renderings. This file is the only place that translates,
// so the rule lives once rather than in every caller.
//
// Note the asymmetry, which is the trap here: the written prefix is short and the wire kind is
// the whole word. `para:` becomes `paragraph`, `time:` becomes `timestamp`. Getting that
// backwards produces a locator the engine rejects, or worse, silently renders as a page.

import type { Editor } from "@tiptap/core";

import { CITATION } from "./body";
import type { Form, Locator } from "./engine";

/** Written prefix to wire kind. A page has no prefix, so it is absent here by design. */
const PREFIXES: { written: string; kind: Locator["kind"] }[] = [
  { written: "para", kind: "paragraph" },
  { written: "chapter", kind: "chapter" },
  { written: "time", kind: "timestamp" },
];

/**
 * A locator as written in a document, typed for the engine.
 *
 * `null` for a locator that is absent or unrecognised. Unrecognised is not guessed at as a
 * page: citing a section as though it were a page number is wrong output, and wrong output is
 * worse than a citation that renders without a locator at all.
 */
export function toLocator(written: string | null): Locator | null {
  if (written === null || written === "") return null;

  const colon = written.indexOf(":");
  if (colon === -1) return { kind: "page", value: written };

  // Only the first colon separates: a timestamp is `1:04:22` and carries its own.
  const prefix = written.slice(0, colon);
  const value = written.slice(colon + 1);
  if (value === "") return null;

  const match = PREFIXES.find((p) => p.written === prefix);
  return match ? { kind: match.kind, value } : null;
}

/**
 * A typed locator, written the way a document spells it.
 *
 * The inverse of {@link toLocator}, and the tests hold them to it. A page is written bare
 * because that is the format's one spelling for it — see `storage-format.md`.
 */
export function writeLocator(locator: Locator | null): string | null {
  if (locator === null) return null;
  if (locator.kind === "page") return locator.value;
  const match = PREFIXES.find((p) => p.kind === locator.kind);
  return match ? `${match.written}:${locator.value}` : null;
}

/**
 * What identifies one rendered citation.
 *
 * Two citations of the same source can differ — one narrative, one with a page — so all three
 * parts are in the key. Rendered text is looked up by this rather than by position, so editing
 * a paragraph does not shuffle every citation after it.
 */
export function citationKey(
  source: string,
  written: string | null,
  form: Form,
): string {
  return `${source}|${written ?? ""}|${form}`;
}

/** A citation somebody has just chosen, ready to be written into a document. */
export type Chosen = {
  source: string;
  /** As it will be written on disk: `44`, `44-46`, `time:1:04:22`. */
  locator: string | null;
  form: Form;
};

/**
 * Write a chosen citation into a document, at the end of whatever is selected.
 *
 * The collapse is the whole point of this function existing. "Select what you wrote, choose
 * Cite" is how the user guide describes citing, so a selection is the *normal* case — and
 * inserting into a live selection replaces it, which deletes the very sentence being cited
 * and then saves the loss a moment later. Collapsing to the selection's end also puts the
 * citation where APA 7 wants it: after the claim it supports.
 */
export function insertCitation(editor: Editor, chosen: Chosen): void {
  const { to } = editor.state.selection;
  editor
    .chain()
    .focus()
    .setTextSelection(to)
    .insertContent({
      type: CITATION,
      attrs: { source: chosen.source, locator: chosen.locator, form: chosen.form },
    })
    .run();
}

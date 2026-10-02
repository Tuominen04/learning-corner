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
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

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
 * citation where APA 7 wants it: after the claim it supports — and, for a parenthetical one,
 * in front of the full stop that ends it (see `citationPosition`).
 */
export function insertCitation(editor: Editor, chosen: Chosen): void {
  const { to } = editor.state.selection;
  const at = chosen.form === "parenthetical" ? citationPosition(editor.state.doc, to) : to;
  editor
    .chain()
    .focus()
    .setTextSelection(at)
    .insertContent({
      type: CITATION,
      attrs: { source: chosen.source, locator: chosen.locator, form: chosen.form },
    })
    .run();
}

/** What closes a sentence, one mark or several: `.`, `?!`, `…`. */
const CLOSING = /[.!?…]+$/u;

/**
 * Words whose full stop may be their own rather than the sentence's — in English, Finnish and
 * Russian, the languages this is written in.
 */
const ABBREVIATIONS = new Set([
  "etc", "approx", "incl", "ibid", "vol", "eds", "fig", "figs", "nos", "inc", "ltd", "corp",
  "prof", "mrs", "jne", "esim", "yms", "tms", "vrt", "eaa", "jaa", "stb", "стр", "рис",
]);

/**
 * Where a parenthetical citation for a selection ending at `to` goes.
 *
 * APA puts it inside the sentence it supports, in front of the closing punctuation: `tissue
 * (Nieminen, 2021).`, never `tissue. (Nieminen, 2021)`. Selecting a whole sentence takes its
 * full stop with it — often the space after it too — so both are stepped back over.
 *
 * Two full stops are left where they are, and the citation goes after them as before:
 * - one after a closing quotation mark or bracket, which belongs to what it closes;
 * - one that may end an abbreviation: a word with a full stop of its own (`U.S.`), one or two
 *   letters or digits (`mm.`, `Fig. 3.`), or a known one (`jne.`). Stepping in front of it
 *   would cut `jne.` down to `jne`; a citation after the sentence is the lesser fault.
 */
export function citationPosition(doc: ProseMirrorNode, to: number): number {
  const $to = doc.resolve(to);
  // A citation, link or picture already in the paragraph is one position wide; one character
  // standing for it keeps offsets in the text and positions in the document the same.
  const before = $to.parent.textBetween(0, $to.parentOffset, undefined, "\ufffc");
  const trimmed = before.replace(/[ \t]+$/u, "");
  const closing = CLOSING.exec(trimmed)?.[0];
  if (!closing) return to;

  const word = /\S*$/u.exec(trimmed.slice(0, -closing.length))?.[0] ?? "";
  if (word === "") return to;
  if (closing === "." && mayBeAbbreviation(word)) return to;

  return to - (before.length - trimmed.length) - closing.length;
}

function mayBeAbbreviation(word: string): boolean {
  const bare = word.replace(/^[([{"'“‘«„]+/u, "");
  if (bare.includes(".")) return true;
  if (/^[\p{L}\p{N}]{1,2}$/u.test(bare)) return true;
  return ABBREVIATIONS.has(bare.toLowerCase());
}

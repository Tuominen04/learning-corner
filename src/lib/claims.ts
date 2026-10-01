// Which sentences in a document are claims — anchored to a source — and which are not.
//
// A claim is the sentence a citation belongs to. Everything else is the person's own writing:
// a question, a summary, a thought. The point of telling them apart is that six months later
// "protein is used for tissue repair" and "I think protein is why I sleep badly" look the same
// on the page, and only one of them was checked.
//
// Worked out from the document as it is in the editor, so the marks follow the typing. Nothing
// here is stored: a claim is a reading of the text, never a fact about the file.

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { CITATION } from "./body";

/** A stretch of the document, in editor positions, that a citation stands behind. */
export type Claim = { from: number; to: number };

/** A sentence, as character offsets into the text it was found in. End exclusive. */
export type Sentence = { start: number; end: number };

export type Splitter = (text: string) => Sentence[];

/** What stands in for a link or a picture in a sentence: one character, and not a full stop. */
const ELSEWHERE = "￼";

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "sentence" })
    : null;

/**
 * Split text into sentences, the way the language's own rules do.
 *
 * `Intl.Segmenter` knows that a full stop inside "3.5" ends nothing and that Finnish and
 * Russian end sentences the way English does. Where it is missing, `byPunctuation` is the
 * plain fallback.
 */
export function sentences(text: string): Sentence[] {
  if (segmenter === null) return byPunctuation(text);
  return [...segmenter.segment(text)].map((part) => ({
    start: part.index,
    end: part.index + part.segment.length,
  }));
}

/**
 * A sentence ends at `.`, `!`, `?` or `…`, with any closing quote or bracket and a space —
 * unless what follows starts in lower case, which carries the sentence on ("Yes… it is.").
 */
export function byPunctuation(text: string): Sentence[] {
  const out: Sentence[] = [];
  const ends = /[.!?…]+["'”’»)\]]*\s+/g;
  let start = 0;
  for (let found = ends.exec(text); found !== null; found = ends.exec(text)) {
    const end = found.index + found[0].length;
    if (/\p{Ll}/u.test(text[end] ?? "")) continue;
    out.push({ start, end });
    start = end;
  }
  if (start < text.length) out.push({ start, end: text.length });
  return out;
}

/**
 * The claims in a document, in order.
 *
 * A citation stands behind the sentence it sits in — or, sitting exactly between two
 * sentences, behind the one **before** it. That is where citations go: after the claim they
 * support, which is where `insertCitation` puts them, right after the words that were
 * selected. Several citations behind one sentence make one claim, not several.
 *
 * Each claim covers its sentence and the citations behind it, without the space after it.
 */
export function findClaims(doc: ProseMirrorNode, split: Splitter = sentences): Claim[] {
  const claims: Claim[] = [];

  doc.descendants((block, blockPos) => {
    if (!block.isTextblock) return true;

    // The block's words with the citations taken out, and where in the document each
    // character of them is — a citation is one position wide and no characters long, so the
    // two stop agreeing at the first one.
    const start = blockPos + 1;
    let prose = "";
    const at: number[] = [];
    const cited: { offset: number; pos: number }[] = [];

    block.forEach((child, offset) => {
      const pos = start + offset;
      if (child.isText) {
        const text = child.text ?? "";
        for (let i = 0; i < text.length; i += 1) at.push(pos + i);
        prose += text;
      } else if (child.type.name === CITATION) {
        cited.push({ offset: prose.length, pos });
      } else {
        at.push(pos);
        prose += ELSEWHERE;
      }
    });

    if (cited.length === 0) return false;

    const found = split(prose);
    const bySentence = new Map<number, Claim>();
    for (const citation of cited) {
      const which = owner(found, citation.offset);
      const sentence = which === -1 ? null : trimmed(prose, found[which]!);
      const had = bySentence.get(which);
      const claim: Claim = had ?? {
        from: sentence ? at[sentence.start]! : citation.pos,
        to: sentence ? at[sentence.end - 1]! + 1 : citation.pos + 1,
      };
      claim.from = Math.min(claim.from, citation.pos);
      claim.to = Math.max(claim.to, citation.pos + 1);
      bySentence.set(which, claim);
    }

    claims.push(...[...bySentence.values()].sort((a, b) => a.from - b.from));
    return false;
  });

  return claims;
}

/**
 * Which sentence a citation at `offset` stands behind: the one it is inside, or the one that
 * ends exactly where it sits. `-1` when there is no sentence at all — a paragraph holding
 * nothing but a citation.
 */
function owner(found: Sentence[], offset: number): number {
  if (found.length === 0) return -1;
  if (offset === 0) return 0;
  const index = found.findIndex((s) => s.start < offset && offset <= s.end);
  return index === -1 ? found.length - 1 : index;
}

/** A sentence without the spaces around it, or `null` if it is nothing but space. */
function trimmed(text: string, sentence: Sentence): Sentence | null {
  let { start, end } = sentence;
  while (start < end && /\s/.test(text[start]!)) start += 1;
  while (end > start && /\s/.test(text[end - 1]!)) end -= 1;
  return start < end ? { start, end } : null;
}

/** The sources a document cites, each once, in the order they first appear. */
export function citedSources(doc: ProseMirrorNode): string[] {
  const seen = new Set<string>();
  doc.descendants((node) => {
    if (node.type.name === CITATION) {
      const source = String(node.attrs["source"] ?? "");
      if (source) seen.add(source);
    }
    return true;
  });
  return [...seen];
}

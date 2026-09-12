// Converting between a document's text on disk and the editor's document model.
//
// **Round-trip fidelity is the requirement**, not rich rendering. A document opened and saved
// without being touched must produce byte-identical text, because the user is promised their
// files stay readable and hand-editable and because anything else is quiet data loss.
//
// That requirement is why the editor's schema is deliberately narrow in M0: paragraphs, text,
// and the two inline constructs the storage format defines. No headings, no bold, no lists —
// not because they are unwanted, but because serialising them back to Markdown faithfully is
// M1 work, and shipping a Ctrl+B that silently drops formatting on save would be worse than
// not having one.

import type { JSONContent } from "@tiptap/core";

export const CITATION = "citation";
export const DOCUMENT_LINK = "documentLink";

/**
 * `[^cite:<id>]`, optionally `@<locator>`, optionally `!narrative`.
 *
 * This mirrors the engine's parser, which is the authority — see `storage-format.md`. Written
 * out rather than approximated, because the two have to agree exactly: a citation this side
 * recognises and the engine does not is one the reference list quietly omits, and a citation
 * the engine recognises and this side does not is one the editor turns into literal text the
 * next time somebody saves.
 *
 * A page is bare (`@44`, `@44-46`); every other kind names itself (`@time:1:04:22`). The
 * timestamp is why the value may contain colons and why only the first one separates.
 */
const CITATION_PATTERN =
  /\[\^cite:([0-9A-HJKMNP-TV-Z]{26})(?:@((?:para|chapter|time):[^\]!]+|[^\]!:]+))?(!narrative)?\]/g;

/** `[[<id>]]` */
const LINK_PATTERN = /\[\[([0-9A-HJKMNP-TV-Z]{26})\]\]/g;

/** Text on disk to the editor's document model. */
export function parseBody(text: string): JSONContent {
  const paragraphs = text.split("\n\n");
  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: parseInline(paragraph),
    })),
  };
}

function parseInline(paragraph: string): JSONContent[] {
  type Match = { start: number; end: number; node: JSONContent };
  const matches: Match[] = [];

  for (const m of paragraph.matchAll(CITATION_PATTERN)) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      node: {
        type: CITATION,
        attrs: {
          source: m[1] ?? "",
          // Kept exactly as written — `44-46` or `time:1:04:22`. Splitting it into a kind and
          // a value here would need reassembling on the way out, and the one thing this file
          // must never do is hand back bytes that differ from the ones it read.
          locator: m[2] ?? null,
          form: m[3] ? "narrative" : "parenthetical",
        },
      },
    });
  }
  for (const m of paragraph.matchAll(LINK_PATTERN)) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      node: { type: DOCUMENT_LINK, attrs: { document: m[1] ?? "" } },
    });
  }
  matches.sort((a, b) => a.start - b.start);

  const out: JSONContent[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue; // overlapping; the earlier match wins
    if (match.start > cursor) {
      out.push({ type: "text", text: paragraph.slice(cursor, match.start) });
    }
    out.push(match.node);
    cursor = match.end;
  }
  if (cursor < paragraph.length) {
    out.push({ type: "text", text: paragraph.slice(cursor) });
  }
  return out;
}

/** The editor's document model back to text on disk. */
export function serializeBody(doc: JSONContent): string {
  return (doc.content ?? []).map(serializeParagraph).join("\n\n");
}

function serializeParagraph(paragraph: JSONContent): string {
  return (paragraph.content ?? []).map(serializeInline).join("");
}

function serializeInline(node: JSONContent): string {
  switch (node.type) {
    case "text":
      return node.text ?? "";
    case CITATION: {
      const source = String(node.attrs?.["source"] ?? "");
      const locator = node.attrs?.["locator"];
      const narrative = node.attrs?.["form"] === "narrative";
      const where = locator ? `@${String(locator)}` : "";
      // Parenthetical is the default and is never written; see `storage-format.md`.
      return `[^cite:${source}${where}${narrative ? "!narrative" : ""}]`;
    }
    case DOCUMENT_LINK:
      return `[[${String(node.attrs?.["document"] ?? "")}]]`;
    default:
      return "";
  }
}

/** One citation found in the editor's document, and where to look its rendering up. */
export type FoundCitation = { source: string; locator: string | null; form: string };

/**
 * Every citation in the editor's current document, in order, keeping repeats.
 *
 * Repeats are kept because each is a place in the text that has to be drawn. Deduplicating is
 * the caller's job, and it deduplicates by key rather than by source: two citations of one
 * source can render differently.
 */
export function collectCitations(doc: JSONContent): FoundCitation[] {
  const found: FoundCitation[] = [];
  walk(doc, (node) => {
    if (node.type !== CITATION) return;
    const source = String(node.attrs?.["source"] ?? "");
    if (source === "") return;
    const locator = node.attrs?.["locator"];
    found.push({
      source,
      locator: typeof locator === "string" && locator !== "" ? locator : null,
      form: node.attrs?.["form"] === "narrative" ? "narrative" : "parenthetical",
    });
  });
  return found;
}

function walk(node: JSONContent, visit: (node: JSONContent) => void) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

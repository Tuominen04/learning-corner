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

/** `[^cite:<id>]` or `[^cite:<id>@<locator>]` */
const CITATION_PATTERN = /\[\^cite:([0-9A-HJKMNP-TV-Z]{26})(?:@([^\]]*))?\]/g;

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
        attrs: { source: m[1] ?? "", locator: m[2] ?? null },
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
      return locator ? `[^cite:${source}@${String(locator)}]` : `[^cite:${source}]`;
    }
    case DOCUMENT_LINK:
      return `[[${String(node.attrs?.["document"] ?? "")}]]`;
    default:
      return "";
  }
}

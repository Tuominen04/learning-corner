// Converting between a document's text on disk and the editor's document model.
//
// **Round-trip fidelity is the requirement**, not rich rendering. A document opened and saved
// without being touched must produce byte-identical text, because the user is promised their
// files stay readable and hand-editable and because anything else is quiet data loss.
//
// That requirement is what decides which Markdown the editor understands. A construct belongs
// here only when it has exactly one spelling that can be written back character for character:
// paragraphs, ATX headings, images, and the two inline constructs the storage format defines.
// Emphasis and lists are still absent — `*a*` and `_a_` mean the same thing, and a list has
// four spellings of its bullet, so reading one and writing another would quietly rewrite the
// user's file the first time they opened it.
//
// Everything else stays literal text. Text this file does not recognise still round-trips
// perfectly; it simply does not render.

import type { JSONContent } from "@tiptap/core";

export const CITATION = "citation";
export const DOCUMENT_LINK = "documentLink";
export const HEADING = "heading";
export const IMAGE = "image";

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

/**
 * `![<alt>](<name>)`, where the name is a file beside the document.
 *
 * Narrower than the engine's own scan, deliberately. The engine accepts anything up to the
 * closing bracket so that a hand-typed reference still moves with its document; this side has
 * to *write the line back*, so it recognises only what it can reproduce exactly. Everything
 * it matches, the engine matches too — the guarantee that runs the wrong way is the dangerous
 * one, because it would mean a picture this editor draws and the engine leaves behind.
 *
 * No whitespace in the name, which is also true of every name the engine hands out: they are
 * slugs. A path is not refused here so much as never produced — but one typed by hand stays
 * literal text, and the engine refuses to follow it out of the folder.
 */
const IMAGE_PATTERN = /!\[([^\]\n]*)\]\(([^)\s]+)\)/g;

/**
 * `# ` to `###### `, and nothing else.
 *
 * ATX only, one space, one line. Setext underlining is a second spelling of the same thing;
 * `#Heading` is not a heading at all in any Markdown reader, so treating it as one here would
 * mean the file said something the file does not say. Both stay paragraphs, and both survive.
 *
 * The block may not contain a newline: `# Title\nand prose` is a heading *and* a paragraph in
 * Markdown, and this file has no way to write two blocks back from one. Left whole, it stays
 * text — visible, and intact.
 */
const HEADING_PATTERN = /^(#{1,6}) (.*)$/;

/** Text on disk to the editor's document model. */
export function parseBody(text: string): JSONContent {
  return { type: "doc", content: text.split("\n\n").map(parseBlock) };
}

function parseBlock(block: string): JSONContent {
  const heading = HEADING_PATTERN.exec(block);
  if (heading) {
    return {
      type: HEADING,
      attrs: { level: (heading[1] ?? "#").length },
      content: parseInline(heading[2] ?? ""),
    };
  }
  return { type: "paragraph", content: parseInline(block) };
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
  for (const m of paragraph.matchAll(IMAGE_PATTERN)) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      node: { type: IMAGE, attrs: { alt: m[1] ?? "", name: m[2] ?? "" } },
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
  return (doc.content ?? []).map(serializeBlock).join("\n\n");
}

function serializeBlock(block: JSONContent): string {
  const text = (block.content ?? []).map(serializeInline).join("");
  if (block.type !== HEADING) return text;
  // Clamped rather than trusted. A level outside 1-6 cannot come from `parseBody` or from the
  // editor's own schema, and writing `####### ` would be a line no reader treats as a heading
  // — so the document would silently stop saying what it said.
  const level = Math.min(Math.max(Number(block.attrs?.["level"] ?? 1) || 1, 1), 6);
  return `${"#".repeat(level)} ${text}`;
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
    case IMAGE:
      return `![${String(node.attrs?.["alt"] ?? "")}](${String(node.attrs?.["name"] ?? "")})`;
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

/**
 * Every picture the document names, in order, each name once.
 *
 * Deduplicated, unlike citations: a citation's repeats each have to be drawn separately
 * because they can read differently, whereas the same file shown twice is one file to fetch.
 */
export function collectImages(doc: JSONContent): string[] {
  const found = new Set<string>();
  walk(doc, (node) => {
    if (node.type !== IMAGE) return;
    const name = String(node.attrs?.["name"] ?? "");
    if (name !== "") found.add(name);
  });
  return [...found];
}

function walk(node: JSONContent, visit: (node: JSONContent) => void) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

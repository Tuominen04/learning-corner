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
  return `${headingPrefix(block)}${text}`;
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

/**
 * The syntax a body carries that must never be cut in half.
 *
 * Deliberately more permissive than the patterns above. Those decide what the editor
 * *renders*; this decides what must survive being cut, and the dangerous case is exactly the
 * construct the editor did **not** render — `[^cite:…@page:44]`, a link to a document that is
 * gone, anything hand-typed. Unrendered means it is ordinary text in the editor, so a person
 * can put a selection boundary in the middle of it, and a split there leaves half an
 * identifier lying in their file.
 */
const CONSTRUCTS = /\[\^cite:[^\]\n]*\]|\[\[[^\]\n]*\]\]|!\[[^\]\n]*\]\([^)\n]*\)/g;

/** A range widened, if it needs it, so that it cuts nothing in half. */
export type Whole = { start: number; end: number; widened: boolean };

/**
 * Push a range outwards until it breaks no construct.
 *
 * Outwards rather than inwards, and never refused. A whole citation moving somewhere the
 * person did not quite intend is visible and undoable; half of one left behind is their file
 * carrying text that means nothing, which is the outcome this whole file exists to prevent.
 *
 * `widened` is reported rather than done quietly, because it changes what moves and the
 * person is about to be shown what moves.
 */
export function wholeConstructs(text: string, start: number, end: number): Whole {
  let from = start;
  let to = end;

  for (const match of text.matchAll(CONSTRUCTS)) {
    const opens = match.index;
    const closes = opens + match[0].length;
    if (from > opens && from < closes) from = opens;
    if (to > opens && to < closes) to = closes;
  }

  return { start: from, end: to, widened: from !== start || to !== end };
}

/**
 * Where a position in the editor lands in the text on disk.
 *
 * Two different coordinate systems, and the whole reason splitting needs care. ProseMirror
 * counts **document positions**: entering a block costs one, leaving it costs one, a character
 * costs one, and a citation costs **one** no matter that it is thirty characters on disk. The
 * file counts characters. A selection handed to the engine as though the two agreed would cut
 * somebody's document in the wrong place.
 *
 * Walking both at once is the only honest way to do it, because the relationship is not a
 * formula: it depends on how many citations, links and pictures are in the way, and on whether
 * the blocks passed are headings, whose hashes exist on disk and nowhere in the editor.
 */
export function offsetOf(doc: JSONContent, target: number): number {
  let pos = 0;
  let out = 0;

  const blocks = doc.content ?? [];
  for (let i = 0; i < blocks.length; i += 1) {
    // At or before this block's opening token, which is the end of whatever came before it.
    //
    // Checked *before* the blank line between blocks is counted, and that order is the whole
    // of it: a selection ending at a paragraph break would otherwise drag the blank line after
    // it into what moves, and a split would take one more line than the person highlighted.
    if (target <= pos) return out;

    // Two characters on disk, and no positions at all in the editor.
    if (i > 0) out += 2;
    pos += 1; // entering the block

    const block = blocks[i];
    if (block?.type === HEADING) out += headingPrefix(block).length;

    for (const child of block?.content ?? []) {
      // A text node is as wide in the editor as it is on disk. Everything else is one
      // position and however many characters its syntax takes.
      const width = child.type === "text" ? (child.text ?? "").length : 1;
      if (target < pos + width) {
        return child.type === "text" ? out + (target - pos) : out;
      }
      pos += width;
      out += serializeInline(child).length;
    }

    if (target <= pos) return out;
    pos += 1; // leaving the block
  }

  return out;
}

/**
 * The hashes and the space a heading carries on disk, and nowhere in the editor.
 *
 * One definition, used both to write a heading and to measure it. Two would be two chances to
 * disagree, and a disagreement here is a split landing a character or two off.
 *
 * The level is clamped rather than trusted. A level outside 1-6 cannot come from `parseBody`
 * or from the editor's own schema, and writing `####### ` would be a line no reader treats as
 * a heading — so the document would silently stop saying what it said.
 */
function headingPrefix(block: JSONContent): string {
  return headingMarker(Number(block.attrs?.["level"] ?? 1));
}

/**
 * The hashes and the space, for a level.
 *
 * Exported because the editor needs the same answer when a selection starts at a heading: the
 * marker is before the content, so a person dragging from the first letter of a heading never
 * covers it, and a split has to reach back for it.
 */
export function headingMarker(level: number): string {
  const clamped = Math.min(Math.max(level || 1, 1), 6);
  return `${"#".repeat(clamped)} `;
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

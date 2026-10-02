// What a document can be exported as, and what the file is called.
//
// The engine makes the file and the shell writes it; this side only offers the choice and
// suggests a name. The order is the order the panel offers them in, and the first is the one
// chosen to begin with: a PDF, because it reads and prints the same on any computer, exactly as
// laid out; a web page, which opens anywhere and fits the screen it is read on; then the two to
// go on editing in; then plain text, which keeps the least.

import type { ExportFormat } from "./engine";

type Offered = {
  value: ExportFormat;
  label: string;
  extension: string;
  hint: string;
};

/** Never empty: the panel starts on the first. */
export const EXPORT_FORMATS: [Offered, ...Offered[]] = [
  {
    value: "pdf",
    label: "PDF",
    extension: "pdf",
    hint: "Exactly as it prints, on any computer. For sending, handing in, or paper.",
  },
  {
    value: "html",
    label: "Web page",
    extension: "html",
    hint: "Opens in any browser, pictures and all, and fits any screen.",
  },
  {
    value: "docx",
    label: "Word document",
    extension: "docx",
    hint: "To go on editing in Word or Google Docs. Headings and the reference list keep their styles.",
  },
  {
    value: "odt",
    label: "OpenDocument",
    extension: "odt",
    hint: "To go on editing in LibreOffice. The same as Word's, in an open standard.",
  },
  {
    value: "text",
    label: "Plain text",
    extension: "txt",
    hint: "Pastes into anything. Italics are lost, and pictures are named rather than shown.",
  },
];

export function formatOf(value: ExportFormat) {
  const found = EXPORT_FORMATS.find((f) => f.value === value);
  if (!found) throw new Error(`no export format ${value}`);
  return found;
}

/** What a file name cannot hold on Windows, macOS or Linux and only decorates a title. */
const DROPPED = '?*"<>|';

/**
 * The file name the save dialog suggests: the document's title, with the extension.
 *
 * Only what a file name cannot hold on some system is changed — a title in Finnish or Russian
 * is a perfectly good file name, and turning it into a slug would make the export harder to
 * recognise in a folder, not easier. A colon becomes a dash between spaces, as a title's
 * subtitle reads; a slash becomes a dash; a question mark or quotation marks are left out.
 */
export function exportName(title: string, format: ExportFormat): string {
  const base = Array.from(title.replace(/\s*:\s*/gu, " - "))
    .map((c) => {
      if (DROPPED.includes(c)) return "";
      if (c === "/" || c === "\\" || (c.codePointAt(0) ?? 0) < 0x20) return "-";
      return c;
    })
    .join("")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^\.+/u, "")
    .trim();
  return `${base || "Document"}.${formatOf(format).extension}`;
}

// Naming a work's editions and rows in the words somebody reads them in.
//
// Nothing here decides anything about alignment: the engine counted the rows and found what
// does not line up. This only says it.

import type { ResegmentPlan, Work, WorkEdition, WorkUnit } from "./engine";

/** Languages offered first. Any BCP 47 code can be typed instead. */
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "fi", name: "Finnish" },
  { code: "en", name: "English" },
  { code: "ru", name: "Russian" },
  { code: "sv", name: "Swedish" },
  { code: "et", name: "Estonian" },
  { code: "sr", name: "Serbian" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "la", name: "Latin" },
  { code: "el", name: "Greek" },
  { code: "uk", name: "Ukrainian" },
];

export const UNITS: { value: WorkUnit; label: string; hint: string }[] = [
  { value: "line", label: "By line", hint: "Songs and poems — every line break starts a row." },
  { value: "sentence", label: "By sentence", hint: "Prose, articles, letters." },
  { value: "paragraph", label: "By paragraph", hint: "Long text read in blocks." },
];

/** "Finnish" for `fi`, "Swiss German" never — the code itself for anything not listed. */
export function languageName(code: string): string {
  const primary = (code.split("-")[0] ?? code).toLowerCase();
  const known = LANGUAGES.find((l) => l.code === primary);
  return known ? (primary === code.toLowerCase() ? known.name : `${known.name} (${code})`) : code;
}

/** What a pane is called: its label if it has one, otherwise its kind and language. */
export function editionName(edition: WorkEdition): string {
  if (edition.label) return edition.label;
  const language = languageName(edition.language);
  switch (edition.kind) {
    case "original":
      return `Original (${language})`;
    case "pronunciation":
      return edition.scheme ? `Pronunciation (${edition.scheme})` : "Pronunciation";
    case "translation":
      return `${language} translation`;
  }
}

/** Rows, counted in the original. */
export function rowCount(work: Work): number {
  return work.editions.find((e) => e.kind === "original")?.rows.length ?? 0;
}

/** The longest edition's rows: how many rows a pane may need to draw. */
export function longest(work: Work): number {
  return Math.max(0, ...work.editions.map((e) => e.rows.length));
}

/** The editions out of line with the original, by id. */
export function misaligned(work: Work): Set<string> {
  return new Set(work.misalignments.map((m) => m.edition));
}

/** Why an edition is shown unaligned, in one sentence. */
export function misalignmentMessage(work: Work, edition: string): string | null {
  const m = work.misalignments.find((x) => x.edition === edition);
  const e = work.editions.find((x) => x.id === edition);
  if (!m || !e) return null;
  const more = m.rows > m.original_rows;
  const diff = Math.abs(m.rows - m.original_rows);
  return `${editionName(e)} has ${diff} row${diff === 1 ? "" : "s"} ${more ? "more" : "fewer"} than the original, so from somewhere its rows do not line up. Find where its meaning stops matching, then join, split or mark a row empty there.`;
}

export function noteFor(work: Work, row: number): string | null {
  return work.notes.find((n) => n.row === row)?.text ?? null;
}

/** The row this one repeats, if it is a repeat. */
export function repeatOf(work: Work, row: number): number | null {
  return work.repeats.find((r) => r.row === row)?.of ?? null;
}

/** How many later rows repeat this one. */
export function repeatedBy(work: Work, row: number): number {
  return work.repeats.filter((r) => r.of === row).length;
}

/** A row as text in an editor: its lines, one per line. */
export function rowText(lines: string[] | undefined): string {
  return (lines ?? []).join("\n");
}

/** A re-division plan in a sentence per edition. */
export function resegmentLines(plan: ResegmentPlan, work: Work): string[] {
  return plan.editions.map((e) => {
    const edition = work.editions.find((x) => x.id === e.edition);
    const name = edition ? editionName(edition) : "An edition";
    const parts = [`${e.rows_before} rows become ${e.rows_after}`];
    if (e.empty_lost > 0)
      parts.push(`${e.empty_lost} row${e.empty_lost === 1 ? "" : "s"} marked empty will go`);
    return `${name}: ${parts.join("; ")}.`;
  });
}

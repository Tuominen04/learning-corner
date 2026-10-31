import { describe, expect, it } from "vitest";

import type { Work, WorkEdition } from "./engine";
import { editionName, languageName, misalignmentMessage, repeatOf, rowCount } from "./works";

function edition(overrides: Partial<WorkEdition>): WorkEdition {
  return {
    id: "e",
    kind: "translation",
    language: "fi",
    scheme: null,
    label: null,
    source: null,
    rows: [],
    missing: false,
    ...overrides,
  };
}

function work(editions: WorkEdition[]): Work {
  return {
    id: "w",
    title: "Я вас любил",
    unit: "line",
    created: "2026-10-31T09:00:00Z",
    sources: [],
    editions,
    notes: [],
    repeats: [{ row: 3, of: 1 }],
    misalignments: [],
    revision: "r" as Work["revision"],
  };
}

describe("naming an edition", () => {
  it("uses its label first", () => {
    expect(editionName(edition({ label: "Leino 1921" }))).toBe("Leino 1921");
  });

  it("otherwise says its kind and language", () => {
    expect(editionName(edition({}))).toBe("Finnish translation");
    expect(editionName(edition({ kind: "original", language: "ru" }))).toBe("Original (Russian)");
    expect(editionName(edition({ kind: "pronunciation", language: "ru", scheme: "bgn-pcgn" }))).toBe(
      "Pronunciation (bgn-pcgn)",
    );
  });

  it("shows a code it does not know as the code", () => {
    expect(languageName("hy")).toBe("hy");
    expect(languageName("en-GB")).toBe("English (en-GB)");
  });
});

describe("rows", () => {
  const w = work([
    edition({ id: "o", kind: "original", language: "ru", rows: [["a"], ["b"], ["a"]] }),
    edition({ id: "f", rows: [["A"], ["B"], ["A"], ["extra"]] }),
  ]);

  it("are counted in the original", () => {
    expect(rowCount(w)).toBe(3);
  });

  it("know what they repeat", () => {
    expect(repeatOf(w, 3)).toBe(1);
    expect(repeatOf(w, 2)).toBeNull();
  });

  it("say plainly when an edition is out of line", () => {
    const out = { ...w, misalignments: [{ edition: "f", rows: 4, original_rows: 3 }] };
    expect(misalignmentMessage(out, "f")).toMatch(/^Finnish translation has 1 row more than the original/);
    expect(misalignmentMessage(out, "o")).toBeNull();
  });
});

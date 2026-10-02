import { describe, expect, it } from "vitest";

import type { Field, Source, SourceType } from "./engine";
import {
  blankSource,
  contributorName,
  emptyContributor,
  fieldsFor,
  fieldToEditable,
  isGroup,
  labelFor,
  missingLabel,
  tidy,
} from "./sources";

// `tidy` is the last thing a source passes through before it is written to the user's own
// files. Everything it drops is dropped for good, so each case below names what would be lost.

function book(over: Partial<Source> = {}): Source {
  return { ...blankSource("book"), title: "Ravinto ja terveys", ...over };
}

describe("tidy", () => {
  it("turns an empty box into nothing, not into an empty string", () => {
    // `""` and "not filled in" are different things on disk: one writes `publisher = ""` into
    // the file and reports the source as complete, the other reports it as missing a publisher.
    const cleaned = tidy(book({ publisher: "", doi: "   " }));
    expect(cleaned.publisher).toBeNull();
    expect(cleaned.doi).toBeNull();
  });

  it("keeps a field that only looks empty", () => {
    expect(tidy(book({ volume: "  12  " })).volume).toBe("12");
  });

  it("keeps a report's number, and drops an empty one", () => {
    expect(tidy(book({ type: "report", number: " 935 " })).number).toBe("935");
    expect(tidy(book({ type: "report", number: "  " })).number).toBeNull();
  });

  it("drops a contributor row nobody typed a name into", () => {
    // Every form starts with one blank row. Saving it as a contributor puts a nameless entry
    // into every citation of the source.
    const cleaned = tidy(book({ contributors: [emptyContributor("person")] }));
    expect(cleaned.contributors).toHaveLength(0);
  });

  it("keeps a person who has a family name but no given name", () => {
    // Plenty of authors are cited by one name. Requiring both would silently discard them.
    const cleaned = tidy(
      book({
        contributors: [
          { role: "author", family: "Aristotle", given: "", literal: null, abbreviation: null },
        ],
      }),
    );
    expect(cleaned.contributors).toHaveLength(1);
    expect(cleaned.contributors[0]?.family).toBe("Aristotle");
    expect(cleaned.contributors[0]?.given).toBeNull();
  });

  it("keeps a group author whole", () => {
    const cleaned = tidy(
      book({
        contributors: [
          {
            role: "author",
            family: null,
            given: null,
            literal: "World Health Organization",
            abbreviation: "WHO",
          },
        ],
      }),
    );
    expect(cleaned.contributors[0]?.literal).toBe("World Health Organization");
    expect(cleaned.contributors[0]?.abbreviation).toBe("WHO");
    expect(cleaned.contributors[0]?.family).toBeNull();
  });

  it("never mixes the two shapes of name", () => {
    // A row switched from person to group carries the old family name in its state. Writing
    // both is how a source ends up claiming an author who is half organisation.
    const cleaned = tidy(
      book({
        contributors: [
          {
            role: "author",
            family: "Nieminen",
            given: "Anna",
            literal: "World Health Organization",
            abbreviation: null,
          },
        ],
      }),
    );
    expect(cleaned.contributors[0]?.literal).toBe("World Health Organization");
    expect(cleaned.contributors[0]?.family).toBeNull();
    expect(cleaned.contributors[0]?.given).toBeNull();
  });

  it("leaves no-date alone", () => {
    // The one date value a person chooses rather than fails to fill in. APA 7 prints "n.d."
    // for it, and turning it into an absence here would print a blank year instead.
    expect(tidy(book({ date: { kind: "no-date" } })).date).toEqual({ kind: "no-date" });
  });

  it("drops an appraisal nobody wrote, and keeps a half-written one", () => {
    expect(tidy(book({ appraisal: { trust: "", note: "  " } })).appraisal).toBeNull();
    expect(tidy(book({ appraisal: { trust: "Peer-reviewed", note: null } })).appraisal).toEqual({
      trust: "Peer-reviewed",
      note: null,
    });
  });

  it("leaves the identifier exactly as it found it", () => {
    // A new source carries none and the engine assigns one; an edit carries the real one and
    // must keep it, or the save writes a second source instead of correcting the first.
    expect(tidy(book()).id).toBeNull();
    expect(tidy(book({ id: "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G" })).id).toBe(
      "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G",
    );
  });
});

describe("naming the parts of a source", () => {
  it("calls a container what it actually is for each type", () => {
    // The same field is a journal, a book, or a series. One fixed label would be wrong twice.
    expect(labelFor("container", "journal-article")).toBe("Journal");
    expect(labelFor("container", "book-chapter")).toBe("Book title");
    expect(labelFor("container", "audio")).toBe("Podcast");
  });

  it("names a missing field the same way the form does", () => {
    expect(missingLabel("publisher", "book")).toBe("publisher");
    expect(missingLabel("container", "journal-article")).toBe("journal");
    expect(missingLabel("authors", "book")).toBe("an author");
  });

  it("calls a number what it numbers", () => {
    expect(labelFor("number", "report")).toBe("Report number");
    expect(labelFor("number", "audio")).toBe("Episode number");
  });

  it("knows which required fields have a text box and which do not", () => {
    expect(fieldToEditable("publisher")).toBe("publisher");
    // Authors and dates have their own controls, so they are marked, not turned into a box.
    expect(fieldToEditable("authors")).toBeNull();
    expect(fieldToEditable("date")).toBeNull();
  });
});

describe("contributors", () => {
  it("tells the two shapes apart by the group name, not by the absence of a family name", () => {
    expect(isGroup(emptyContributor("group"))).toBe(true);
    expect(isGroup(emptyContributor("person"))).toBe(false);
  });

  it("reads a person as family, given and a group as its whole name", () => {
    expect(
      contributorName({
        role: "author",
        family: "Nieminen",
        given: "Anna Maria",
        literal: null,
        abbreviation: null,
      }),
    ).toBe("Nieminen, Anna Maria");
    expect(
      contributorName({
        role: "author",
        family: null,
        given: null,
        literal: "World Health Organization",
        abbreviation: "WHO",
      }),
    ).toBe("World Health Organization");
  });
});

describe("the fields a type offers", () => {
  // What the engine requires of each type, from `required_fields` in its source model.
  const REQUIRED: Record<SourceType, Field[]> = {
    book: ["authors", "date", "title", "publisher"],
    "book-chapter": ["authors", "date", "title", "editors", "container", "publisher", "pages"],
    "journal-article": ["authors", "date", "title", "container", "volume"],
    "web-page": ["authors", "date", "title", "site"],
    video: ["authors", "date", "title", "site"],
    audio: ["authors", "date", "title", "container"],
    report: ["authors", "date", "title", "publisher"],
  };

  it("never hides a field the type requires", () => {
    for (const [type, fields] of Object.entries(REQUIRED) as [SourceType, Field[]][]) {
      for (const field of fields) {
        const box = fieldToEditable(field);
        if (box) expect(fieldsFor(type), `${type} needs its ${box}`).toContain(box);
      }
    }
  });

  it("offers a number only where the reference prints one", () => {
    const numbered = (Object.keys(REQUIRED) as SourceType[]).filter((type) =>
      fieldsFor(type).includes("number"),
    );
    expect(numbered).toEqual(["audio", "report"]);
  });

  it("offers an edition where the entry prints one", () => {
    // A chapter's edition is the book's, printed beside its pages: (4th ed., pp. 115–129).
    const types = (Object.keys(REQUIRED) as SourceType[]).filter((type) =>
      fieldsFor(type).includes("edition"),
    );
    expect(types).toEqual(["book", "book-chapter", "report"]);
  });

  it("does not ask a web page for a volume, or a book for a journal", () => {
    expect(fieldsFor("web-page")).not.toContain("volume");
    expect(fieldsFor("book")).not.toContain("container");
  });

  it("offers a web address and a DOI for everything", () => {
    for (const type of Object.keys(REQUIRED) as SourceType[]) {
      expect(fieldsFor(type)).toEqual(expect.arrayContaining(["doi", "url"]));
    }
  });
});

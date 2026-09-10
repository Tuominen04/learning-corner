// What to call the parts of a source, and the small conversions the form needs.
//
// Labels live here rather than crossing the wire. The engine decides which fields a type
// *requires* — that is a fact about APA 7 and belongs with the formatters — but what to call a
// field to somebody filling in a form is presentation, and presentation is this side's job.

import type { Contributor, Field, Role, Source, SourceType } from "./engine";

export const SOURCE_TYPES: { value: SourceType; label: string; hint: string }[] = [
  { value: "book", label: "Book", hint: "A whole book by one or more authors" },
  {
    value: "book-chapter",
    label: "Chapter in a book",
    hint: "One chapter someone wrote inside someone else's book",
  },
  {
    value: "journal-article",
    label: "Journal article",
    hint: "A paper in an academic journal",
  },
  { value: "web-page", label: "Web page", hint: "Anything you read on the web" },
  { value: "video", label: "Video", hint: "A talk, lecture or anything else you watched" },
  { value: "audio", label: "Audio", hint: "A podcast episode, recording or broadcast" },
  { value: "report", label: "Report", hint: "Published by an organisation rather than a person" },
];

export const ROLES: { value: Role; label: string }[] = [
  { value: "author", label: "Author" },
  { value: "editor", label: "Editor" },
  { value: "translator", label: "Translator" },
  { value: "director", label: "Director" },
  { value: "host", label: "Host" },
];

/** The fields a form can ask for, in the order they read best. */
export type Editable =
  | "container"
  | "publisher"
  | "site"
  | "volume"
  | "issue"
  | "pages"
  | "edition"
  | "doi"
  | "url";

export const EDITABLE_ORDER: Editable[] = [
  "container",
  "publisher",
  "site",
  "volume",
  "issue",
  "pages",
  "edition",
  "doi",
  "url",
];

/**
 * What to call each field, and what to say when the name alone is not enough.
 *
 * `container` is the awkward one: it is a journal for an article, a book for a chapter and a
 * series for an episode, so its label depends on the type rather than being fixed.
 */
export function labelFor(field: Editable, type: SourceType): string {
  if (field === "container") {
    switch (type) {
      case "journal-article":
        return "Journal";
      case "book-chapter":
        return "Book title";
      case "audio":
        return "Series or programme";
      default:
        return "Part of";
    }
  }
  const labels: Record<Exclude<Editable, "container">, string> = {
    publisher: "Publisher",
    site: "Site name",
    volume: "Volume",
    issue: "Issue",
    pages: "Pages",
    edition: "Edition",
    doi: "DOI",
    url: "Web address",
  };
  return labels[field];
}

export function hintFor(field: Editable): string | null {
  switch (field) {
    case "pages":
      return "A single page or a range: 44, or 44–58";
    case "doi":
      return "The permanent identifier a journal assigns. Prefer it to a web address.";
    case "site":
      return "Whose site it is, not the page title: BBC News, Wikipedia";
    default:
      return null;
  }
}

/** Which editable field a required-field report refers to, if any. */
export function fieldToEditable(field: Field): Editable | null {
  switch (field) {
    case "container":
      return "container";
    case "publisher":
      return "publisher";
    case "site":
      return "site";
    case "volume":
      return "volume";
    case "pages":
      return "pages";
    // Authors, editors, date and title have their own controls rather than being text boxes.
    default:
      return null;
  }
}

/**
 * What to call a missing field when telling somebody what a source still needs.
 *
 * The fallback is not dead code: the engine owns the list of fields, and one added there
 * reaches this build as a string nothing here has a phrase for. Naming it plainly beats
 * saying nothing, which is what a bare `switch` would do.
 */
export function missingLabel(field: Field, type: SourceType): string {
  const editable = fieldToEditable(field);
  if (editable) return labelFor(editable, type).toLowerCase();
  switch (field) {
    case "authors":
      return "an author";
    case "editors":
      return "an editor";
    case "date":
      return "a date";
    case "title":
      return "a title";
    default:
      return String(field);
  }
}

/** A contributor with no name in it yet — the row a person starts filling in. */
export function emptyContributor(kind: "person" | "group"): Contributor {
  return kind === "person"
    ? { role: "author", family: "", given: "", literal: null, abbreviation: null }
    : { role: "author", family: null, given: null, literal: "", abbreviation: null };
}

export function isGroup(contributor: Contributor): boolean {
  return contributor.literal !== null;
}

/** How a contributor reads in a list: a family name, or the whole group name. */
export function contributorName(contributor: Contributor): string {
  if (isGroup(contributor)) return contributor.literal ?? "";
  const family = contributor.family ?? "";
  const given = contributor.given ?? "";
  return given ? `${family}, ${given}` : family;
}

/** A blank source of the given type. */
export function blankSource(type: SourceType): Source {
  return {
    id: null,
    type,
    title: "",
    date: { kind: "year", year: new Date().getFullYear() },
    contributors: [emptyContributor("person")],
    container: null,
    publisher: null,
    site: null,
    volume: null,
    issue: null,
    pages: null,
    edition: null,
    doi: null,
    url: null,
    retrieved: null,
    appraisal: null,
  };
}

/**
 * Trim a source on its way to being saved.
 *
 * Empty boxes become `null` rather than `""`, and contributors with no name at all are
 * dropped. A row somebody started and abandoned is not a contributor, and saving it as one
 * puts a nameless entry in every citation of the source.
 */
export function tidy(source: Source): Source {
  const text = (value: string | null): string | null => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
  };

  const contributors = source.contributors
    .map((c) => ({
      role: c.role,
      family: c.literal === null ? text(c.family) : null,
      given: c.literal === null ? text(c.given) : null,
      literal: c.literal === null ? null : text(c.literal),
      abbreviation: c.literal === null ? null : text(c.abbreviation),
    }))
    .filter((c) => c.family !== null || c.literal !== null);

  const appraisal =
    text(source.appraisal?.trust ?? null) === null &&
    text(source.appraisal?.note ?? null) === null
      ? null
      : {
          trust: text(source.appraisal?.trust ?? null),
          note: text(source.appraisal?.note ?? null),
        };

  return {
    ...source,
    title: source.title.trim(),
    contributors,
    container: text(source.container),
    publisher: text(source.publisher),
    site: text(source.site),
    volume: text(source.volume),
    issue: text(source.issue),
    pages: text(source.pages),
    edition: text(source.edition),
    doi: text(source.doi),
    url: text(source.url),
    appraisal,
  };
}

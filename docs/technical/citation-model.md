# Citation model

> **Audience:** People building Personal Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-10-02

APA 7 is a specification, and this is the part of the product where being approximately right
is the same as being wrong. This document is what the engine implements and what the
[test fixtures](testing.md) assert against.

## The central decision

**A source is structured data. A citation is generated.** Nothing formatted is ever stored:
not in the document, not in the source file, not in the index. The document stores
`[^cite:<source-id>@44-46]` and the reference string is produced on demand.

Everything good follows from this: correcting a source once fixes every document citing it;
the same source cites correctly in two different in-text forms; and a second citation style
becomes a second formatter over the same data rather than a re-entry of the whole library.

## Source types

The type selects the required fields. Start with these seven, which cover what a learner
actually cites, and extend from the APA manual's reference examples as needed.

| Type | Required | Also used |
| ---- | -------- | --------- |
| `book` | authors, year, title, publisher | edition, translators, DOI/URL |
| `book-chapter` | authors, year, title, editors, container, publisher, pages | edition, DOI/URL |
| `journal-article` | authors, year, title, container, volume | issue, pages, DOI/URL |
| `web-page` | authors, date, title, site | DOI/URL, retrieval date |
| `video` | authors, date, title, site | DOI/URL, retrieval date, timestamp |
| `audio` | authors, date, title, container | episode number, publisher, DOI/URL, retrieval date |
| `report` | authors, year, title, publisher | edition, report number, DOI/URL |

The form offers exactly these fields for each type and no others. A box the reference entry
never reads would keep whatever was typed into it and never show it.

`audio` is a **podcast episode**, the audio a learner cites most: the container is the podcast,
and the entry says `[Audio podcast episode]`. Other audio — a song, a radio broadcast — has its
own APA form, and is not modelled yet.

`number` is a report's number or an episode's. A bare number takes the usual label —
`(Report No. 935)`, `(No. 443)` — and one written with its own label prints exactly as typed:
`(NIH Publication No. 18-2059)`. An `edition` written as a number becomes an ordinal: `2` prints
as `2nd ed.`; anything else (`Rev. ed.`) prints as typed.

### Contributors

Stored as roles, not one string: `author`, `editor`, `translator`, `director`, `host`. Each
has `family` and `given`, and a `literal` alternative for group authors ("World Health
Organization") and for names that do not decompose into family and given. Assuming every name
in the world splits into two Western parts is a bug, not a simplification.

**A podcast's host stands where its author would.** An `audio` source with no author is cited
by its hosts, and they count as its authors wherever authors matter — disambiguation, ordering,
and whether the source is complete. The reference list says so: `Glass, I. (Host).`

Initials keep a hyphen: Jean-Paul is `J.-P.`

### Dates

Year alone for most types; full dates for web pages, videos, and anything else where the day
matters. Absent dates are `n.d.` — modelled explicitly as *no date*, never as a missing
value that formats as an empty string.

### Incomplete sources

A source missing a required field is stored, is citable, and is flagged as incomplete, with
the missing fields named. It is never rejected and no field is ever invented or defaulted.

A user who cannot immediately find a publisher will either save an incomplete source or lose
the source. The application must make the first outcome the easy one, and then be
conspicuous about the gap: incomplete sources are marked in the source list, in every
document citing them, and in `library.status`.

## In-text citations

Two forms, chosen per citation:

| Form | Output |
| ---- | ------ |
| Parenthetical | `(Nieminen, 2021, p. 44)` |
| Narrative | `Nieminen (2021)` |

The rules the engine must implement:

| Case | Parenthetical | Narrative |
| ---- | ------------- | --------- |
| One author | `(Nieminen, 2021)` | `Nieminen (2021)` |
| Two authors | `(Nieminen & Kallio, 2021)` | `Nieminen and Kallio (2021)` |
| Three or more | `(Nieminen et al., 2021)` | `Nieminen et al. (2021)` |
| Group author, first use | `(World Health Organization [WHO], 2019)` | `World Health Organization (WHO, 2019)` |
| Group author, later uses | `(WHO, 2019)` | `WHO (2019)` |
| No author, title in italics in the list | `(*Kalevala*, 1849)` | `*Kalevala* (1849)` |
| No author, any other title | `(“Protein requirements,” 2021)` | `“Protein requirements” (2021)` |
| No date | `(Nieminen, n.d.)` | `Nieminen (n.d.)` |

Note the ampersand: `&` inside parentheses, the word `and` in narrative form. This is APA 7,
and it is exactly the kind of detail a person should never have to think about.

A title standing in for an absent author is in italics where the reference list italicises it,
and in quotation marks where it does not. The comma inside the closing quote separates it from
the year, so it appears in the parenthetical form only.

Three or more authors abbreviate to *et al.* from the **first** citation onwards. This
changed in APA 7 from APA 6, and anyone reviewing this code against memory will assume the
old rule.

### Disambiguation

Three cases, all of which must be handled globally rather than per document, because the same
source must cite identically everywhere:

**Same author, same year, different works.** Suffix the year `a`, `b`, `c`, assigned by
alphabetical order of the reference-list titles, and applied consistently everywhere — in
text and in the reference list. The titles are ordered as the list orders them, passing over a
leading *A*, *An* or *The*. Undated works take the letter after a hyphen: `(Nieminen, n.d.-a)`.

**Different authors, same surname.** Include initials in text: `(A. Nieminen, 2021)` and
`(J. Nieminen, 2019)`.

**Different works shortening to the same *et al.* form.** Expand names until they differ:
`(Chen, Wang, et al., 2020)` and `(Chen, Liu, et al., 2020)`.

The third one is the trap. It cannot be decided from a single citation, only from the whole
set of sources, so it belongs to a library-wide pass and not to a per-citation function.
Structure the formatter accordingly: compute a disambiguation table for the library, then
format each citation against it.

### Locators

The locator is stored raw and formatted by kind: `p. 44`, `pp. 44-46`, `para. 3`,
`Chapter 2`, `1:14:22` for a timestamp. Ranges use an en dash on output.

## Claims

A **claim** is the sentence a citation belongs to. A citation belongs to the sentence it sits
in, or — sitting exactly between two sentences — to the one before it, because citations
follow the claims they support and that is where the editor puts them. Several citations
behind one sentence make one claim.

Sentences are found with the platform's own sentence rules (`Intl.Segmenter`), so a decimal
point ends nothing and Finnish and Russian are split the way English is; plain punctuation is
the fallback where those rules are missing.

Claims are worked out by the interface from the text on screen, and never stored: a claim is a
reading of a document, not a fact about its file. What the engine stores is the citation, and
the claim follows from where it was put.

## The reference list

Generated per document from the sources it actually cites.

**Ordering.** Alphabetically by the authors — the whole list, so `Nieminen, A.` comes before
`Nieminen, A., & Kallio, K.` — then by year ascending, with undated works first, then by title
without a leading *The*, *A* or *An*. Group authors alphabetise by their full name, never their
abbreviation. Sources with no author alphabetise by title, passing over the same articles.

Comparison is case-folded and in Unicode character order. That files Finnish `ä` and `ö` after
`z`, where they belong, and Cyrillic in alphabetical order. It is not yet full locale
collation, which differs in three places a user of this application could meet:

- Finnish files `å` before `ä`; character order puts `ä` first.
- Russian files `ё` with `е`; character order puts it after `я`.
- An accented Latin letter files with its base letter, *Lévy* before *Lewis*; character order
  puts it after `z`.

**Formatting**, per type, from the APA manual's examples:

- **Who, when, what.** With no author, the title takes the author's place and the date follows
  it: `*Kalevala*. (1849). Suomalaisen Kirjallisuuden Seura.`
- **Italics for works that stand alone** — books, reports, web pages, videos — and not for parts
  of something larger: articles, chapters, episodes. The journal, the edited book and the
  podcast they sit in are italicised, along with a journal's volume number.
- **Titles exactly as typed.** APA wants titles in sentence case, and the form says so; the
  engine never changes case itself, because it cannot tell a proper noun from an ordinary
  word, and *Finnish* turned into *finnish* is worse than a title left as typed.
- **What travels with the title**, in APA's order: translators then edition for a book —
  `(H. Weaver, Trans.; 2nd ed.)`; edition then number for a report; the episode number and
  `[Audio podcast episode]` for audio; `[Video]` for a video.
- **Editors** with initials first, joined by an ampersand: `In R. F. Subotnik, P.
  Olszewski-Kubilius, & F. C. Worrell (Eds.), *Book title* (2nd ed., pp. 345–359).`
- **A publisher or site that is the author over again is left out**: the World Health
  Organization's own page names it once.
- **No full stop after a title that ends in `?` or `!`.**
- DOIs as `https://doi.org/10.xxxx/yyyy`.
- A retrieval date **only** where content is designed to change and is not archived — not on
  every web page. Getting this wrong is the most common APA 7 error in the wild.
- Twenty or fewer authors: all listed. Twenty-one or more: first nineteen, an ellipsis, then
  the final author.

**Hanging indent** of 0.5 inch on export. It is the reference list's most recognisable
feature and the thing a reader notices missing.

### Not yet modelled

Each of these is printed by the rule above rather than wrongly, but a reviewer comparing
against the manual will find them:

- **In-text titles are not title-cased.** APA title-cases a title standing in for an author in
  the text. Titles are printed as typed everywhere, for the reason above.
- **Original publication dates** — `(Original work published 1943)` — have no field.
- **Locale collation**, in the three places named under *Ordering*.
- **Audio other than podcast episodes.**

## Structure of the implementation

Three separable pieces, in this order of dependency:

1. **The source model** — types, fields, contributors, dates, validation. No formatting.
2. **The disambiguation pass** — over a whole library, producing year suffixes, initial
   requirements, and expanded *et al.* forms.
3. **The formatters** — in-text and reference-list, pure functions from (source,
   disambiguation, options) to a string.

Only the third is style-specific. Adding a second citation style later touches that layer
and nothing else, which is the point.

## Testing

Table-driven fixtures: a source record, the expected parenthetical form, the expected
narrative form, and the expected reference entry — taken from the APA manual's own examples
so the expectations have an authority behind them. Every rule on this page gets at least one
fixture, and every disambiguation case gets a multi-source one. See [Testing](testing.md).

In the engine they are `tests/apa/`, one file per type, each case the source exactly as a
library stores it. Adding an example from the manual is a few lines of TOML, not a new test.
The rules that need more than one source to see — disambiguation and ordering — are in
`tests/citations.rs`.

## Related

- [Storage format](storage-format.md#sources) — how a source is stored
- [Engine contract](backend-contract.md#sources-and-citations) — the operations
- [Sources and citations](../user/sources-and-citations.md) — what the user sees

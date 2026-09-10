# Citation model

> **Audience:** People building Personal Learning Corner
> **Status:** In progress
> **Last reviewed:** 2026-09-10

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
| `journal-article` | authors, year, title, container, volume | issue, pages, DOI |
| `web-page` | authors, date, title, site | URL, retrieval date |
| `video` | authors, date, title, site | URL, timestamp |
| `audio` | authors, date, title, container | URL |
| `report` | authors, year, title, publisher | series number, DOI/URL |

### Contributors

Stored as roles, not one string: `author`, `editor`, `translator`, `director`, `host`. Each
has `family` and `given`, and a `literal` alternative for group authors ("World Health
Organization") and for names that do not decompose into family and given. Assuming every name
in the world splits into two Western parts is a bug, not a simplification.

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
| No author | `("Protein requirements," 2021)` | title in the author position |
| No date | `(Nieminen, n.d.)` | `Nieminen (n.d.)` |

Note the ampersand: `&` inside parentheses, the word `and` in narrative form. This is APA 7,
and it is exactly the kind of detail a person should never have to think about.

Three or more authors abbreviate to *et al.* from the **first** citation onwards. This
changed in APA 7 from APA 6, and anyone reviewing this code against memory will assume the
old rule.

### Disambiguation

Three cases, all of which must be handled globally rather than per document, because the same
source must cite identically everywhere:

**Same author, same year, different works.** Suffix the year `a`, `b`, `c`, assigned by
alphabetical order of the reference-list titles, and applied consistently everywhere — in
text and in the reference list.

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

## The reference list

Generated per document from the sources it actually cites.

**Ordering.** Alphabetically by the first contributor's family name, then by year ascending,
then by title. Group authors alphabetise by their full name. Sources with no author
alphabetise by title. Sorting is locale-aware — this is a multilingual application, and byte
order is not alphabetical order in Finnish or Russian.

**Formatting**, per type, from the APA manual's examples:

- Article and chapter and book titles in sentence case; journal and site names in title case.
- Book titles and journal names italicised, along with the volume number.
- DOIs as `https://doi.org/10.xxxx/yyyy`.
- A retrieval date **only** where content is designed to change and is not archived — not on
  every web page. Getting this wrong is the most common APA 7 error in the wild.
- Twenty or fewer authors: all listed. Twenty-one or more: first nineteen, an ellipsis, then
  the final author.

**Hanging indent** of 0.5 inch on export. It is the reference list's most recognisable
feature and the thing a reader notices missing.

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

## Related

- [Storage format](storage-format.md#sources) — how a source is stored
- [Engine contract](backend-contract.md#sources-and-citations) — the operations
- [Sources and citations](../user/sources-and-citations.md) — what the user sees

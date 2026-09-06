# Documentation conventions

> **Audience:** Anyone editing documentation in this repository
> **Status:** Implemented
> **Last reviewed:** 2026-09-06

Documentation here lives in two trees, and they never blend. This page is the rule that
keeps them apart after the people who set it up have forgotten why.

## The two trees

|                     | `docs/user/`                                      | `docs/technical/`                                    |
| ------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Written for         | someone **using** the app                         | someone **building** the app                          |
| Answers             | "How do I do this?"                               | "How does this work, and why is it built this way?"  |
| Voice               | "Choose **Import**, then pick your drive."        | "The importer compares content digests per file."    |
| Must never contain  | technology names, file formats, internal paths, code, anything from the banned list below | a justification of why the feature matters to a person — link to the user page instead |
| Outbound links      | to other user pages freely; **one** line at the foot may point developers to `docs/technical/` | to anywhere, including user pages, for intent |

If you find yourself explaining a mechanism in `docs/user/`, the explanation belongs in
`docs/technical/`, and the user page should say what the person sees instead. If you find
yourself selling a feature in `docs/technical/`, cut it and link to the user page.

## Every page starts with a header

Four lines, directly under the title:

```markdown
# Page title

> **Audience:** …
> **Status:** Planned
> **Last reviewed:** YYYY-MM-DD
```

`Status:` is one of:

| Status         | Meaning                                                             |
| -------------- | ------------------------------------------------------------------- |
| `Planned`      | Described here, not built yet. The page is a specification.          |
| `In progress`  | Partly built. The page describes the intended end state.             |
| `Implemented`  | The page describes software that exists and behaves this way.        |

This matters more than it looks. Almost everything in this repository is `Planned` today.
Without the marker, the user documentation would be describing an application that cannot
be installed — and quietly lying to the first person who tries. With it, the same pages are
an honest specification now and honest documentation later, with no rewrite in between.

**When you ship a feature, update the `Status:` line on both its user page and its technical
page in the same change.** A pull request that changes behaviour without touching a `Status:`
line is incomplete.

## Naming

- Files are `kebab-case.md`.
- One topic per page. If a page needs an "and also" section, it is two pages.
- Words that appear in both trees are defined once, in
  [`user/glossary.md`](user/glossary.md). Technical pages use the same words for the same
  things — never a second internal name for a concept the user already has a name for.

## Banned words in `docs/user/`

`docs/check-docs.sh` fails if any page under `docs/user/` contains one of these, whatever
the casing:

```
Rust · Tauri · SQLite · JSON · YAML · TOML · npm · cargo · Node.js
API · endpoint · schema · database · IPC · daemon · serialise/serialize
SHA-256 · hash · checksum · front matter · git · GitHub · source code · repository
```

The list is short on purpose. It is not a style guide — it is a tripwire for the one failure
mode this split exists to prevent, which is technical detail drifting into the user tree one
harmless-looking sentence at a time. Add to it when you catch a new leak.

If a banned word is genuinely unavoidable on a user page, that is a strong signal the page
is explaining the wrong thing. Rewrite the sentence around what the person does and sees.

## Checking your work

```bash
bash docs/check-docs.sh
```

It verifies three things: every page has its header, every relative link resolves, and no
banned word appears under `docs/user/`. Run it before committing.

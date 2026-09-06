# Documentation

> **Audience:** Everyone
> **Status:** In progress
> **Last reviewed:** 2026-09-06

Documentation for Personal Learning Corner is split in two, and the split is deliberate:
a person using the app should never have to read about how it is built, and a person
building it should never have to wade through a tutorial to find the data model.

| Tree                             | Read it if you want to…                       |
| -------------------------------- | --------------------------------------------- |
| **[User guide](user/)**          | use the app                                    |
| **[Technical docs](technical/)** | build, change, or package the app              |

Editing either tree? Read **[CONVENTIONS.md](CONVENTIONS.md)** first — it defines what
belongs where, and `docs/check-docs.sh` enforces part of it.

---

## User guide

Start at **[Getting started](user/getting-started.md)**.

| Page                                                     | What it covers                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| [Getting started](user/getting-started.md)               | Installing on Fedora, creating your first library, a short tour        |
| [Libraries and your files](user/libraries-and-files.md)  | What a library is, where it lives, using more than one, moving it      |
| [Topics and documents](user/documents-and-topics.md)     | Writing, splitting a topic as it grows, linking documents together     |
| [Sources and citations](user/sources-and-citations.md)   | Saving sources, citing them, the automatic APA 7 reference list        |
| [Parallel texts](user/parallel-texts.md)                 | Original, pronunciation, and translation side by side                  |
| [Mind maps](user/mind-maps.md)                           | Seeing how your topics connect, in its own window                      |
| [Backup and restore](user/backup-and-restore.md)         | Copying to a drive, restoring, and deciding which copy is right        |
| [FAQ](user/faq.md)                                       | Short answers to the common questions                                  |
| [Glossary](user/glossary.md)                             | What the words mean                                                    |

## Technical documentation

Start at **[Architecture](technical/architecture.md)**, then
**[Roadmap](technical/roadmap.md)**.

| Page                                                        | What it covers                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| [Architecture](technical/architecture.md)                   | The shape of the system and the principles behind it               |
| [Stack](technical/stack.md)                                 | What we build with, and what we deliberately leave out             |
| [Repositories](technical/repositories.md)                   | The interface repo, the engine repo, and how they stay in step     |
| [Engine contract](technical/backend-contract.md)            | Every operation the interface may ask the engine to perform        |
| [Storage format](technical/storage-format.md)               | The on-disk library: layout, file shapes, identifiers              |
| [Search index](technical/search-index.md)                   | The derived index — what it holds and why deleting it is safe      |
| [Citation model](technical/citation-model.md)               | Modelling APA 7 properly: source types, in-text forms, ordering    |
| [Parallel text model](technical/parallel-text-model.md)     | Works, editions, segments, and alignment                           |
| [Backup and synchronisation](technical/backup-and-sync.md)  | Mirroring, comparison, conflict rules, the never-lose-data promise |
| [Packaging for Fedora](technical/packaging-fedora.md)       | RPM and Flatpak, directories, updates                              |
| [Testing](technical/testing.md)                             | What is tested, and how, without a server to test against          |
| [Roadmap](technical/roadmap.md)                             | Milestones, in order, with what "done" means for each              |
| [Decision records](technical/adr/)                          | Why the big choices were made, and what they cost                  |

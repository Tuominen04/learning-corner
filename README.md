# Personal Learning Corner

A local-first application for learning things properly: your notes, the sources behind them,
and the texts you are working through — all stored as ordinary files on your own machine,
backed up to your own drive, and readable without ever asking anyone's permission.

## Why

The internet has more information than anyone can read, and no reliable way to tell what in
it is true. Personal Learning Corner takes the opposite approach to a search box:

> **Nothing is recorded as fact without a source you chose.**

Every claim you write down can be anchored to a source you saved and decided to trust. The
app builds the [APA 7](https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/index.html)
reference list for you, so citing properly costs you nothing and skipping it is the thing
that feels wrong.

## What it does

**Topics and documents.** You start with one question and end up with ten. Say you want to
know what a protein is — soon you have separate documents for protein types, protein
sources, human organs, and how protein behaves in the body, each citing its own sources and
linked to the others.

**Parallel texts.** Read a text in its original language with the pronunciation underneath
and a translation beside it — Russian original, transliteration, Finnish and English, and
you choose which of those are on screen. Song lyrics and historical documents work the same
way.

**Mind maps.** See how your topics actually connect, in a window of its own, built from the
documents you already wrote rather than a second copy of them.

**Your files, your drive.** You choose the folder your library grows in. Back it up to an
external drive whenever it is plugged in. If the two copies ever disagree, the app asks you
which one is right rather than guessing — and never throws the other one away.

## Status

**Planning.** No code yet. The documentation below is the specification we are building
towards; every page is marked `Planned`, `In progress`, or `Implemented` so it is always
clear which is which.

The first release targets **Fedora**, packaged natively. Windows and macOS come after the
Linux build is solid — the application is built so that adding them is packaging work, not
a rewrite.

## Documentation

| If you want to…              | Read                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| Use the app                  | **[User guide](docs/user/)** — start at [Getting started](docs/user/getting-started.md) |
| Build or change the app      | **[Technical docs](docs/technical/)** — start at [Architecture](docs/technical/architecture.md) |
| Know why it is built this way | **[Decision records](docs/technical/adr/)**                |
| Write documentation for it   | **[Conventions](docs/CONVENTIONS.md)**                     |

The two documentation trees are kept strictly apart: the user guide never mentions how the
app is built, and the technical docs never repeat the tutorial. See
[CONVENTIONS.md](docs/CONVENTIONS.md) for the rule and the check that enforces it.

## Design principles

1. **Local first, and local only.** No account, no server, no telemetry, no network
   dependency for anything that matters. The app must work on a machine that has never been
   online.
2. **Plain files are the truth.** Everything you write is a readable file in a folder you
   picked. Any index the app keeps is a convenience it can rebuild from those files — delete
   it and nothing is lost.
3. **Never lose the user's data.** No operation silently overwrites or discards anything you
   wrote. When two copies disagree, you decide, and the copy you did not pick is kept.
4. **Sources are first-class.** A citation is structured information, not a line of text you
   typed at the bottom of a page.
5. **Your library outlives the app.** If this project stopped tomorrow, your folder would
   still open in any text editor.

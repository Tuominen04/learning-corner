# Learning Corner

A desktop app for learning things properly: your notes, the sources behind them, and the texts
you are working through — stored as ordinary files in a folder you choose, on your own machine.
No account, no cloud, no internet connection needed.

> **Nothing is recorded as fact without a source you chose.**

Every claim you write down can be anchored to a source you saved and decided to trust, and the
app builds the [APA 7](https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/index.html)
reference list for you.

## What it does

**Topics and documents.** You start with one question and end up with ten. Say you want to know
what a protein is — soon you have separate documents for protein types, protein sources, human
organs, and how protein behaves in the body, each citing its own sources and linked to the
others.

**Sources and citations.** Save books, articles, web pages, PDFs and more as sources. Cite them
as you write; the reference list and in-text citations are worked out for you. Search across
everything, and export to PDF, Word, OpenDocument, a web page or plain text.

**Parallel texts** *(coming)*. Read a text in its original language with the pronunciation
underneath and a translation beside it — Russian original, transliteration, Finnish and English,
and you choose which of those are on screen.

**Mind maps** *(coming)*. See how your topics actually connect, built from the documents you
already wrote rather than a second copy of them.

**Backup to your own drive.** Back your library up to an external drive whenever it is plugged
in, and bring back what you changed on it somewhere else. If a file changed in both places, the
app asks you which one is right — and never throws the other one away.

## Start here

**Installing.** Download the latest release from the
[Releases](https://github.com/Tuominen04/learning-corner/releases) page:

| System | File |
| --- | --- |
| Fedora | `learning-corner-<version>.x86_64.rpm` — then `sudo dnf install ./learning-corner-*.rpm` |
| Debian, Ubuntu | `learning-corner_<version>_amd64.deb` |
| Any other Linux | `learning-corner-<version>-x86_64.AppImage` — make it executable and run it |

Fedora is the system it is tested on; the other two are built the same way but tested less.
Each release has a `SHA256SUMS` file and a build attestation — see
[Verifying a download](SECURITY.md#verifying-a-download). Windows and macOS come after the Linux
build is solid.

**Building from source** on Fedora:

```sh
sudo dnf install webkit2gtk4.1-devel libsoup3-devel \
                 libappindicator-gtk3-devel librsvg2-devel openssl-devel
sudo dnf group install "c-development"
# plus Node 22+ and rustup, if you do not have them

git clone https://github.com/Tuominen04/learning-corner
cd learning-corner
npm install
npm run tauri dev
```

The first run compiles everything from scratch and takes several minutes. Use the window it
opens, not the `localhost` address it prints. [Development](docs/technical/development.md) has the
details.

**Using it.** The [user guide](docs/user/) starts at
[Getting started](docs/user/getting-started.md): from nothing to a library with a document and a
cited source in it.

## Privacy

Learning Corner is built so that your notes are yours alone. That is a design rule, not a
setting.

- **No network.** The app makes no network requests — no telemetry, no analytics, no crash
  reports, no update checks, no fonts or images fetched from anywhere. It works on a computer
  that has never been online.
- **No account.** There is nothing to sign up for and nothing to sign in to.
- **Your files, in your folder.** Everything you write is a plain file in a folder you chose.
  The app keeps exactly one thing outside it: the list of libraries you opened recently, in
  `~/.config/learning-corner/`.
- **Backups go where you say.** To a drive you plug in — never to a server.
- **Nothing hidden.** The only program the app hands anything to is your own PDF viewer, when you
  ask it to open a PDF you saved.

You do not have to take this on trust. The window is forbidden from loading anything that is not
part of the app itself ([`tauri.conf.json`](src-tauri/tauri.conf.json), `security.csp`), and may
only reach your files through the open and save dialogs you click
([`capabilities/default.json`](src-tauri/capabilities/default.json)). The engine that reads and
writes your library — [learning-corner-engine](https://github.com/Tuominen04/learning-corner-engine)
— contains no network code at all.

## Status

**0.20.0 adds Milestone 2: backup and restore.** Back up to a drive you choose, bring back what
was changed on it, and restore a library from it onto another computer — every version replaced
on the way kept, so nothing is lost.

**0.19.2 was the first release: Milestone 1.** Libraries, topics and documents; sources, with
APA 7 citations and reference lists worked out for you; claims marked against what they cite;
search; and export to PDF, Word, OpenDocument, a web page and plain text.

Parallel texts and mind maps come next, in the order the
[roadmap](docs/technical/roadmap.md) gives. Every documentation page is marked `Planned`,
`In progress`, or `Implemented`, so it is always clear which parts exist.

## Get involved

| You want to… | Go to |
| --- | --- |
| report a problem | [Issues](https://github.com/Tuominen04/learning-corner/issues/new/choose) |
| suggest an idea, ask a question, give feedback | [Discussions](https://github.com/Tuominen04/learning-corner/discussions) |
| send a fix or an improvement | [CONTRIBUTING.md](CONTRIBUTING.md) |
| report a security problem | privately — see [SECURITY.md](SECURITY.md) |

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

## Why

The internet has more information than anyone can read, and no reliable way to tell what in it
is true. Learning Corner takes the opposite approach to a search box: you decide what you trust,
write down what you learned from it, and the app keeps the two tied together.

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

## Licence

Dual licensed under [MIT](LICENSE-MIT) or [Apache 2.0](LICENSE-APACHE), at your option.

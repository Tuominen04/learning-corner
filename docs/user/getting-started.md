# Getting started

> **Audience:** People using Learning Corner
> **Status:** In progress — installing and steps 2 to 5 work; backup comes in a later version
> **Last reviewed:** 2026-10-17

This page takes you from nothing to a first document with a source behind it. Fifteen
minutes, and you never need to be online.

## 1. Install

Learning Corner runs on **Fedora** first. Support for Windows and macOS is planned
but not available yet.

**From the downloaded package**

1. Download the installer for Fedora — the file ending in `.rpm` — from the releases page.
2. Open it with your software installer, or from a terminal:
   ```
   sudo dnf install ./learning-corner-*.rpm
   ```
3. Find **Learning Corner** in your applications menu.

On another Linux system, the same page has a `.deb` package for Debian and Ubuntu, and an
`.AppImage` that runs without installing. They are made the same way as the Fedora package, but
tested less.

**From Flathub** — coming in a later version. You will be able to find **Learning Corner** in
your software centre.

The app never asks you to create an account, and it does not need an internet connection to
run.

## 2. Choose where your library lives

The first time you open the app, it asks what to call your library and where to put it. It
makes a folder for the library there, named after it, and everything you write goes in that
folder and nowhere else. After that, the app opens straight into the library you used last.

Put it somewhere you will remember and that is easy to back up — your home folder or a
documents folder is ideal. Name it after the thing you are learning, and the folder follows:

```
Learning, in your home folder         →  ~/learning/
Russian, in your documents folder     →  ~/Documents/russian/
```

That folder and its name are your **library**. You can have more than one, rename it — the
folder follows — and move it later; see [Libraries and your files](libraries-and-files.md).

> **Do not** put your library inside a folder that syncs automatically to a cloud service.
> Automatic sync tools decide for themselves which copy wins, which is exactly the decision
> this app is built to leave with you. Use [Backup and restore](backup-and-restore.md)
> instead.

## 3. Make your first topic

A **topic** is a subject you are learning about. It holds documents, and it can hold other
topics once things get deeper.

1. Choose **New topic**.
2. Name it after the question you actually have — *Protein*, *Russian verbs*, *Karelian folk
   songs*. You can rename it whenever you like.

Do not plan the whole structure now. Topics are meant to be split apart later, and the app
makes that easy — see [Topics and documents](documents-and-topics.md).

## 4. Save a source before you write

This is the habit the whole app is built around: **save the source first, then write from
it.**

1. Choose **New source**.
2. Pick what kind of thing it is — a book, a journal article, a web page, a video, a chapter
   in an edited book.
3. Fill in what the form asks: who made it, when, what it is called, where it came from. The
   fields change depending on the kind of source, and the app only asks for what a proper
   citation actually needs.
4. Save it.

You now own that source. It sits in your library and can be cited from any document, in any
topic, forever — including when the web page it came from goes offline.

## 5. Write, and cite as you go

1. Inside your topic, choose **New document** and give it a name.
2. Write.
3. When you write something you learned from a source, select the sentence and choose
   **Cite**, then pick the source. The citation appears in the text in proper APA 7 form.

Two things happen automatically:

- The document's **reference list** builds itself at the bottom, correctly formatted and
  alphabetically ordered. You never type it.
- Anything you wrote that is **not** backed by a source stays visibly unmarked, so when you
  come back in six months you can tell what you verified from what you assumed.

Full detail in [Sources and citations](sources-and-citations.md).

## 6. Back it up

> **Not in this version yet.** Until **Back up** arrives, copy your library folder to an
> external drive yourself now and then. It is ordinary folders and files, so a plain copy is a
> complete backup.

Plug in an external drive and choose **Back up**. The app copies your library onto the drive
as ordinary folders and files — nothing packed, nothing encrypted, nothing you need this app
to read again.

Do this before you have much to lose, not after. See
[Backup and restore](backup-and-restore.md).

## Where to go next

| You want to…                                             | Read                                                    |
| --------------------------------------------------------- | ------------------------------------------------------- |
| Understand how your library is organised on disk           | [Libraries and your files](libraries-and-files.md)      |
| Split a topic that has grown too big                       | [Topics and documents](documents-and-topics.md)         |
| Get citations exactly right                                | [Sources and citations](sources-and-citations.md)       |
| Read a text with its translation beside it                 | [Parallel texts](parallel-texts.md)                     |
| See how your topics connect                                | [Mind maps](mind-maps.md)                               |
| Look up a word used in this guide                          | [Glossary](glossary.md)                                 |

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

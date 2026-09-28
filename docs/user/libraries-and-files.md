# Libraries and your files

> **Audience:** People using Personal Learning Corner
> **Status:** In progress
> **Last reviewed:** 2026-09-28

## What a library is

A **library** is one folder on your computer holding everything about one area of study:
your topics, your documents, your sources, your texts, your mind maps.

You choose the folder. The app does not hide your work in a location only it knows about,
and it does not put your work in more than one place.

Inside, you will find plain folders and plain text files with names you recognise. You can
open any of them in a text editor and read them. That is on purpose: if this app disappeared
tomorrow, your work would not go with it.

## More than one library

You can keep several libraries and switch between them. That is usually the right choice when
two subjects have nothing to do with each other:

```
~/Learning/            ← nutrition, biology, history
~/Documents/Russian/   ← language study, texts, songs
```

**Switch library**, at the top of the sidebar, closes the library you are in and takes you back
to the start screen. The libraries you have opened before are listed there, the most recent
first, and one click opens any of them; making a new library or opening another folder is on
the same screen. Whatever you had just typed is saved before the library closes.

When you start the app, it opens the library you had open last. If it cannot — the folder was
moved or renamed, or it is on a drive that is not plugged in — it says so on the start screen
and leaves the choice to you. A library that cannot be found stays on the list, marked, until
you take it off with **×**. Taking it off the list does nothing to the library itself.

The list is kept in the app's own settings folder — usually
`~/.config/personal-learning-corner/` — and not in any library, so it never travels with one. Deleting it costs you the list and nothing
else: the next start opens on the start screen, and your libraries are all where they were.

Sources are shared *within* a library, not between libraries. If you cite the same book in
two libraries, you save it in each. That is a fair trade for libraries that can be moved,
copied, and backed up independently without ever half-breaking each other.

If you are unsure, use one library. Splitting later is a matter of moving folders.

## Moving a library

A library is just a folder, so moving it is just moving a folder:

1. Close the app.
2. Move or copy the folder wherever you want — another disk, another computer, a memory
   stick.
3. Open the app. It will say it cannot find the library where it used to be; choose **Open an
   existing one…** and point it at the new location. Take the old entry off the list with
   **×** whenever you like.

Everything comes with it, including your sources and citations, and any PDFs you kept with a
source — those live in `sources/files/` inside the library, so they travel with it. Nothing is
tied to the computer it was created on and nothing is tied to the folder's old path.

## Renaming things

Rename topics, documents, and sources freely inside the app — double-click a name, or use the
pencil that appears when you hover it. Links between your documents and citations to your
sources keep working: the app tracks them by an internal marker that does not change when a
name does.

**The file on disk is renamed too.** A document called *Protein, properly* is
`protein-properly.md`, and a topic called *Protein* is a folder called `protein` — so going
looking for something by the name you gave it works. If that name is already taken by a
neighbour, the new one gets a number on the end.

Libraries made before this worked may still hold files named after what a document was first
called — often `untitled.md`, since that is what a new document starts as. Renaming it once
puts the file right, and renaming it to the name it already has counts: open the rename box
and press Enter.

Renaming files **outside** the app is a different matter, see below.

## Editing your files outside the app

You can. The files are plain text and readable by design.

Two things to know before you do:

- **Close the app first,** or at least do not edit the same document in both places at once.
  The app assumes it is the only thing writing.
- **Keep each file's small header block at the top.** It is the part that tells the app what
  the file is and how it links to everything else. Change the writing underneath as much as
  you like; leave the header alone.

If you edit outside the app while it is closed, it will notice the changes next time it
opens and pick them up. Nothing is lost.

## What is safe to delete

Your library may contain a folder for the app's own working data — search results it has
worked out ahead of time, and similar. It is marked clearly, it contains nothing you wrote,
and deleting it is always safe. The app rebuilds it, which takes a moment on a large
library, and nothing else changes.

Everything else in the library is yours. If it is not in the app's working folder, deleting
it deletes your work.

## Backing up

Covered fully in [Backup and restore](backup-and-restore.md). The short version: the app
copies your library to a drive you choose, as ordinary folders and files.

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

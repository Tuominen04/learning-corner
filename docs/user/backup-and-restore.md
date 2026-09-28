# Backup and restore

> **Audience:** People using Personal Learning Corner
> **Status:** Planned
> **Last reviewed:** 2026-09-06

Your library is on one computer. Computers fail. This page is how you stop that from
mattering.

## What a backup is here

A copy of your library on a drive you choose — an external disk, a memory stick, a second
internal disk — written as **ordinary folders and files**.

Not an archive. Not a packed-up bundle. Not something only this app can open. If you plug
that drive into any computer, you can open your folders and read your writing, with or
without Personal Learning Corner installed.

That is deliberate. A backup you can only restore with a working copy of the app is a backup
that fails you on the day the app will not start.

## Backing up

1. Plug in the drive.
2. Choose **Back up**.
3. The first time, pick where on the drive the copy should go. The app remembers it.
4. It shows you what it is about to do — *142 files new, 8 changed, nothing removed* — and
   you confirm.

Only what changed is copied, so after the first backup it is quick. Do it whenever you
finish a session's work.

If the drive is unplugged halfway through, nothing is broken. The copy on the drive is
simply part-finished; run it again and it picks up where it stopped.

### The app will not decide for you

Personal Learning Corner does not back up on a schedule and does not do it quietly in the
background. You plug in the drive and you choose **Back up**. Backups that happen without
you noticing are also backups that go wrong without you noticing.

## Restoring

On a new computer, or after a disaster:

1. Install the app and plug in the drive.
2. Choose **Restore from drive** and point it at the copy.
3. Choose where the library should live on this computer.

Everything comes back: documents, sources, citations, texts, maps.

You can also skip the app entirely and copy the folder off the drive by hand, then open it
with **Open an existing one…** on the start screen. It works. There is nothing magic in the
backup.

## When both copies changed

This is the situation the app takes seriously.

You backed up on Friday. Over the weekend you wrote on your laptop, and you also opened the
copy on the drive at work and fixed a source there. Now the two disagree, and one of them
must not win by accident.

When you back up or restore, the app compares the two copies file by file and sorts every
difference into one of three piles:

| What it found | What it does |
| ------------- | ------------ |
| Changed here only | Copies your change to the drive |
| Changed on the drive only | Tells you, and asks before bringing it over |
| **Changed in both places** | Stops and asks you |

For the third pile it shows you, one item at a time: what it is, when each copy was last
changed, and what actually differs. You choose **keep mine**, **take the drive's**, or **keep
both** — which saves the other one alongside, renamed, so you can merge them yourself later.

Three promises, which hold in every case:

1. **Nothing is overwritten without you saying so.** If the app cannot tell which copy is
   right, it stops and asks. It never guesses.
2. **The copy you did not choose is kept**, in a folder inside your library, for as long as
   you want it. Choosing wrong is recoverable.
3. **Your computer is the default.** If you dismiss the question or close the window, the
   copy on your computer stands and nothing on it is touched.

## Two computers

You can work on the same library from a desktop and a laptop by carrying it on a drive: back
up from one, restore to the other, and answer the questions above whenever both changed.

It works, and people do it. But be honest about what it is — a manual copy with a careful
review, not automatic synchronisation. The safe habit is to always back up before you leave
one machine and restore before you start on the other. If you skip that, you get conflict
questions, and answering them badly is how work gets lost.

Do **not** put your library inside a folder run by an automatic cloud sync tool. Those tools
resolve conflicts on their own, by rules that suit files that only one program writes. That
is precisely the decision this app exists to leave with you.

## How often?

- **Back up** at the end of any session where you wrote something you would mind rewriting.
- **Keep two drives** if the library matters to you, and leave one somewhere else. A single
  drive next to the computer survives a disk failure, not a burglary or a flood.
- **Test a restore** once, early, into a temporary folder. An untested backup is a hope, not
  a backup.

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

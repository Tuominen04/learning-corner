# Backup and restore

> **Audience:** People using Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-10-29

Your library is on one computer. Computers fail. This page is how you stop that from
mattering.

## What a backup is here

A copy of your library on a drive you choose — an external disk, a memory stick, a second
internal disk — written as **ordinary folders and files**.

Not an archive. Not a packed-up bundle. Not something only this app can open. If you plug
that drive into any computer, you can open your folders and read your writing, with or
without Learning Corner installed.

That is deliberate. A backup you can only restore with a working copy of the app is a backup
that fails you on the day the app will not start.

## Backing up

1. Plug in the drive.
2. Choose **Back up…** under the library's name, then **Choose a folder…**.
3. The first time, pick an empty folder on the drive. After that, pick the same folder each
   time — the app recognises its own copy, and refuses a folder holding something else.
4. It shows you what it is about to do — *142 files to copy to the drive, nothing to remove* —
   and the files it means. Nothing is written until you choose **Back up**.

The drive becomes exactly like your library. Only what changed is copied, so after the first
backup it is quick. Do it whenever you finish a session's work.

If the drive is unplugged halfway through, nothing is broken. The copy on the drive is simply
part-finished; run it again and it picks up where it stopped.

### The app will not decide for you

Learning Corner does not back up on a schedule and does not do it quietly in the background.
You plug in the drive and you choose **Back up**. Backups that happen without you noticing are
also backups that go wrong without you noticing.

## Using the library on another computer

You can take the drive to another computer and open the library from it — to show somebody,
or to work away from your desk. If you change anything there, bring it home:

1. Plug the drive into your own computer.
2. Choose **Bring back…** under the library's name, and pick the copy on the drive.
3. It shows you what changed on the drive, and you confirm. Those changes come into your
   library.

Then carry on working and back up as usual.

If you forget, the app reminds you. When you back up and the drive has changes your library
does not, it stops before writing anything — *the drive has 2 changes made since your last
backup* — and asks whether to **bring them back first** or **replace them**. If you replace them, the
drive's versions are kept, so nothing is lost either way.

### When the same file changed in both places

If you changed a document on the other computer **and** the same document on your own since the
last backup, bringing back asks about that one file. It shows when each copy was last changed
and how big it is, and you choose **keep this library's**, **take the drive's**, or **keep
both** — which saves the drive's version alongside, named *(from backup* and the date*)*, so you
can merge them yourself. Nothing is brought back until every such file has an answer.

Keeping both copies of a document leaves two documents that both claim to be the same one.
The library lists that under **Needs your attention** until one of them is gone — merge what
you want to keep into one, and delete the other.

Following the habit — bring back before you start, back up before you leave — means this almost
never happens.

## Restoring

On a new computer, or after a disaster:

1. Install the app and plug in the drive.
2. On the start screen, choose **Restore from a backup…**, then **Choose a folder…**, and point
   it at the copy.
3. Choose an empty folder for the library on this computer — the folder dialog can make one.
4. It shows you what it will copy, and you choose **Restore from a backup**. The library opens
   when it is done.

Everything comes back: documents, sources, citations, texts, maps.

You can also skip the app entirely and copy the folder off the drive by hand, then open it with
**Open an existing one…** on the start screen. It works. There is nothing magic in the backup.

## Nothing is lost

Whenever a backup or bring-back replaces or removes a file in your library — or overwrites a
change made on the drive — the version it replaced is kept first, in a folder inside your
library, named `.conflicts`, under the date and time. When it is done, the app lists what it
kept and where. Choosing wrong is recoverable. Those kept copies are never deleted
automatically; when you no longer want them, delete them from `.conflicts` yourself.

## Two computers

You can work on the same library from a desktop and a laptop by carrying it on a drive: back
up from one, bring back on the other.

It works, but be honest about what it is — a careful manual copy, not automatic
synchronisation. Your computer is the master and the drive is its copy. The safe habit is to
always back up before you leave one machine and bring back before you start on the other.

Do **not** put your library inside a folder run by an automatic cloud sync tool. Those tools
resolve conflicts on their own, by rules that suit files that only one program writes. That is
precisely the decision this app exists to leave with you.

## How often?

- **Back up** at the end of any session where you wrote something you would mind rewriting.
- **Keep two drives** if the library matters to you, and leave one somewhere else. A single
  drive next to the computer survives a disk failure, not a burglary or a flood.
- **Test a restore** once, early, into a temporary folder. An untested backup is a hope, not
  a backup.

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

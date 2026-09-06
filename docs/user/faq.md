# Frequently asked questions

> **Audience:** People using Personal Learning Corner
> **Status:** Planned
> **Last reviewed:** 2026-09-06

## Where is my writing kept?

In the folder you chose when you first opened the app, and nowhere else. See
[Libraries and your files](libraries-and-files.md).

## Does it need an internet connection?

No. Not to install from a downloaded package, not to run, not for any feature described in
this guide. It works on a machine that has never been online.

## Do I need an account?

No. There is no account, no sign-in, and no way to make one.

## Is anything sent anywhere?

No. The app does not report how you use it, does not check for messages, and does not upload
your work. Nothing leaves your computer unless you export a document or back up to a drive
yourself.

## Can I read my files without the app?

Yes, and this is a deliberate design goal. Your documents are plain text in ordinary folders.
Open them in any text editor.

## Can I edit them without the app?

Yes, with two cautions: close the app first, and leave the small header block at the top of
each file alone. See [Libraries and your files](libraries-and-files.md).

## What happens to my work if this project stops?

Nothing. It is plain text in a folder you chose, on a disk you own. That is the answer this
app is designed to be able to give.

## Which systems does it run on?

Fedora at first. Windows and macOS are planned but not available yet — see the
[roadmap](../technical/roadmap.md) for where they sit.

## Can I use it on two computers?

Yes, by carrying the library on a drive and backing up and restoring deliberately. It is a
manual copy with a review, not automatic sync. See
[Backup and restore](backup-and-restore.md).

## Can I put my library in a cloud-synced folder?

You can, and we recommend against it. Automatic sync tools resolve conflicts by their own
rules, silently. When both copies of a document have changed, this app stops and asks you —
which only works if it is the thing doing the copying.

## Is my library encrypted?

No. It is plain files with the permissions your system gives them. If the disk needs to be
encrypted, encrypt the disk — your system already does that better than an application could,
and it protects everything else on the machine at the same time.

## How big can a library get?

Larger than you will make it by writing. Text is small: tens of thousands of documents are
not a problem. Searching stays fast because the app works out its search results ahead of
time.

## Can I import notes from somewhere else?

Not yet. Importing from other note-taking applications is planned, but not part of the first
releases. Plain text files can be copied into a library folder and the app will pick them up.

## Can it look up a book from its code so I do not have to type the details?

Not yet, and it will always be optional when it arrives. The app is built to work fully with
no connection, so typing the details yourself stays the supported path, not a fallback. See
[Sources and citations](sources-and-citations.md).

## Does it support citation styles other than APA 7?

Not at first. APA 7 is what the first version does properly, rather than doing five styles
approximately. Sources are stored as structured details rather than as formatted text, so
other styles can be added later without you re-entering anything.

## Something went wrong. What do I do?

1. Check whether a backup exists, and do not overwrite it.
2. Note what you were doing when it happened.
3. Report it on the project's issue tracker, with that note.

Your library is plain files. If the app will not open, your work is still there and still
readable.

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

# Parallel texts

> **Audience:** People using Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-10-31

For reading something in a language you are still learning: the original, how it is
pronounced, and what it means — lined up, on screen together, in whatever combination helps
you today.

## The idea

A **work** is the text itself: a poem, a song, a chapter, a letter, a historical document.

Each version of it is an **edition**. A work can have as many as you need, and they come in
three kinds:

| Kind | What it is | Example |
| ---- | ---------- | ------- |
| **Original** | The text as written | Пушкин, in Russian |
| **Pronunciation** | The same words, written so you can say them | *Ya vas lyubil* |
| **Translation** | What it means, in one language | Finnish. English. One edition each. |

Keeping pronunciation separate from translation matters. When you are learning Russian with
Finnish as your first language, *how do I say this* and *what does this mean* are two
different questions, and you often want both at once — the original, the pronunciation, and
the Finnish, three panes, all lined up.

## Setting one up

1. Open **Works** in the sidebar, beside Documents and Sources, and choose **New work**.
2. Name it, paste or type the original, say what language it is in, and choose how it is
   divided — by line, sentence or paragraph (see below).
3. Add an edition — **Add pronunciation** or **Add translation** — and paste it in or write it
   alongside the original, row by row.

The app keeps the rows lined up as you type. Add a row to one edition and every other edition
gets an empty row in the same place, so nothing slides out of alignment while you work.

## Writing a row

Click a row in any pane to write it. **Enter** saves it; **Shift+Enter** starts a new line
within the same row; **Esc** leaves it as it was. The row you clicked shows its tools beneath
it:

- **Add a row above** / **Add a row below** — an empty row in every edition.
- **Add a note** — see below.
- **Same text as…** — for a chorus; see Songs.
- For the edition you are writing in: **Mark empty here**, **Join to the row above**,
  **Split off the last line**, and **Remove the row**. Removing a row takes it out of every
  edition, so it waits until no other edition has text in it. The tools that move rows wait
  until you have saved what you typed.

Each pane's **…** button is where you give an edition a label or a source, or remove it.

Two translations into the same language are welcome — two translators often disagree, and
that is worth seeing. Give each a label, such as the translator's name and year, so you can
tell them apart. An edition can also name the [source](sources-and-citations.md) it came
from: which printed edition you copied the original from, whose translation this is.

## Choosing what you see

The pane selector at the top lists every edition of the work. Tick the ones you want:

- **Original only** — reading practice.
- **Original + pronunciation** — for reading aloud.
- **Original + translation** — for meaning.
- **Original + pronunciation + Finnish + English** — for taking a text apart properly.

Two layouts:

- **Side by side** — editions as columns. Best on a wide screen, and best for comparing two
  translations against each other.
- **Stacked rows** — each row of the original followed underneath by the other editions of
  that same row. Best for long lines, songs, and narrow windows.

Whichever you pick, scrolling and selecting stay in step: click a row in one pane and the
matching row is highlighted in all of them. What you have chosen to see lasts while the window
is open; it is how you are reading today, not part of the text.

## How the text is divided

You choose the unit the editions line up by, because it depends on what you are reading:

| Unit | Right for |
| ---- | --------- |
| **Line** | Songs, poems, anything where the line break is part of the text |
| **Sentence** | Prose, articles, letters |
| **Paragraph** | Long-form text you want to read in blocks |

Pick it when you create the work. The app divides what you paste; dividing by sentence is a
good guess rather than a certainty — an abbreviation it does not know can split a sentence in
two, and joining the two rows puts it right.

You can change the unit later. The app divides the text again and shows you the rows before
and after — and any lining-up you did by hand that would be lost — before anything is saved.

### When translations do not line up

They often do not. One Russian sentence becomes two in Finnish. A line of a song has no
translation at all, because it is a refrain of nonsense syllables.

The app shows this rather than hiding it. A row can hold two lines of a translation against one
of the original — **join** them — and a row can be empty in one edition and full in another —
**mark it empty**. Both are shown as deliberate, so you can see it was your choice and not a
mistake in the alignment. **Split** undoes a join.

If an edition stops lining up with the original — after a join, or after you edited its file in
another program — the app says which edition, and how many rows more or fewer it has, and marks
that pane as not lined up. Where the meaning stops matching is for you to see: read down the
two panes, find the place, and put it right there with join, split or mark empty. It never moves
lines around by itself to make them fit: a translation quietly lined up against the wrong line
teaches you something false, and you would not find out.

## Songs

Songs are works like any other; the difference is only that **line** is almost always the
right unit, and that a refrain repeats. Click the repeating row and choose **Same text as…**
with the row it repeats, and the two are the same text: translate the chorus once, and every repetition shows it. Change one and
the app changes all, and tells you how many places that was.

## Notes and sources

Any row can carry a note — a grammar point, a word that surprised you, a case ending you
keep forgetting.

A work can also cite [sources](sources-and-citations.md), the same way a document can: which
edition of the text you are working from, whose translation you consulted, which dictionary
you checked a word in. Historical texts especially — *which* manuscript, and who transcribed
it, is often the whole question.

## Practising

Choose **Hide** on a pane to test yourself: its text is blurred, and clicking a row reveals
just that row. **Show** brings the whole pane back. Hide the pronunciation and try to
read aloud; hide the translation and try to understand; hide the original and try to
reconstruct it.

## In the folder

Each work is a folder in your library's `works` folder, and each edition is a plain text file
in it, one row per line — open it in any text editor. A line starting `+ ` belongs to the row
above it; a line that is only `~` is a deliberately empty row. Editing these files yourself
is fine: the app shows you if the editions no longer line up.

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

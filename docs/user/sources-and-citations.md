# Sources and citations

> **Audience:** People using Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-10-02

This is the part of the app that answers the question it was built around: *how do I know
this is true?* You cannot answer it for everything you read. You can answer it for
everything you keep.

## Saving a source

A **source** is anything you learned from — a book, a journal article, a web page, a video,
a lecture, a podcast, a chapter someone wrote in someone else's book. A PDF that is none of
those — a guideline, a brochure, a set of slides — is a **PDF document**.

Choose **New source**, pick what kind of thing it is, and fill in the form. The form changes
with the kind: a book asks for a publisher, an article asks for the journal and the volume,
a web page asks for the site and the date you read it. You are only ever asked for what a
correct citation genuinely needs, which is usually fewer fields than you expect.

Every source needs its title. A web page or a PDF document can name nobody at all — plenty
don't — and is then cited by its title instead.

### Keeping the paper itself

If you have the PDF — downloaded, or handed to you — choose **Add a PDF…** on the source and
pick it, whatever kind of source it is: a report you downloaded is still a report. Then say
what should happen to the file you picked:

| | |
| --- | --- |
| **Copy file** | Leaves your own copy where it was |
| **Move file** | Takes it out of that folder, once your library has it |

Either way your library keeps **its own copy**, and that is the whole feature. Empty your
downloads folder next week, unplug the stick it came on, reinstall your machine — the source
still has its paper. Sources that have one are marked **PDF** in the list, and one click opens
it.

Copy is what you get unless you say otherwise, because moving deletes a file of yours and that
should never be something you discover afterwards. Move is the one to reach for when the file
is sitting in a downloads folder: it has been filed now, and a second copy left behind is how
that folder turns into somewhere nothing can be found.

Only PDFs for now. The app checks that the file really is one, rather than trusting the name:
finding out that a paper will not open is much better today than in six months, when you go back
to check what you wrote.

Two habits worth having:

- **Save the source when you find it, not when you need to cite it.** The web page you meant
  to come back to has a way of not being there.
- **Fill in the page numbers.** Later, a citation with a page number takes you back to the
  exact paragraph; one without takes you back to a 400-page book.

Sources live in the library, not in a document. Save a book once and cite it from fifty
documents.

### Writing the details down

- **Titles in sentence case.** A capital letter to start, after a colon, and on names:
  *Protein in the Finnish diet: A review*. That is how APA prints titles, and the app prints
  yours exactly as you type it. It never changes the case for you, because it cannot tell
  which of your words are names.
- **A podcast's host goes in as Host.** APA puts the host where an author would go, and so
  does the app: *Glass, I. (Host).*
- **Numbers as they are printed.** A report or a podcast episode can have a number. A number
  on its own, like *935*, prints as *Report No. 935*. When the report gives its number a label
  of its own, write the whole thing — *NIH Publication No. 18-2059* — and it prints exactly so.
- **An edition can be just a number.** *2* prints as *2nd ed.*

### If you cannot find all the details

Fill in what you have and save it. The app marks the source as **incomplete** and tells you
what is missing, so you can find it later rather than losing the source entirely. An
incomplete source still cites — the reference list just shows the gap plainly instead of
inventing something.

### Rating what you trust

Each source can carry your own note about how much you trust it, and why. This is your
judgement, not a score the app calculated: *peer-reviewed*, *a company selling the thing it
is describing*, *someone's blog but they cite their sources*, *I could not verify this
anywhere else.*

It matters more than it sounds. When a document is built on six sources and one of them is a
supplement manufacturer's landing page, you want that visible on the page — not something
you have to remember.

## Citing while you write

Select what you wrote, choose **Cite**, and pick the source. Add a page number if you have
one.

The citation appears in your text in proper APA 7 form, and you choose which shape fits the
sentence:

| Shape | Looks like | Use it when |
| ----- | ---------- | ----------- |
| In brackets | …repairs muscle tissue (Nieminen, 2021, p. 44). | The fact matters, not who said it |
| In the sentence | Nieminen (2021) found that… | Who said it is part of your point |

A citation in brackets goes **inside the sentence it supports**, in front of the full stop —
that is where APA 7 puts it. If you selected the whole sentence, full stop and all, the app
steps back over the full stop for you: *repairs muscle tissue (Nieminen, 2021).*, never
*repairs muscle tissue. (Nieminen, 2021)*. A question mark or an exclamation mark is stepped
over the same way.

Two full stops are left where they are, and the citation goes after them: one inside a
quotation, which belongs to the quotation, and one that may end an abbreviation — *jne.*,
*U.S.*, *Fig. 3.* — because stepping in front of it would cut the abbreviation short.

A citation never runs into a word. When a word follows it straight away, a space goes in after
it; a citation in the sentence also gets a space before it, after the word it follows. The
editor would show a gap either way — the space is for the file, and for every export of it.

The app handles the fiddly parts of APA 7 without you having to remember them: two authors
joined correctly, three or more shortened to *et al.*, two different authors with the same
surname kept apart, and two works by the same author in the same year marked *2021a* and
*2021b* consistently everywhere they appear.

## The reference list

Every document builds its own reference list at the bottom, from the sources it actually
cites. You never type it and you never maintain it.

It is **not stored in your file**. The document on disk holds your writing and its citation
markers, and nothing else — so if you open the file in a text editor you will not find a
reference list in it. The app works it out from the citations each time the document is saved,
which is why a list that has gone out of date is not a thing that can happen to you. When you
export a document, the reference list goes with it.

- Alphabetical by author, as APA 7 requires.
- Correctly punctuated and correctly indented for each kind of source.
- Updates itself when you add a citation, remove one, or correct a source's details.
- Fix a typo in a source once, and every document citing it is right immediately.

## Exporting

Choose **Export** at the top of a document to save it as a file somebody else can read — to
send, to print, or to keep. Pick a format, then where the file goes:

| Format | Best for |
| ------ | -------- |
| **PDF** (`.pdf`) | Sending, handing in, or printing. It looks exactly the same on every computer and on paper. |
| **Web page** (`.html`) | Reading anywhere. It opens in any browser with its pictures inside it, and fits any screen. |
| **Word document** (`.docx`) | Going on editing in Word or Google Docs. |
| **OpenDocument** (`.odt`) | Going on editing in LibreOffice, or any office suite. |
| **Plain text** (`.txt`) | Pasting into anything. Italics are lost, and a picture is named rather than shown. |

A Word or OpenDocument file is set in the document's own styles — Title, Heading 1 to 6, and a
Bibliography style that holds the reference list's hanging indent — so it edits like any other
document, and changing a style changes everything in it. Its pictures are inside it, sized to
fit the page.

A PDF is laid out ready to print: A4 pages with page numbers at the top right, headings in the
sidebar of your PDF reader, and the reference list's web addresses clickable. It carries its own
font, which has every Finnish, Swedish and Russian letter. A character it has no letter for — a
Chinese word, an emoji — shows as an empty box, but still copies out of the PDF as itself.

The file is your document, finished. Every citation is written out in APA 7 form, and the
reference list follows your writing with its hanging indent. Two citations side by side become
one pair of brackets — *(Kallio & Virtanen, 2019; Nieminen, 2021)* — and an organisation's
short name is introduced the first time you cite it and used on its own after that: *(World
Health Organization [WHO], 2007)*, then *(WHO, 2007)*. A link reads as the title of the
document it leads to. Nothing in the file needs this app to make sense.

What you typed a moment ago goes into the export too, because the app saves first. Exporting
changes nothing in your library.

## Finding a source

The **Sources** screen has its own search box. Type part of a title; a name — the author's,
or an editor's, a translator's, a host's; or where the source appeared — the journal, the book,
the podcast, the publisher, the site. An organisation's short name works too: *WHO* finds the
World Health Organization's report. The list narrows to the sources that match, best match
first. As with searching your writing, the start of a word is enough — `niem` finds Nieminen —
and clearing the box brings the whole list back.

A source found this way is the whole row: who wrote it, its paper, and where it is used.

## Working backwards from a source

Under **Sources**, every source has a **Used in** button. Press it to see **every document
that cites it**, and click any of them to go there.

This is the feature you will be glad of on a bad day. A study gets retracted, or you realise
a site you trusted is not reliable, or you simply find something better. Open the source, see
the eleven places you leaned on it, and go fix them. Without this list, a bad source quietly
poisons everything you built on it and you never find out.

It answers a quieter question too: a source nothing cites is one you saved and never used.
That is not a problem — saving a source when you find it, rather than when you need it, is
the habit this app is built around — but it is worth being able to see.

## Does it need the internet?

No. Every part of this works offline: sources are typed in and stored by you, citations and
reference lists are worked out on your own machine, and nothing is ever sent anywhere.

Looking a source up automatically from a code on the back of a book, so you type less, is
planned as an optional convenience for later. It will always be optional, and the app will
always work fully without it.

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

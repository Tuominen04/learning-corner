# Topics and documents

> **Audience:** People using Personal Learning Corner
> **Status:** In progress
> **Last reviewed:** 2026-09-22

Learning does not arrive organised. You start with one question and finish with a structure
you could not have designed at the start. This part of the app is built for that: start
messy, split things apart as they grow, and never lose the connections.

## How it grows: a worked example

You want to know what a protein is. So you make a topic called **Protein** and write one
document in it.

Reading, you find there are many kinds of protein, and that gets long. You select the
section about kinds and choose **Split into new document**. Now *Protein* holds two
documents — the original, and **Types of protein** — and the original automatically links to
the new one where the section used to be.

Then you get interested in where protein comes from, and how the body actually uses it, and
what the organs involved are doing. Now you have:

```
Protein
├── What protein is
├── Types of protein
├── Protein sources
└── In the body
    ├── How protein is used
    └── The organs involved
```

*Protein sources* and *Types of protein* keep pointing at each other, because you compared
them. Every claim in all six documents still points at the source it came from. Nothing had
to be reorganised by hand, and nothing was retyped.

That is the whole idea. **Structure is something you discover, not something you commit to
on day one.**

## Topics

A topic is a subject. It holds documents, and it can hold other topics — as deep as you
like.

| To do this | Do that |
| ---------- | ------- |
| Make one | **New topic**, in the sidebar or inside another topic |
| Rename it | Double-click the name, or click the pencil that appears when you hover it. Links and citations keep working |
| Move it | Drag it onto another topic, or out to the top level |
| Split it | Make a topic inside it and drag documents in |
| Delete it | Right-click → **Delete**. The app asks what to do with what is inside, and never deletes documents without saying so |

## Documents

A document is a page you write, inside a topic.

**Writing.** Plain writing with headings, lists, emphasis, and quotes. There is no page
layout to fight with — this is for learning, not for typesetting.

**Headings.** Click **H1**, **H2** or **H3** above the page, or just type `# ` at the start of
a line. One `#` makes a heading, `##` a sub-heading, and you can go as deep as `######`.
Clicking the same button again turns it back into ordinary writing.

**Pictures.** Click **Picture**, choose a file, and it goes where your cursor is. A copy is
kept in your library right next to the document, so the picture stays even if you empty the
folder you took it from — and you are asked first whether to copy the file or move it, exactly
as you are for a source's PDF.

Because the copy sits beside the document, the picture also shows up when you open the file
anywhere else: a text editor's preview, a file manager, anything that reads Markdown. Move the
document to another topic and its pictures move with it.

**Saving.** Continuous. There is no save button and no unsaved state to lose.

**Splitting.** Select the part you want to move and click **Split** above the page. It asks
what to call the new document — and if you started your selection at a heading, it has already
filled that in — and shows you what will move before anything happens.

The selection moves into a new document in the same topic, its citations come with it, and a
link is left where it used to be. Your pictures keep working, because the new document sits in
the same folder as the one it came out of.

Starting a selection at a heading takes the heading with it, even though you cannot highlight
the `##` itself. That is almost always what you meant — you are moving a section, and the
section has a name.

**Linking.** Click **Link** above the page and choose a document. The link appears in your
writing as that document's title, and clicking it takes you there.

The link is stored as the document's identifier, not its name — so rename either document
afterwards and the link still reads correctly, with nothing to go and fix. If you delete the
document a link points at, the link says so plainly rather than disappearing: your sentence is
still your sentence, and you can see what needs changing.

Links are two-directional. At the foot of every document, **Linked from** lists every document
that points here — you do nothing to make that happen. That list is how you notice that two
topics you thought were separate have been talking to each other for a while.

**Renaming.** Double-click the title — in the sidebar or above the page you are writing —
or click the pencil that appears when you hover it. Enter keeps the new name, Escape throws it
away, and clicking away keeps it. Safe at any time. Links follow.

## Claims: what you verified, and what you assumed

When you cite a source for something you wrote, that sentence becomes a **claim** — a thing
you can point at the origin of. Everything else is just your writing.

Turn on **Show claims** and the document tells you which is which. Cited sentences are
marked; uncited ones are not.

This is not a scolding feature and there is nothing wrong with an uncited sentence — your
own thinking, a question to come back to, and a summary in your own words all belong in a
document. The point is that **six months later, you can tell them apart.** Without the mark,
"protein is used for tissue repair" and "I think protein is why I sleep badly" look exactly
the same on the page, and the whole reason you were careful is lost.

A document also shows a short summary at the top: how many claims it makes, how many sources
it draws on, and whether any of those sources are ones you marked as low quality.

See [Sources and citations](sources-and-citations.md) for how citing works.

## Finding things

**Search** sits above your topics in the sidebar. Type, and your topics and documents are
replaced by what matches; clear the box and they come back exactly as they were.

It looks **inside what you wrote**, not only at titles, and shows you the words it matched on
so you can tell one result from another without opening it. You do not have to finish a word:
typing `tuttu` finds *tuttujuttu*. You do have to start it — `juttu` will not. Click a document to open it.
Topics are listed too, marked as topics — there is nothing to open for a topic, but knowing one
matched tells you where to look.

Your **sources** are not in these results. They have [their own screen](sources-and-citations.md),
where a source can be shown with its authors, its year and its paper — a bare title in a list
is the least useful way to meet one.

It works offline, and it works on a library too large to scroll through.

Narrowing to one topic, or to the documents citing a particular source, comes later. That
second one is the useful one: *"What did I write based on this book?"* — and, when a source
turns out to be wrong, *"What do I now need to go back and fix?"*

## When you want the whole picture

Once you have more than a handful of documents, the sidebar stops showing you how things
actually relate. That is what [Mind maps](mind-maps.md) are for — the same documents, drawn
as a picture, in their own window.

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

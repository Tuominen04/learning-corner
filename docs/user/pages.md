# Pages

> **Audience:** People using Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-11-10

Learning does not arrive organised. You start with one question and finish with a structure
you could not have designed at the start. This part of the app is built for that: start
messy, split things apart as they grow, and never lose the connections.

## How it grows: a worked example

You start learning about a subject. So you make a page named after it and write what you
find there: a paragraph saying what it is, in brief.

Reading, you find it comes in more than one kind, and the part about the kinds gets long. You
select that section and click **Split**. Now **Type 1** is a page of its own, under the
subject's page, which links to it where the section used to be.

Then you get interested in the history, and in where things stand now, and the second kind
turns out to need pages of its own. Now you have:

```
Subject                    ← what it is, in brief
├── History
├── Current
├── Type 1
└── Type 2
    ├── Detail 1
    └── Detail 2
```

*Subject* still opens with its overview, and the pages under it go into the detail, in the
order you put them. *Type 1* and *Type 2* keep pointing at each other, because you compared
them. Every claim on every page still points at the source it came from.
Nothing had to be reorganised by hand, and nothing was retyped.

That is the whole idea. **Structure is something you discover, not something you commit to
on day one.**

## The tree of pages

Everything in the sidebar is a **page**: something you write, which can have pages under it —
as deep as you like. There is nothing else to make. A page with pages under it is shown a
little heavier, so the shape of the tree reads at a glance.

| To do this | Do that |
| ---------- | ------- |
| Make a page at the top | The **+** beside **Pages** at the top of the sidebar |
| Make a page under another | Hover it and click its **+** |
| Rename it | Double-click the name, or click the pencil that appears when you hover it. Links and citations keep working |
| Put pages in order | Drag one above or below another, or select it and press **Alt+↑** or **Alt+↓**. The order is yours and is kept |
| Move it under another page | Drag it onto that page — or hover it and click the arrows. See *Moving*, below |
| Delete it | Hover it and click the bin. The app shows you every page under it, however deep, and asks what should happen to them |

A good habit: put what a subject is about, in brief, at the top of its page, and the detail in
the pages under it. *Subject* says what it is; *History* and *Type 1* go further.

## Writing a page

**Writing.** Plain writing, with headings and pictures. There is no page layout to fight
with — this is for learning, not for typesetting. Lists, emphasis and quotes can be typed the
usual Markdown way — `- `, `*a word*`, `> ` — and they are kept exactly as you typed them; the
page shows them as typed rather than drawing bullets or italics, so that a page opened and
closed again is always the same page, character for character.

**The tools.** **H1**, **H2**, **H3**, **Picture**, **Link**, **Cite** and **Split** sit
together above the page — or down its left side, when the window is wide enough — and stay in
view as you scroll, so they are a click away wherever you are writing. What one of them asks
you opens right next to them, over the page, and closes when you are done.

**Headings.** Click **H1**, **H2** or **H3**, or just type `# ` at the start of a line. One `#`
makes a heading, `##` a sub-heading, and you can go as deep as `######`. Clicking the same
button again turns it back into ordinary writing.

**Pictures.** Click **Picture**, choose a file, and it goes where your cursor is. A copy is
kept in your library right next to the page, so the picture stays even if you empty the
folder you took it from — and you are asked first whether to copy the file or move it, exactly
as you are for a source's PDF.

Because the copy sits beside the page, the picture also shows up when you open the file
anywhere else: a text editor's preview, a file manager, anything that reads Markdown. Move the
page somewhere else and its pictures move with it.

**Saving.** Continuous. There is no save button and no unsaved state to lose. The last thing
you typed is saved before you move to another page or another library, or close the app,
however quickly you go.

**Splitting.** Select the part you want to move and click **Split**. It asks what to call the
new page — and if you started your selection at a heading, it has already filled that in —
and shows you what will move before anything happens.

The selection moves into a new page **under** the one you are writing, its citations come with
it, and a link is left where it used to be. Its pictures go with it too — kept for both pages
when the text left behind shows them as well.

Starting a selection at a heading takes the heading with it, even though you cannot highlight
the `##` itself. That is almost always what you meant — you are moving a section, and the
section has a name.

**Linking.** Click **Link** and choose a page. The link appears in your writing as that
page's title, and clicking it takes you there.

The link is stored as the page's identifier, not its name — so rename either page
afterwards and the link still reads correctly, with nothing to go and fix. If you delete the
page a link points at, the link says so plainly rather than disappearing: your sentence is
still your sentence, and you can see what needs changing.

Links are two-directional. At the foot of every page, **Linked from** lists every page
that points here — you do nothing to make that happen. That list is how you notice that two
subjects you thought were separate have been talking to each other for a while.

**Renaming.** Double-click the title — in the sidebar or above the page you are writing —
or click the pencil that appears when you hover it. Enter keeps the new name, Escape throws it
away, and clicking away keeps it. Safe at any time. Links follow.

**Moving.** A page moves with every page under it, four ways:

- **Drag it.** Onto the middle of a page, and it goes under that page, at the end. Onto the top
  or bottom edge of a page, and it goes just before or after it. Onto **Pages** at the top of
  the sidebar, and it goes to the top level. Where it would land lights up before you let go.
- **Press Alt+↑ or Alt+↓** with it selected, to move it one place among the pages beside it.
- **Click the arrows** that appear beside the bin when you hover it, choose the page it goes
  under, and click **Move**.
- **Select it and press Ctrl+X**, then select the page it should go under and press **Ctrl+V**.
  Esc leaves it where it is. Ctrl+C works the same: there is no copying a page, so both mean
  move.

Its pictures go with it. Links and citations keep working, because they point at what they
mean, not at where it is. Moved the wrong thing? **Undo** appears straight afterwards, and puts
it back exactly where it was.

**Deleting.** Hover a page in the sidebar and click the bin. Nothing is deleted until you have
seen what goes with it.

- You are shown every page that links to it. Those links stay in your writing and say the page
  is missing, so you can see what needs fixing.
- If it has pages under it, you are shown every one, however deep, by name. Then you choose:
  **keep them**, which moves the pages directly under it up into its place — each with the
  pages under it — before it goes, or **delete them too**. Keeping them is already chosen for
  you. Deleting them never is — you have to pick it yourself.

Any pictures it shows are left in its folder: your library may hold the only copy of a picture
you moved in, so removing those is left to you.

## Claims: what you verified, and what you assumed

When you cite a source for something you wrote, that sentence becomes a **claim** — a thing
you can point at the origin of. Everything else is just your writing.

Turn on **Show claims**, just above the page, and the page tells you which is which.
Cited sentences are marked; uncited ones are not. It stays on as you move from page to
page, until you turn it off or close the app.

A citation belongs to the sentence it follows — at the end of the sentence it supports, which
is where **Cite** puts it. Two sources behind one sentence still make one claim.

This is not a scolding feature and there is nothing wrong with an uncited sentence — your
own thinking, a question to come back to, and a summary in your own words all belong in a
page. The point is that **six months later, you can tell them apart.** Without the mark,
"it was first described in 1850" and "I think this is why it caught on" look exactly
the same on the page, and the whole reason you were careful is lost.

A page also shows a short summary at the top: how many claims it makes, how many sources
it draws on, and beside each source how much you said you trust it — in your own words, as you
wrote them on the source. A source you have not said anything about yet says *not rated*,
so a page leaning on something you never looked at closely tells you so.

See [Sources and citations](sources-and-citations.md) for how citing works.

## Finding things

**Search** sits above your pages in the sidebar. Type, and your pages are replaced by what
matches; clear the box and they come back exactly as they were.

It looks **inside what you wrote**, not only at titles, and shows you the words it matched on
so you can tell one result from another without opening it. You do not have to finish a word:
typing `tuttu` finds *tuttujuttu*. You do have to start it — `juttu` will not. Click a page to open it.
Works are listed too, marked as works. Sources have a search box of their own, on the **Sources**
screen, where each one is shown with its authors and its paper.

Your **sources** are not in these results. They have [their own screen](sources-and-citations.md),
where a source can be shown with its authors, its year and its paper — a bare title in a list
is the least useful way to meet one.

It works offline, and it works on a library too large to scroll through.

Narrowing to the pages under one page, or to the pages citing a particular source, comes later. That
second one is the useful one: *"What did I write based on this book?"* — and, when a source
turns out to be wrong, *"What do I now need to go back and fix?"*

## When you want the whole picture

Once you have more than a handful of pages, the sidebar stops showing you how things actually
relate. That is what [Mind maps](mind-maps.md) are for — the same pages, drawn as a picture, in
their own window.

## Libraries from an earlier version

Earlier versions had **topics** as well as documents. Opening a library made by one, the app
asks before changing anything. Say yes, and each topic becomes a page with the same name and
the documents that were in it under it, in the order they were shown. Nothing you wrote
changes, and every link and citation keeps working.

Before anything changes, the whole library is copied to a folder beside it, named after it with
`-format-1` on the end. Once you are happy with the converted library, delete the copy. Back up
straight afterwards: a backup made before converting cannot be brought back into the converted
library, so the next backup is the one that counts.

---

*Building the app rather than using it? See the [technical documentation](../technical/).*

# ADR 0005 · React and TipTap for the interface

> **Audience:** People building Personal Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-09-06

## Context

[ADR 0001](0001-tauri-rust-stack.md) fixed the shell and the engine but deliberately left the
interface framework and editor component open, on the grounds that they are interface-local
and affect neither the storage format nor the engine contract. M0 includes document editing,
so the decision is now due.

The constraint that decides it is the document model. A document is
[Markdown on disk](../storage-format.md#documents) carrying two custom inline constructs:

```
Complete proteins contain all nine essential amino acids.[^cite:01J8ZQ8...]
See also [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]].
```

On screen the first must render as *(Nieminen, 2021, p. 44)* and the second as the linked
document's title — while the file stays exactly the plain text above, because
[the user is promised they can read and edit it in any text editor](../../user/libraries-and-files.md).
So the editor needs a document model where a citation is a first-class inline node with its own
rendering, its own behaviour, and its own serialisation back to that syntax.

M4 adds a second requirement: a graph view in its own window, with hand-positioned nodes.

## Decision

React for the interface, TipTap (over ProseMirror) for the editor.

## Alternatives considered

**Svelte with CodeMirror 6.** Genuinely appealing: less boilerplate, smaller bundles, and very
pleasant to hand-write. Rejected on the editor. CodeMirror is a source-text editor — it models
a document as text with decorations laid over it, which is exactly right for editing code and
wrong for rendering a citation as formatted prose that cannot be typed into or split. That
work is possible with CodeMirror decorations, but it is building ProseMirror's document model
by hand, badly. Svelte's ecosystem for the M4 graph view is also markedly thinner.

**SolidJS with TipTap.** Keeps the editor strengths with a smaller runtime and no virtual DOM.
Rejected for ecosystem depth rather than for anything wrong with it: the graph view options are
weaker, and more integration work lands on a solo developer.

**Plain TypeScript, no framework.** Fewest dependencies. Rejected — the pane synchronisation in
M3 and the map in M4 are exactly the state-heavy problems a framework exists to handle.

## Consequences

**Easier.** A citation becomes a ProseMirror node type with its own rendering and its own
serialiser, which is what it actually is. Parallel-text panes in M3 and the map in M4 both have
mature React options (React Flow for the map). The largest ecosystem and the most available
help, which matters when there is one developer.

**Harder.** React is heavier at runtime than Svelte or Solid, and more ceremony per component.
ProseMirror has a real learning curve, and TipTap only partly hides it — the first custom node
type will cost more than it looks like it should.

**Consequence to act on now.** The custom node types for `[^cite:…]` and `[[…]]` are configured
in M0, even though M0 renders them plainly. Retrofitting node types into a working editor means
reworking every document interaction built before them.

## Revisit if

The editor is fighting ProseMirror's document model rather than using it — which would show up
as custom nodes needing escape hatches into raw text — or if React's weight becomes measurable
against the [startup constraint](../stack.md#constraints-these-choices-must-keep-satisfying).

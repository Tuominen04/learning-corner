# ADR 0004 · Documents and citations before parallel texts and maps

> **Audience:** People building Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-09-06

## Context

The project notes describe three pillars: documents with APA 7 sources, parallel texts for
language learning, and mind maps. All three are wanted. Only one can be first, and doing a
thin slice of all three is a third option.

This is a solo project, which makes the ordering more consequential than it would be with a
team: nothing gets built in parallel, and a milestone that does not reach usable is a milestone
that produces nothing.

## Decision

Milestone 1 is documents, sources, and APA 7 citation, complete enough to be the first
release. Parallel texts are M3 and mind maps are M4, with backup and restore at M2 in between.
See the [roadmap](../roadmap.md).

## Alternatives considered

**Parallel texts first.** Arguably the more immediately useful feature to the project's author,
and self-contained. Rejected because it needs the library, the storage format, the index, and
the editing surface built anyway — so it does not save the foundation work, it only defers the
feature that the foundation was designed around.

**A thin slice of all three.** Shows the whole vision early and is good for enthusiasm.
Rejected as the highest-risk option available to one person: three half-finished features, no
single thing good enough to rely on, and three data models being changed at once while none of
them is validated by real use.

## Consequences

**Easier.** The first release is the product's actual argument — that a claim should be
anchored to a source you chose — rather than a feature that happens to be convenient. Both later
pillars attach to documents, sources, and the storage format, so M1 builds the foundation under
them by being finished rather than by being planned around. The
[citation model](../citation-model.md) is the most specification-heavy part of the product, and
doing it first means it is done properly rather than fitted around existing features.

**Harder.** The language-learning use case — the one the author personally wants — waits until
M3. That is a real cost and it is worth naming rather than glossing over.

**Consequence worth noting.** M2 is backup and restore, before either remaining pillar.
Anyone using M1 has work worth losing, and adding features to an application that cannot yet
protect what a user has written is the wrong order regardless of how much the features are
wanted.

## Revisit if

M1 stretches long enough that nothing is usable, or real use of the language features becomes
urgent enough to reorder. Reordering M3 ahead of M2 is the one move to resist: it puts more
work at risk before the work is safe.

# ADR 0006 · The engine is pinned by git tag

> **Audience:** People building Personal Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-09-06

## Context

[ADR 0002](0002-separate-backend-repository.md) put the engine in its own repository, and
[Repositories](../repositories.md) required this repository to depend on "the pinned published
version" of it, forbidding a committed path dependency.

That rule had no mechanism behind it. It named no registry, and **both repositories are
private**, so crates.io — which does not host private crates — was never available. As written
the rule blocked the first integration permanently: the interface could not depend on the
engine at all, because nothing could ever be published.

The requirement underneath the rule is still right. The pin must be **immutable** (the same
reference always resolves to the same code), **reviewable** (a change to it appears in a diff),
and **enforceable in CI** (a local path dependency must not be able to reach `main`).

## Decision

The interface depends on the engine by **git tag**:

```toml
[dependencies]
plc-engine = { git = "https://github.com/Tuominen04/personal-learning-corner-engine", tag = "v0.1.0" }
```

Tags are immutable once pushed — never moved, never deleted, never reused. A version bump is a
one-line diff naming the old and new tag, which is exactly the review surface the rule wanted.
CI asserts the manifest carries a `tag` key, so a path dependency cannot merge.

## Alternatives considered

**A private registry.** A self-hosted registry, or crates.io once the repositories are public.
Correct at scale and wrong now: infrastructure to maintain, for one consumer, on a solo project.
Worth revisiting only if the engine gains consumers outside this project.

**A git submodule.** Immutable by commit and familiar. Rejected because submodules pin a commit
rather than a version, which loses the semantic-versioning signal
[Repositories](../repositories.md#versioning) depends on — and because they are a recurring
source of confusion for anyone cloning the project.

**A committed path dependency, monorepo in all but name.** Rejected: it dissolves the boundary
[ADR 0002](0002-separate-backend-repository.md) exists to enforce.

**Pinning by commit SHA rather than tag.** Equally immutable, and Cargo supports it. Rejected
for legibility: `tag = "v0.1.0"` says which released version is in use, `rev = "a3f9c21"` does
not. The semantic version is the thing being communicated.

## Consequences

**Easier.** No registry, no publishing step, no infrastructure. Works identically while the
repositories are private and after they are public. `Cargo.lock` records the resolved commit,
so a build is reproducible even if a tag were somehow tampered with.

**Harder.** `cargo update` cannot bump a tagged dependency — the manifest is edited by hand,
which is a small deliberate friction rather than a cost. A fetch from GitHub is needed to build,
so a fully offline first build requires a warm Cargo cache. Tag immutability is a discipline
enforced by convention and CI, not by the registry semantics that would enforce it elsewhere.

## Revisit if

The engine gains a consumer outside this project, or the repositories become public — at which
point crates.io becomes available and carries real advantages, and this decision is superseded
rather than amended.

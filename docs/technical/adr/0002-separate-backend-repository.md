# ADR 0002 · The engine is a separate repository

> **Audience:** People building Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-09-06

## Context

The original project notes stated the requirement directly: *the backend must be on its own
project.*

There are two readings. A separate top-level project inside this repository, independently
buildable; or a genuinely separate repository. The choice matters because it determines
whether the engine can ever be used by something other than this desktop application, and how
much friction a change across the boundary carries.

## Decision

Two repositories. `learning-corner` holds the desktop shell, the interface, and all
documentation. `learning-corner-engine` holds the engine. The interface depends on a
pinned published version of the engine, and [the contract](../backend-contract.md) — kept in
this repository — is normative for both.

## Alternatives considered

**A monorepo with two projects.** One clone, one issue tracker, one CI run, and versions that
cannot drift. Genuinely the more comfortable option day to day, and it satisfies the stated
requirement in the build sense.

Rejected for one reason that outweighs the comfort: in a monorepo, nothing prevents the
interface reaching past the contract. Not policy, not review — a shared type here, a helper
imported there, and within a year the boundary exists in the documentation and nowhere else.
That boundary is what makes the engine testable without an interface and what makes a future
command-line or mobile client possible. A repository boundary is the only version of that rule
that enforces itself.

**One project, no separation.** Contradicts the stated requirement and gives up the
[testability property](../testing.md#contract-tests) that the contract suite depends on.

## Consequences

**Easier.** The boundary cannot erode, because crossing it requires a published version. The
engine is provably usable with no interface, which is what the contract test suite asserts. A
second client — command line, mobile — becomes possible without extracting anything. Engine
tests run without any interface tooling installed.

**Harder.** A change spanning the boundary is three steps in two repositories, in a fixed
order ([Repositories](../repositories.md#the-contract-is-the-interface-between-them)). Local
development against an unreleased engine needs a path dependency that must not be committed.
Two sets of CI. For a solo developer this is real friction, paid on every contract change.

**Foreclosed.** Nothing permanently. Merging two repositories later is a mechanical exercise;
splitting a codebase whose boundary has eroded is not. The decision is deliberately made in the
direction that is cheap to reverse.

## Revisit if

The three-step change procedure is being routinely short-circuited, or the friction is
demonstrably slowing work more than the boundary is protecting anything — which would show up
as contract changes being batched or avoided rather than made when needed.

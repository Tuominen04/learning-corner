# ADR 0007 · TypeScript bindings are generated with ts-rs from the shell's wire types

> **Audience:** People building Personal Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-09-06

## Context

[Repositories](../repositories.md) requires that the boundary between the interface and the
engine have exactly one definition rather than two that drift, and that a contract change
surface as a build failure rather than a runtime surprise. The intended mechanism was
`tauri-specta`, generating TypeScript from the shell's command signatures.

Building M0 established that **`tauri-specta` has no stable release compatible with Tauri v2**:
`cargo add tauri-specta` resolves to v1.0.2, which targets Tauri v1, and the v2 line is
prerelease only. Depending on a prerelease crate for the type boundary of the whole
application is a poor trade at the foundation of a project.

## Decision

`ts-rs` generates TypeScript from **the shell's own wire types** in `src-tauri/src/dto.rs`.
Regeneration is a test, so `cargo test` keeps `src/lib/bindings/` current and CI fails on a
stale committed copy.

The shell defines its own types rather than exporting the engine's. It needs them regardless:
identifiers and revisions are deliberately opaque to the interface, and the boundary is where
that opacity is expressed.

## Alternatives considered

**`tauri-specta` v2 prerelease.** The intended design, and the better fit — it generates typed
*command wrappers*, not just the data types, so a wrong argument list is also a compile error.
Rejected only on stability. Worth revisiting when v2 is released.

**`ts-rs` on the engine's own types, in the engine repository.** The fallback originally
written down. Rejected on discovery that it is worse than the option above: it puts generated
TypeScript in a repository that has no interface, and then needs a cross-repository file sync
with a staleness check — machinery this decision avoids entirely by generating in the
repository that consumes the output.

**Hand-written TypeScript types.** Rejected: two definitions of the boundary, drifting
silently, with nothing able to check them against each other.

## Consequences

**Easier.** No prerelease dependencies. No cross-repository generated-file sync. A contract
change surfaces twice — as a Rust compile error in the shell and as a diff in the committed
bindings — and CI fails on the second even if someone forgets to look at the first.

**Harder.** Only the *data types* are generated, not the command signatures, so a call with a
wrong argument name is a runtime failure rather than a compile error. `src/lib/engine.ts` is
the mitigation: every call goes through one small file, so the surface where that mistake is
possible is a page long and reviewable.

Opaque values are expressed through the type system rather than by convention. `Revision` is
typed as a branded object, so the interface cannot read a field from it, compare two of them,
or construct one — which is exactly what the contract says about it in prose.

## Revisit if

`tauri-specta` v2 reaches a stable release. Its typed command wrappers close the one real gap
this decision leaves, and the migration is confined to `dto.rs` and `engine.ts`.

# Repositories

> **Audience:** People building Personal Learning Corner
> **Status:** In progress — M0 implemented
> **Last reviewed:** 2026-09-06

Two repositories, one product.

| Repository | Holds | Language |
| ---------- | ----- | -------- |
| `personal-learning-corner` (this one) | Desktop shell, interface, the engine contract as the shared specification, all documentation | TypeScript, Rust (shell glue) |
| `personal-learning-corner-engine` | The engine: library access, storage format, index, citations, alignment, backup comparison | Rust |

The engine repository **does not exist yet.** It is created at the start of M0. Until then,
[the contract](backend-contract.md) in this repository is the whole specification of it.

See [ADR 0002](adr/0002-separate-backend-repository.md) for why the split, and what it costs.

## Which repository does a change belong in?

| The change… | Goes in |
| ----------- | ------- |
| touches what is written to the library | engine |
| changes a citation string, alignment result, or search behaviour | engine |
| changes what the user sees, clicks, or arranges | this repository |
| changes packaging, installers, or the window | this repository |
| changes an operation across the boundary | **both**, contract first — see below |
| is documentation | this repository, always |

Documentation lives here even when it documents the engine. One place for docs, one place to
look, one check script. The engine repository carries only a README pointing back here, plus
Rust API documentation generated from its own source.

## The contract is the interface between them

[`backend-contract.md`](backend-contract.md) is normative for both sides and lives in this
repository. Changing it is a three-step sequence, in this order:

1. **Here:** change the contract document, in its own commit, with the rationale.
2. **Engine:** implement it, with contract tests covering the new or changed operation.
3. **Here:** consume it, and raise the required engine version.

Doing this in any other order produces two components that each believe the other is wrong.

## Versioning

The engine is a Rust crate depended on by this repository, pinned to an immutable git tag —
both repositories are private, so no registry is available. See
[ADR 0006](adr/0006-engine-dependency-pinning.md).

```toml
[dependencies]
plc-engine = { git = "https://github.com/Tuominen04/personal-learning-corner-engine", tag = "v0.1.0" }
```

- **Engine** uses semantic versioning against the contract: a breaking contract change is a
  major bump, a new operation is a minor bump, a fix that changes no documented behaviour is
  a patch. Each release is a tag, and **tags are immutable** — never moved, never deleted,
  never reused. A version bump is a one-line diff naming the old tag and the new one.
- **This repository** carries the product's user-facing version. It is the version on the
  installer and the one a user quotes in a bug report.
- **The library's storage format** has its own version, independent of both, recorded in the
  library itself. See [Storage format](storage-format.md). A user's library is not tied to
  the application version that created it.

Three version lines sounds like two too many until the first time someone restores a
two-year-old library into a current build. That case must work, and it only works if the
format version is separate.

## Development against an unreleased engine

Point the dependency at a local path while working on both at once:

```toml
plc-engine = { path = "../personal-learning-corner-engine/crates/plc-engine" }
```

**Never commit that.** CI asserts the manifest carries a `tag` key, so a path dependency
cannot reach `main` — otherwise the pin means nothing and the build stops being reproducible
on any machine but yours.

## Type bindings across the boundary

The shell defines its own wire types in `src-tauri/src/dto.rs` and converts the engine's
types into them. `ts-rs` generates `src/lib/bindings/` from those, and regeneration is a test —
so `cargo test` in `src-tauri` keeps the bindings current and CI fails on a stale committed
copy.

There is therefore no generated file to synchronise between repositories, and a contract change
surfaces twice: as a Rust compile error in the shell, and as a diff in the committed bindings.

See [ADR 0007](adr/0007-bindings-with-ts-rs.md) for why `ts-rs` rather than the `tauri-specta`
originally intended.

## Related

- [Engine contract](backend-contract.md)
- [Architecture](architecture.md)
- [Testing](testing.md)

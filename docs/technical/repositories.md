# Repositories

> **Audience:** People building Personal Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-10-04

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
| specifies what the engine must *do* | this repository |
| documents how the engine *is built* | engine repository |

## Which repository does documentation belong in?

Both carry documentation, split by whether it is normative.

**This repository holds the specification** — what the engine is required to do. The contract,
the storage format, the index's guarantees, the citation model, the alignment rules. It lives
with the product it describes rather than with one implementation of it, so a second client would
implement the same contract instead of copying the first client's behaviour. Where the engine and
these documents disagree, **these documents are right and the engine is wrong.**

**The engine repository holds its own implementation documentation** — its module layout, its
layering rules, how to build and test it, and how to call its API. None of that is a property of
the product; all of it would be noise in a specification. It is also the documentation a person
looks for while inside that repository, which is where it should be.

Neither duplicates the other. If a page in the engine repository starts describing what the
engine *must* do, it belongs here instead; if a page here starts describing how a particular
crate is organised internally, it belongs there.

Both trees follow the same conventions and each has its own `docs/check-docs.sh`.

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

The pin in `Cargo.toml` is never edited for this. A Cargo `[patch]` overrides it instead, from
`.cargo/config.toml` at the top of this repository, a file git ignores:

```toml
[patch."https://github.com/Tuominen04/personal-learning-corner-engine"]
plc-engine = { path = "/home/you/personal-learning-corner-engine/crates/plc-engine" }
```

`npm run engine:local` writes it and `npm run engine:pinned` removes it; see
[Development](development.md#working-on-both-at-once). A change spanning the boundary can then
be tried end to end, engine and window together, before anything is pushed or tagged. The
three steps above keep their order: the engine is still tagged, and the tag pinned, before the
interface's side merges.

**A local engine never reaches `main`.** While the patch is on, `Cargo.lock` records the
engine as a folder on your machine, and it is the one committed file that could carry that
into a commit. The pre-commit hook `engine:local` installs refuses it, and so does `npm test`
in CI, which checks the committed manifest and lock — a path written into `Cargo.toml` too.
Otherwise the pin means nothing, and the build stops being reproducible on any machine but
yours.

## Building in CI

The engine is a **private** repository, so fetching it needs a credential. `actions/checkout`
issues a token scoped to the repository it checked out and nothing else, so `cargo` fetching the
engine has nothing to authenticate with and the build fails with
`failed to acquire username/password from local configuration`.

This is a direct consequence of the two-repository split
([ADR 0002](adr/0002-separate-backend-repository.md)) meeting two private repositories, and it
does not show up locally, where a developer's own credential covers both.

The fix is a fine-grained personal access token with **read access to the engine repository
only**, stored as a secret in this repository, and a step before any `cargo` invocation:

```yaml
      - name: Authenticate cargo for the private engine repository
        env:
          ENGINE_TOKEN: ${{ secrets.ENGINE_READ_TOKEN }}
        run: |
          git config --global \
            url."https://x-access-token:${ENGINE_TOKEN}@github.com/".insteadOf \
            "https://github.com/"
          echo "CARGO_NET_GIT_FETCH_WITH_CLI=true" >> "$GITHUB_ENV"
```

`CARGO_NET_GIT_FETCH_WITH_CLI` matters as much as the token: without it `cargo` uses its own git
implementation, which does not read the `insteadOf` rewrite, and the token is ignored.

Making the engine repository public removes this entirely, and would also reopen crates.io as an
option — see [ADR 0006](adr/0006-engine-dependency-pinning.md), whose *Revisit if* covers exactly
that case.

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

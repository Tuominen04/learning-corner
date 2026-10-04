# Development

> **Audience:** People building Personal Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-10-04

Getting from a fresh clone to a running window.

## Prerequisites

### Rust

**Pinned.** `rust-toolchain.toml` fixes the version, and rustup installs it — with clippy and
rustfmt — on your first `cargo` command. Nothing to do.

It exists because clippy gains lints with every release, and a lint that does not exist in your
local version cannot warn you. Unpinned, CI ran whatever stable was that week while a
contributor might be several releases behind, and a change passed every check on one machine
and failed on the other over a lint nobody could see locally. The engine repository carries the
same pin, since two compilers building one product is a difference nobody wants to debug.

**Bumping it is its own change**, never a line inside somebody else's: edit the channel, run
the checks, fix whatever the newer clippy has learned to notice, push that alone. Dependabot
does not track it — no ecosystem covers a Rust toolchain — which is the right shape for
something that can turn every check red at once.

If you are not using rustup, install the matching version and its components by hand
(`sudo dnf install clippy rustfmt` on Fedora), and expect to meet this problem again.

### Node

22 or newer, for the interface and the build tooling.

### System libraries

Tauri uses the system webview rather than bundling a browser
([ADR 0001](adr/0001-tauri-rust-stack.md)), so the shell links against GTK and WebKitGTK at
**build** time. Without them `cargo` fails in a build script with
`Package 'webkit2gtk-4.1' was not found in the pkg-config search path`, long before any code of
ours compiles.

On Fedora:

```sh
sudo dnf install webkit2gtk4.1-devel libsoup3-devel \
                 libappindicator-gtk3-devel librsvg2-devel openssl-devel
sudo dnf group install "c-development"
```

| Package | Supplies |
| --- | --- |
| `webkit2gtk4.1-devel` | `webkit2gtk-4.1.pc` and `javascriptcoregtk-4.1.pc` |
| `libsoup3-devel` | `libsoup-3.0.pc` |
| `libappindicator-gtk3-devel` | Tray and indicator support |
| `librsvg2-devel` | Icon rendering during bundling |

These are **build** dependencies. What a user needs merely to *run* an installed package is a
shorter list, declared by the RPM — see [Packaging for Fedora](packaging-fedora.md).

Windows and macOS are M5 and are not set up here yet.

## Running it

```sh
npm install
npm run tauri dev
```

The first run compiles Tauri and the engine from scratch — several minutes, with no output for
much of it. Later runs are fast.

**Use the window it opens.** `tauri dev` also starts Vite on `http://localhost:5173`, and
opening that address in an ordinary browser gives you the page with nothing behind it: no
engine, no native file dialogs. The interface detects this and says so rather than presenting
buttons that cannot work, but the time to lose is the first five minutes, so: the real window
has no address bar.

## Dependencies

Dependabot opens updates weekly, Monday morning: npm, the `src-tauri` crates, and the GitHub
Actions. Minor and patch are grouped so the routine bumps arrive as one thing to read, and the
interface's build tooling is grouped separately because it breaks differently from what ships.

The **engine is excluded**. It is pinned to an immutable tag and bumped when a release is cut
([ADR 0006](adr/0006-engine-dependency-pinning.md)) — an automatic bump would defeat the point
of pinning it, and Dependabot cannot see a private git dependency in any case.

## Checks

Everything CI runs, runnable locally:

```sh
npm run lint            # eslint
npm run typecheck       # tsc --noEmit
npm test                # unit tests, and the engine pin check
npm run engine:check    # just the engine pin: a tagged release, and the lock agrees
npm run build           # typecheck plus a production bundle
bash docs/check-docs.sh # documentation conventions

cd src-tauri
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test              # also regenerates src/lib/bindings/
```

`cargo test` in `src-tauri` regenerates the TypeScript bindings
([ADR 0007](adr/0007-bindings-with-ts-rs.md)). If `git diff -- src/lib/bindings` is non-empty
afterwards, commit the result: CI fails on a stale copy, because a stale copy means the
interface is typed against a contract that no longer exists.

### In a browser

The browser checks ([Testing](testing.md#interface-tests)) need a Chromium. Playwright's own,
the one they are tested against, is one command, once:

```sh
npx playwright install chromium
npm run e2e                     # every check, a few at a time: under a minute
npm run e2e -- moving layout    # just the files whose names contain either word
```

They start a Vite server of their own on a free port, so a `tauri dev` already running does
not get in the way. Playwright's Chromium usually runs on Fedora as it is; if it stops at a
missing library, `dnf` has it — or skip it and use Fedora's own Chromium:
`PLC_E2E_CHROMIUM=/usr/bin/chromium-browser npm run e2e`.

A new check is a file in `e2e/checks/` that imports `launch`, `check`, `finish` and `URL` from
`e2e/support.mjs`. Any of the others shows the pattern: a stub engine set up before the page
loads, then the screen driven the way a person would drive it.

## The engine

Pinned by immutable git tag ([ADR 0006](adr/0006-engine-dependency-pinning.md)):

```toml
plc-engine = { git = "…-engine", tag = "v0.1.0" }
```

### Working on both at once

To try an engine change in the window before it is tagged, build against your engine checkout:

```sh
npm run engine:local     # the checkout beside this one; or name it: npm run engine:local -- <path>
npm run tauri dev        # builds the engine from that checkout
npm run engine:status    # which engine is in use
npm run engine:pinned    # back to the tagged release
```

An edit in the engine checkout reaches the next `tauri dev` or `cargo test` with no push and no
tag. With no path given, `engine:local` looks in `$PLC_ENGINE_DIR`, then in
`../personal-learning-corner-engine`.

It is a Cargo `[patch]` in `.cargo/config.toml` at the top of this repository, a file git
ignores, so `Cargo.toml` keeps its tag throughout. The one committed file that changes is
`src-tauri/Cargo.lock`: while the patch is on, the engine's entry loses its `source` line,
because the engine now comes from a folder. `engine:pinned` removes the patch and resolves
again, which puts the lock back. If it still differs from the last commit afterwards — a new
dependency in the local engine can move a version the two share — `engine:pinned` says so, and
`git checkout -- src-tauri/Cargo.lock` restores the committed one.

**That lock must never be committed**, because it builds on your machine and nowhere else
([ADR 0006](adr/0006-engine-dependency-pinning.md)):

- `engine:local` installs a pre-commit hook that refuses a commit unless its `Cargo.toml` and
  `Cargo.lock` both pin the same tagged release. Other work commits as usual while the patch
  is on, as long as the lock is not part of it. The hook stays after `engine:pinned`, where it
  passes; deleting `.git/hooks/pre-commit` removes it. If you already have a pre-commit hook,
  it is left alone: have it run `node scripts/engine.mjs check --staged`.
- `npm test` runs the same check on the files as they are, so CI refuses a local engine that
  got past the hook.

When the engine change is merged and tagged, finish on the interface side with
`npm run engine:pinned`, then raise the tag in `src-tauri/Cargo.toml` and run `cargo test` in
`src-tauri`. That updates the lock to the new tag; commit the manifest and the lock together.

### In CI

The engine repository is private, so CI needs its own credential to fetch it. See
[Repositories](repositories.md#building-in-ci).

## Layout

```
src/                 the interface
├── lib/engine.ts    the only place invoke is called
├── lib/body.ts      text on disk ↔ editor document model
├── lib/bindings/    generated — do not edit
└── components/
src-tauri/           the desktop shell
├── src/dto.rs       wire types; the bindings are generated from these
└── src/commands.rs  the commands the interface may call
e2e/                 the browser checks, and the runner for them
docs/                specification and guides
```

## Related

- [Architecture](architecture.md) — where logic is allowed to live
- [Testing](testing.md) — what is tested and why
- [Packaging for Fedora](packaging-fedora.md) — building something installable

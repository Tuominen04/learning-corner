# Development

> **Audience:** People building Personal Learning Corner
> **Status:** In progress — M0 implemented
> **Last reviewed:** 2026-09-07

Getting from a fresh clone to a running window.

## Prerequisites

### Rust

1.82 or newer. **`clippy` and `rustfmt` ship separately from `cargo`** and CI runs both:

```sh
rustup component add clippy rustfmt          # with rustup
sudo dnf install clippy rustfmt              # Fedora, without rustup
```

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

## Checks

Everything CI runs, runnable locally:

```sh
npm run lint            # eslint
npm run typecheck       # tsc --noEmit
npm test                # the body round-trip tests
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

## The engine

Pinned by immutable git tag ([ADR 0006](adr/0006-engine-dependency-pinning.md)):

```toml
plc-engine = { git = "…-engine", tag = "v0.1.0" }
```

To work on both at once, point it at a local path — and **never commit that**, because it
builds on your machine and nowhere else. CI asserts the manifest carries a `tag`.

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
docs/                specification and guides
```

## Related

- [Architecture](architecture.md) — where logic is allowed to live
- [Testing](testing.md) — what is tested and why
- [Packaging for Fedora](packaging-fedora.md) — building something installable

# Stack

> **Audience:** People building Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-09-06

## Chosen

| Layer | Choice | Why |
| ----- | ------ | --- |
| Desktop shell | **Tauri v2** | Native RPM and Flatpak output for the Fedora-first target; uses the system webview instead of bundling a browser, so installs are single-digit megabytes; the same project builds Windows and macOS later without a rewrite |
| Engine | **Rust** | Tauri's native side is Rust already, so no third runtime; the correctness-critical work (file writes, conflict detection, citation formatting) benefits from a type system that makes invalid states hard to express; single static binary is trivial to package |
| Interface | **TypeScript** + **React** | Fast iteration on a UI with panes, drag-and-drop, and a graph view; the deepest ecosystem for the editor and for the M4 map (React Flow). See [ADR 0005](adr/0005-react-tiptap-interface.md) |
| Editor | **TipTap** (ProseMirror) | Citations and document links are first-class inline nodes with their own rendering and serialisation, while the file on disk stays plain Markdown. See [ADR 0005](adr/0005-react-tiptap-interface.md) |
| Type bindings | **ts-rs** | TypeScript generated from the shell's wire types, so a contract change surfaces as a compile error and a bindings diff. `tauri-specta` was intended but has no Tauri v2 stable release — see [ADR 0007](adr/0007-bindings-with-ts-rs.md) |
| Derived index | **SQLite** with full-text search | Embedded, no service to run, mature full-text search. Used only as a derived cache — see [Search index](search-index.md) |
| Library files | **Markdown with a metadata header**, plus small structured files for sources and works | Readable in any editor, diffable, survives us. See [Storage format](storage-format.md) |

See [ADR 0001](adr/0001-tauri-rust-stack.md) for the shell and engine alternatives, and
[ADR 0005](adr/0005-react-tiptap-interface.md) for the interface and editor.

## Versions

Pinned when M0 begins; this table is filled in then, not guessed now.

| | Minimum | Pinned |
| --- | --- | --- |
| Rust | 1.90 (shell; Tauri 2.12 needs it) · 1.82 (engine) | 1.98.0 |
| Tauri | 2.x | 2.12 |
| Node.js (build only) | 22 | |
| React | 19.x | |
| TipTap | 3.x | |
| Fedora | 42 | |

A release build of the shell is **15 MB**, against the 50 MB constraint below.

## Deliberately excluded

Each of these has been considered and rejected. Reintroducing one is an ADR, not a pull
request.

| Excluded | Why |
| -------- | --- |
| Any server or cloud component | Contradicts principle 1 in [Architecture](architecture.md). There is nothing to host and nothing to breach |
| User accounts and authentication | Nothing to authenticate against. One user, one machine |
| Telemetry, crash reporting, update pings | The application must be silent on the network. Bug reports are something a user chooses to send |
| Electron | ~150 MB installs and a bundled browser, for a note-taking app packaged natively on Fedora. See [ADR 0001](adr/0001-tauri-rust-stack.md) |
| An ORM | The index is a derived cache with a handful of tables and hand-written queries. An ORM would be more machinery than the problem has |
| A network-fetching citation lookup, in the first releases | Optional convenience later; must never become the supported path for entering a source |
| Real-time collaboration, CRDTs | Single-writer by design. This assumption is what lets the storage format and conflict model stay simple |

## Constraints these choices must keep satisfying

If any of these stops being true, the stack decision is due for review:

- A cold start to a usable window in **under two seconds** on ordinary hardware.
- Search results in **under 200 ms** on a library of 10,000 documents.
- Installed size **under 50 MB**.
- No network traffic in a default session — verifiable by running the app with networking
  disabled and observing no degradation.
- The engine builds and its full test suite runs **with no interface present**.

## Related

- [Architecture](architecture.md)
- [Packaging for Fedora](packaging-fedora.md)
- [Repositories](repositories.md)

# ADR 0001 · Tauri and Rust for a Fedora-first desktop application

> **Audience:** People building Learning Corner
> **Status:** Accepted
> **Last reviewed:** 2026-09-06

## Context

Learning Corner is a local-only desktop application with no server component, first
targeting Fedora and later Windows and macOS. It needs a rich interface — a text editor,
multiple synchronised panes, drag-and-drop, and a graph view in a second window — and a
correctness-critical core that writes the user's files, formats citations, and decides backup
conflicts.

Two constraints shape the choice. The first release must be **packaged natively for Fedora**,
so users install with `dnf` rather than downloading a bundle. And the
[core principles](../architecture.md#principles) put the user's data above everything: a
class of bug that corrupts a library is unacceptable in a way that a rendering bug is not.

## Decision

Tauri v2 for the desktop shell, a web interface in TypeScript, and a Rust engine holding all
logic that touches the user's data.

## Alternatives considered

**Electron with a Node.js backend.** One language throughout, the largest ecosystem, and the
easiest path for a solo developer. Rejected on two counts. Installed size: roughly 150 MB for
a bundled browser, in a note-taking application whose competition on Fedora installs in
single-digit megabytes. And packaging: Electron's Linux story is AppImage and Flatpak, while
the RPM this project wants is an afterthought — which inverts the primary target.

**A web interface with a Python backend.** Attractive for the language features, where
Python's text-processing and transliteration libraries are strong. Rejected on packaging: a
Python runtime inside a desktop installer is the most awkward of the three options, and it
would be awkward on all three platforms rather than just one. The language work it would help
with is M3; the packaging pain would start at M0.

**A native GTK application in Rust or Vala.** The best possible Fedora citizen. Rejected
because the interface is the part that changes most — panes, an editor, a graph view — and
iterating on it in a web stack is markedly faster, while the cross-platform path afterwards is
a genuine cost rather than a hypothetical one.

**Staying stack-agnostic and deciding later.** Rejected because the storage format and the
engine contract are being specified now, and a specification written to avoid committing to
anything tends to be vague in exactly the places that matter.

## Consequences

**Easier.** Native RPM and Flatpak output from the same project. Installs in single-digit
megabytes using the system webview. One native language, since Tauri's own side is Rust
already — no third runtime. The correctness-critical layer gets a type system that makes
invalid states hard to express, which is worth most exactly where the risk is highest.
Windows and macOS become packaging work rather than a rewrite.

**Harder.** Two languages, so a change crossing the boundary touches both. Rust is slower to
write than TypeScript, particularly for a solo developer, and that cost is paid on every
engine change. The system webview means rendering differs slightly across platforms and
versions — a real cost that Electron pays money to avoid.

**Foreclosed.** Nothing structural: the interface is replaceable behind the
[engine contract](../backend-contract.md), and the engine is usable without any interface at
all.

## Revisit if

The system webview turns out to differ enough between Fedora versions to cost more than the
size saving is worth; or the two-language boundary is measurably slowing development on
features that are mostly interface work.

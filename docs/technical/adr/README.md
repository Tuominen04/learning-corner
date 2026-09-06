# Decision records

> **Audience:** People building Personal Learning Corner
> **Status:** Implemented
> **Last reviewed:** 2026-09-06

A record of the decisions that would be expensive to reverse, and what each one cost.

Write one when a choice will constrain later work, when a reasonable person would ask "why is
it done this way?", or when something on a "deliberately excluded" list is being reconsidered.
Do not write one for choices a pull request can undo.

Records are numbered, immutable once accepted, and superseded rather than edited. Changing
your mind means a new record that says which one it replaces — the wrong decision and the
reason it was made are the useful part of the history.

| # | Decision | Status |
| - | -------- | ------ |
| [0001](0001-tauri-rust-stack.md) | Tauri and Rust for a Fedora-first desktop application | Accepted |
| [0002](0002-separate-backend-repository.md) | The engine is a separate repository | Accepted |
| [0003](0003-files-as-source-of-truth.md) | Files are the source of truth; the index is derived | Accepted |
| [0004](0004-milestone-one-scope.md) | Documents and citations before parallel texts and maps | Accepted |
| [0005](0005-react-tiptap-interface.md) | React and TipTap for the interface | Accepted |
| [0006](0006-engine-dependency-pinning.md) | The engine is pinned by git tag | Accepted |
| [0007](0007-bindings-with-ts-rs.md) | TypeScript bindings generated with ts-rs | Accepted |
| [0008](0008-narrow-editor-schema.md) | A narrow editor schema until Markdown serialisation exists | Accepted |

## Template

```markdown
# ADR NNNN · Title

> **Audience:** People building Personal Learning Corner
> **Status:** Proposed | Accepted | Superseded by ADR NNNN
> **Last reviewed:** YYYY-MM-DD

## Context
What is true that forces a decision. Constraints, not preferences.

## Decision
What we are doing. One paragraph, in the present tense.

## Alternatives considered
Each one, and the actual reason it lost. "It was worse" is not a reason.

## Consequences
What this makes easy, what it makes hard, and what it forecloses.

## Revisit if
The observation that would make this decision wrong.
```

The last section is the one that earns its keep. A decision recorded without the condition
that would overturn it becomes folklore — everyone remembers the rule and nobody remembers
whether it still applies.

# CI configuration

`github-workflow.yml` belongs at `.github/workflows/ci.yml`. It is parked here because the
credential these branches were pushed with has no `workflow` scope, and GitHub refuses pushes
that create or change anything under `.github/workflows/`.

To activate it:

```sh
git mv ci/github-workflow.yml .github/workflows/ci.yml
rmdir ci
git commit -m "Activate CI workflow"
```

Three jobs:

| Job | Runs |
| --- | ---- |
| `docs` | `docs/check-docs.sh` — headers, links, and the user-guide vocabulary tripwire |
| `interface` | lint, typecheck, the body round-trip tests, and the production build |
| `shell` | `cargo fmt --check`, `clippy -D warnings`, `cargo test`, plus two guards |

The two guards are the ones worth keeping. **Bindings are current** fails if
`src/lib/bindings/` differs after regeneration — a stale copy means the interface is typed
against a contract that no longer exists, which is exactly what generating them is meant to
prevent. **Engine is pinned** fails on a path dependency, because one builds on its author's
machine and nowhere else ([ADR 0006](../docs/technical/adr/0006-engine-dependency-pinning.md)).

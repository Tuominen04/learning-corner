# Contributing

Thank you for looking. Learning Corner is a one-person project, and reports, ideas and fixes from
other people make it better.

## Where things go

| You want to… | Go to |
| --- | --- |
| report something that does not work | [a bug report](https://github.com/Tuominen04/learning-corner/issues/new/choose) |
| suggest that something existing could work better | [an improvement](https://github.com/Tuominen04/learning-corner/issues/new/choose) |
| suggest a new feature | [an idea discussion](https://github.com/Tuominen04/learning-corner/discussions/new?category=ideas) |
| ask a question | [Q&A](https://github.com/Tuominen04/learning-corner/discussions/new?category=q-a) |
| report a security problem | privately — see [SECURITY.md](SECURITY.md) |

Not sure whether the problem is in the app or the
[engine](https://github.com/Tuominen04/learning-corner-engine)? Report it here; it is moved if
need be.

## Pull requests

Small fixes — a typo, a broken link, a clearer message, a missing test — are welcome straight
away as a pull request.

For anything bigger, **open an issue or a discussion first** and wait for a reply before writing
the code. Agreeing on the change first means your time is never spent on something that cannot
be merged. Behaviour is specified in [`docs/technical/`](docs/technical/), and a change to what
the app does usually changes a page there too.

Before you push, run what CI runs:

```sh
bash docs/check-docs.sh
npm run lint && npm run typecheck && npm test
(cd src-tauri && cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test)
```

[Development](docs/technical/development.md) gets you from a fresh clone to a running window, and
[Conventions](docs/CONVENTIONS.md) covers the documentation rules — including the words the user
guide is not allowed to use. The pull request template asks for the rest.

## Who merges and releases

The maintainer reviews and merges every pull request, and is the only one who creates release
tags. `main` only changes through a pull request with passing checks, and a published tag never
moves.

## Licence of contributions

The project is dual licensed under [MIT](LICENSE-MIT) or [Apache 2.0](LICENSE-APACHE). Unless you
say otherwise, anything you contribute is offered under the same terms — there is nothing extra
to sign.

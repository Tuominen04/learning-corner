# Security

## Reporting a problem

Please **do not** open a public issue for a security problem. Report it privately instead:
[open a private advisory](https://github.com/Tuominen04/learning-corner/security/advisories/new).
Only the maintainer can see it.

Say what you found, how to reproduce it, and what someone could do with it. You will get a reply
within a week. Once it is fixed and released, the advisory is published with credit to you,
unless you would rather stay anonymous.

If the problem is in the [engine](https://github.com/Tuominen04/learning-corner-engine) — the part
that reads and writes the library — reporting it here is fine too.

## What counts

Learning Corner works only with files on your own machine. The most serious problems are those
where a crafted library, document or imported file can:

- make the app read or write outside the library folder,
- run code, or load anything from the network, despite the app's content security policy,
- destroy or silently change content the person did not ask to change.

The app makes no network requests and has no server or account, so there is no service to
attack.

## Supported versions

Only the latest release receives fixes.

## Verifying a download

Every release lists a `SHA256SUMS` file and carries a build attestation proving the packages
were built by this repository's release workflow from the tagged commit:

```sh
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify learning-corner-*.rpm --repo Tuominen04/learning-corner
```

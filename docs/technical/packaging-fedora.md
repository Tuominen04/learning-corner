# Packaging for Fedora

> **Audience:** People building and releasing Personal Learning Corner
> **Status:** Planned
> **Last reviewed:** 2026-09-06

Fedora is the first target ([ADR 0001](adr/0001-tauri-rust-stack.md)). Windows and macOS come
after the Linux build is solid, and are packaging work rather than a rewrite.

## Two artefacts

| Artefact | For |
| -------- | --- |
| **RPM** | `sudo dnf install ./personal-learning-corner-*.rpm`, and a future Fedora package |
| **Flatpak** | Flathub, and every other Linux distribution without a second packaging effort |

Tauri produces both. The RPM is the primary artefact because it is what a Fedora user
expects; the Flatpak is what makes "Linux" mean more than "Fedora" without more work.

## Runtime dependencies

Tauri uses the system webview rather than bundling a browser, so the RPM depends on
`webkit2gtk` and `libappindicator`. Exact package names and minimum versions are pinned when
M0 establishes the build, and CI must install the same versions the RPM declares — a
dependency that only exists on the build machine is a bug the maintainer never sees.

## Directories

The distinction that matters: the **library** is the user's and lives where they chose;
everything else is the application's and follows the XDG base directory specification.

| What | Where | Notes |
| ---- | ----- | ----- |
| The library | Anywhere the user picked | Never assumed, never defaulted to a hidden path |
| Application settings | `$XDG_CONFIG_HOME/personal-learning-corner/` | Window state, recent libraries, preferences |
| Application cache | `$XDG_CACHE_HOME/personal-learning-corner/` | Disposable |
| Logs | `$XDG_STATE_HOME/personal-learning-corner/` | Local only, never transmitted |

Nothing derived from a library goes in these directories — the index lives inside the library
at `.plc/` ([Search index](search-index.md)) so that copying the folder copies everything and
opening it on another machine needs nothing else.

**Recent libraries** in application settings is a convenience only. Losing that file must cost
the user a file-picker dialog and nothing more.

## Flatpak and the filesystem

This is the one place where the sandbox and the product's design pull against each other. The
application must be able to read and write a folder the user chose anywhere, plus removable
drives for backup.

Requested permissions, and no more:

| Permission | Why |
| ---------- | --- |
| `--filesystem=home` | Libraries live in the user's own folders |
| `--filesystem=/run/media` | External drives, for backup and restore |
| No network permission at all | The application makes no network requests |

Declaring no network permission is worth doing for its own sake. It moves "we do not
transmit your work" from a claim in the documentation to something enforced by the sandbox and
visible to the user in their software installer.

If a later optional feature needs the network — the source lookup discussed in
[Sources and citations](../user/sources-and-citations.md) — it does not get added quietly. It
is an ADR, a permission the user can see, and a feature that is off by default.

## Releases

Tagged, versioned per [Repositories](repositories.md), built in CI. Each release publishes the
RPM, the Flatpak bundle, digests for both, and a changelog written for users rather than from
commit messages.

There is **no in-application update check.** The application does not contact anything on
startup; updates arrive through `dnf` or Flatpak like every other package on the system. An
update ping is network traffic in a product that promises none.

## Verifying a build

Before a release is published, on a clean Fedora installation:

1. Install from the RPM. Launch it. Create a library, write a document, cite a source.
2. Confirm cold start under two seconds and installed size under 50 MB
   ([Stack](stack.md#constraints-these-choices-must-keep-satisfying)).
3. Disable networking entirely and repeat step 1. Everything must work identically.
4. Back up to a removable drive; unplug it; restore into a fresh location.
5. Install the Flatpak and repeat steps 1 and 4, confirming the sandbox permits the library
   folder and the drive.
6. Uninstall. Confirm the library folder is untouched.

Step 6 is not a formality. Uninstalling an application must never remove a user's work, and
that is a property that only stays true if someone checks it.

## Related

- [Stack](stack.md)
- [Roadmap](roadmap.md)
- [Testing](testing.md)

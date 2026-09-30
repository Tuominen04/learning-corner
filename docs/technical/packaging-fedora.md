# Packaging for Fedora

> **Audience:** People building and releasing Personal Learning Corner
> **Status:** In progress — M0 implemented
> **Last reviewed:** 2026-09-28

Fedora is the first target ([ADR 0001](adr/0001-tauri-rust-stack.md)). Windows and macOS come
after the Linux build is solid, and are packaging work rather than a rewrite.

## Two artefacts

| Artefact | For |
| -------- | --- |
| **RPM** | `sudo dnf install ./personal-learning-corner-*.rpm`, and a future Fedora package |
| **Flatpak** | Flathub, and every other Linux distribution without a second packaging effort |

Tauri produces both. The RPM is the primary artefact because it is what a Fedora user
expects; the Flatpak is what makes "Linux" mean more than "Fedora" without more work.

## Dependencies

Tauri uses the system webview rather than bundling a browser, so both building and running link
against GTK and WebKitGTK. **Build and runtime are different lists**, and conflating them is how
a package installs and then fails to start.

**Building** needs the `-devel` packages, and is documented for contributors in
[Development](development.md#system-libraries):
`webkit2gtk4.1-devel`, `libsoup3-devel`, `libappindicator-gtk3-devel`, `librsvg2-devel`,
`openssl-devel`.

**Running** needs only the libraries themselves — `webkit2gtk4.1`, `libappindicator-gtk3`,
`librsvg2` — which the RPM declares as requires. Tauri generates most of this; the declared set
must be checked against a clean Fedora install rather than assumed, which is what step 1 of
[Verifying a build](#verifying-a-build) is for.

CI installs the build list. A dependency present on the build machine but absent from the RPM's
requires is a bug the maintainer never sees and every user hits.

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

The file is `recent-libraries.toml`: the ten libraries opened most recently, each with its path,
its name, and when it was opened. Renaming a library renames it here too, without moving it up
the list, and if its folder followed the new name the entry follows the folder. The shell reads
and writes it and the engine never sees it —
the list is about this computer, not about any library. Everything else follows from its being
a convenience:

- A file that cannot be read is an empty list, and is replaced the next time a library opens.
- A list that cannot be written is reported to the log and nowhere else. It never stops a
  library from opening.
- A library whose folder is missing stays listed, marked as not found. It may be on a drive
  that is not plugged in, and only the user can tell that from a library that is gone.
- The same folder reached by another path — a symlink, a trailing slash — is one entry.

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

//! The libraries this computer has opened, most recent first.
//!
//! The one thing the shell keeps from one run to the next, and a convenience only: losing the
//! file costs a folder dialog and nothing more (`packaging-fedora.md`). Everything here
//! follows from that. A list that cannot be read is an empty list, a list that cannot be
//! written is the old list next time, and neither ever stops a library from opening.
//!
//! Nothing from inside a library is kept here — only where it is, what it was called, and two
//! conveniences of this computer's: the folder it was last backed up to, and which panes each
//! of its works was showing. Neither is the library's business: a drive's path means nothing
//! on another computer, and a pane's being shown is not a change to back up.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use lc_engine::{Error, Result, Timestamp};
use serde::{Deserialize, Serialize};

/// The file's name, inside the application's settings folder.
pub const FILE: &str = "recent-libraries.toml";

/// Enough to fill a start screen, and few enough to take in at a glance.
const KEEP: usize = 10;

/// What the file says about itself, to whoever opens it.
const HEADER: &str = "\
# The libraries this computer has opened, most recent first.
#
# A convenience only: deleting this file costs one folder dialog, the folder each library was
# last backed up to, and which panes its works were showing. Nothing in it is needed to open a
# library, and nothing from inside any library is kept here.

";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Entry {
    pub path: PathBuf,
    /// What the library was called when it was last opened, so the list reads as names —
    /// and still reads when the folder is on a drive that is not plugged in.
    pub name: String,
    pub opened: Timestamp,
    /// The folder it was last backed up to or brought back from, on this computer.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub backup: Option<PathBuf>,
    /// The editions hidden in each work, by work id. A work showing every pane is not listed.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub hidden_panes: BTreeMap<String, Vec<String>>,
}

/// What this computer remembers about one library, beyond where it is.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Remembered {
    pub backup: Option<PathBuf>,
    pub hidden_panes: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct List {
    #[serde(default, rename = "library")]
    libraries: Vec<Entry>,
}

/// Where the list is kept.
///
/// `None` when there is nowhere to keep it — no settings folder at all. The list is then
/// always empty and remembering does nothing, which costs a folder dialog on every start: the
/// cost this file exists to save, and nothing worse.
pub struct Recent {
    file: Mutex<Option<PathBuf>>,
}

impl Recent {
    pub fn at(file: Option<PathBuf>) -> Self {
        Recent {
            file: Mutex::new(file),
        }
    }

    /// The list, most recent first. Empty if there is none, or it cannot be read.
    ///
    /// A library whose folder has gone is still listed. It may be on a drive that is not
    /// plugged in, and it is still somebody's library; taking it off is theirs to decide.
    pub fn list(&self) -> Vec<Entry> {
        let file = self.file.lock().unwrap_or_else(|e| e.into_inner());
        file.as_deref().map(read).unwrap_or_default()
    }

    /// Put `path` at the top, called `name`, opened now.
    ///
    /// The same folder reached by another spelling — a trailing slash, a symlink, `..` — is
    /// the same library, so it is kept by its canonical path and listed once.
    pub fn opened(&self, path: &Path, name: &str) -> Result<()> {
        let file = self.file.lock().unwrap_or_else(|e| e.into_inner());
        let Some(file) = file.as_deref() else {
            return Ok(());
        };

        let path = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        let mut libraries = read(file);
        // What was remembered about it stays with it: opening is not forgetting.
        let before = libraries.iter().position(|entry| entry.path == path);
        let (backup, hidden_panes) = before
            .map(|at| libraries.remove(at))
            .map(|e| (e.backup, e.hidden_panes))
            .unwrap_or_default();
        libraries.insert(
            0,
            Entry {
                path,
                name: name.to_string(),
                opened: Timestamp::now(),
                backup,
                hidden_panes,
            },
        );
        libraries.truncate(KEEP);
        write(file, libraries)
    }

    /// The library that was at `from` is called `name` now, and lives at `to` — which is
    /// `from` again unless its folder followed the name.
    ///
    /// It keeps its place and its date: being renamed is not being opened. A library that is
    /// not on the list is not put there by this. `from` is looked for as it is given, since
    /// after a move there is nothing left there to resolve; the caller resolves it first.
    pub fn renamed(&self, from: &Path, to: &Path, name: &str) -> Result<()> {
        let file = self.file.lock().unwrap_or_else(|e| e.into_inner());
        let Some(file) = file.as_deref() else {
            return Ok(());
        };

        let from = fs::canonicalize(from).unwrap_or_else(|_| from.to_path_buf());
        let to = fs::canonicalize(to).unwrap_or_else(|_| to.to_path_buf());
        let mut libraries = read(file);
        let Some(at) = libraries.iter().position(|entry| entry.path == from) else {
            return Ok(());
        };
        // An old entry for whatever used to be at `to` is about this library now.
        if from != to {
            libraries.retain(|entry| entry.path != to);
        }
        let at = libraries
            .iter()
            .position(|entry| entry.path == from)
            .unwrap_or(at);
        libraries[at].path = to;
        libraries[at].name = name.to_string();
        write(file, libraries)
    }

    /// What is remembered about the library at `path`; nothing, if it is not on the list.
    pub fn remembered(&self, path: &Path) -> Remembered {
        let path = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        self.list()
            .into_iter()
            .find(|entry| entry.path == path)
            .map(|e| Remembered {
                backup: e.backup,
                hidden_panes: e.hidden_panes,
            })
            .unwrap_or_default()
    }

    /// The library at `path` was just backed up to, or brought back from, `folder`.
    pub fn backed_up(&self, path: &Path, folder: &Path) -> Result<()> {
        let folder = fs::canonicalize(folder).unwrap_or_else(|_| folder.to_path_buf());
        self.change(path, |entry| entry.backup = Some(folder))
    }

    /// In the library at `path`, `work` now hides `editions` — none, to show every pane.
    pub fn panes_hidden(&self, path: &Path, work: &str, editions: Vec<String>) -> Result<()> {
        self.change(path, |entry| {
            if editions.is_empty() {
                entry.hidden_panes.remove(work);
            } else {
                entry.hidden_panes.insert(work.to_string(), editions);
            }
        })
    }

    /// Change the entry for the library at `path`, in place. One not on the list is not put
    /// there: what is remembered about a library goes with the library's place on the list.
    fn change(&self, path: &Path, edit: impl FnOnce(&mut Entry)) -> Result<()> {
        let file = self.file.lock().unwrap_or_else(|e| e.into_inner());
        let Some(file) = file.as_deref() else {
            return Ok(());
        };
        let path = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        let mut libraries = read(file);
        let Some(entry) = libraries.iter_mut().find(|entry| entry.path == path) else {
            return Ok(());
        };
        edit(entry);
        write(file, libraries)
    }

    /// Take `path` off the list. The library itself is not touched.
    pub fn forget(&self, path: &Path) -> Result<()> {
        let file = self.file.lock().unwrap_or_else(|e| e.into_inner());
        let Some(file) = file.as_deref() else {
            return Ok(());
        };

        let mut libraries = read(file);
        libraries.retain(|entry| entry.path != path);
        write(file, libraries)
    }
}

fn read(file: &Path) -> Vec<Entry> {
    fs::read_to_string(file)
        .ok()
        .and_then(|text| toml::from_str::<List>(&text).ok())
        .map(|list| list.libraries)
        .unwrap_or_default()
}

fn write(file: &Path, libraries: Vec<Entry>) -> Result<()> {
    let text = toml::to_string(&List { libraries })
        .map_err(|e| Error::invalid("recent libraries", e.to_string()))?;
    lc_engine::atomic::write(file, &format!("{HEADER}{text}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A settings folder, and three library folders to open.
    fn setup() -> (tempfile::TempDir, Recent, [PathBuf; 3]) {
        let dir = tempfile::tempdir().unwrap();
        let libraries = ["learning", "russian", "history"].map(|name| {
            let path = dir.path().join(name);
            fs::create_dir(&path).unwrap();
            fs::canonicalize(path).unwrap()
        });
        let recent = Recent::at(Some(dir.path().join("settings").join(FILE)));
        (dir, recent, libraries)
    }

    fn paths(recent: &Recent) -> Vec<PathBuf> {
        recent.list().into_iter().map(|e| e.path).collect()
    }

    #[test]
    fn nothing_opened_yet_is_an_empty_list() {
        let (_dir, recent, _) = setup();
        assert!(recent.list().is_empty());
    }

    #[test]
    fn the_library_opened_last_is_first() {
        let (_dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.opened(&russian, "Russian").unwrap();
        assert_eq!(paths(&recent), [russian, learning]);
    }

    #[test]
    fn opening_one_again_moves_it_up_rather_than_listing_it_twice() {
        let (_dir, recent, [learning, russian, history]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.opened(&russian, "Russian").unwrap();
        recent.opened(&history, "History").unwrap();
        recent.opened(&learning, "Learning").unwrap();
        assert_eq!(paths(&recent), [learning, history, russian]);
    }

    #[test]
    fn it_is_listed_under_the_name_it_had_when_it_was_last_opened() {
        let (_dir, recent, [learning, _, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.opened(&learning, "Nutrition").unwrap();
        let list = recent.list();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Nutrition");
    }

    #[test]
    fn the_same_folder_spelled_another_way_is_the_same_library() {
        let (_dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.opened(&russian, "Russian").unwrap();
        // Through its neighbour and back out again, with a trailing slash for good measure.
        let roundabout = russian.join("..").join("learning").join("");
        recent.opened(&roundabout, "Learning").unwrap();
        assert_eq!(paths(&recent), [learning, russian]);
    }

    #[test]
    fn only_the_most_recent_ten_are_kept() {
        let (dir, recent, _) = setup();
        let many: Vec<PathBuf> = (0..12)
            .map(|n| {
                let path = dir.path().join(format!("library-{n}"));
                fs::create_dir(&path).unwrap();
                fs::canonicalize(path).unwrap()
            })
            .collect();
        for path in &many {
            recent.opened(path, "Somewhere").unwrap();
        }
        let expected: Vec<PathBuf> = many.iter().rev().take(KEEP).cloned().collect();
        assert_eq!(paths(&recent), expected);
    }

    #[test]
    fn forgetting_one_takes_it_off_the_list_and_leaves_the_library_alone() {
        let (_dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.opened(&russian, "Russian").unwrap();
        recent.forget(&learning).unwrap();
        assert_eq!(paths(&recent), [russian]);
        assert!(learning.is_dir(), "forgetting a library must not touch it");
    }

    #[test]
    fn a_renamed_library_is_listed_by_its_new_name_in_the_same_place() {
        let (_dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.opened(&russian, "Russian").unwrap();
        let before = recent.list();

        recent.renamed(&learning, &learning, "Nutrition").unwrap();

        let after = recent.list();
        assert_eq!(after.len(), 2);
        assert_eq!(
            after[1].path, learning,
            "renaming is not opening: it keeps its place"
        );
        assert_eq!(after[1].name, "Nutrition");
        assert_eq!(after[1].opened, before[1].opened, "nor its date");
        assert_eq!(after[0], before[0], "and nothing else changes");
    }

    #[test]
    fn renaming_a_library_that_is_not_listed_does_not_list_it() {
        let (_dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.renamed(&russian, &russian, "Russian").unwrap();
        assert_eq!(paths(&recent), [learning]);
    }

    #[test]
    fn a_library_whose_folder_followed_its_name_is_listed_where_it_went() {
        let (dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.opened(&russian, "Russian").unwrap();
        let nutrition = dir.path().join("nutrition");
        fs::rename(&learning, &nutrition).unwrap();

        recent.renamed(&learning, &nutrition, "Nutrition").unwrap();

        let after = recent.list();
        assert_eq!(after.len(), 2);
        assert_eq!(after[1].path, fs::canonicalize(&nutrition).unwrap());
        assert_eq!(after[1].name, "Nutrition");
    }

    #[test]
    fn an_old_entry_for_the_folder_it_moved_into_is_not_kept_beside_it() {
        // `nutrition` was a library once, was deleted, and is listed as not found. This one
        // has just moved into a folder of that name: one entry, and it is this library.
        let (dir, recent, [learning, _, _]) = setup();
        let nutrition = dir.path().join("nutrition");
        recent.opened(&learning, "Learning").unwrap();
        fs::create_dir(&nutrition).unwrap();
        recent.opened(&nutrition, "Old nutrition").unwrap();
        fs::remove_dir(&nutrition).unwrap();
        fs::rename(&learning, &nutrition).unwrap();

        recent.renamed(&learning, &nutrition, "Nutrition").unwrap();

        let after = recent.list();
        assert_eq!(after.len(), 1, "{after:?}");
        assert_eq!(after[0].name, "Nutrition");
    }

    #[test]
    fn a_renamed_library_is_found_under_another_spelling_of_its_path() {
        let (_dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        let roundabout = russian.join("..").join("learning").join("");
        recent
            .renamed(&roundabout, &roundabout, "Nutrition")
            .unwrap();
        assert_eq!(recent.list()[0].name, "Nutrition");
    }

    #[test]
    fn a_library_whose_folder_has_gone_is_still_listed() {
        // Unplugging a drive is not deleting a library. Only the person can tell which one it
        // was, so it stays until they take it off.
        let (_dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.opened(&russian, "Russian").unwrap();
        fs::remove_dir(&learning).unwrap();
        assert_eq!(paths(&recent), [russian, learning]);
    }

    #[test]
    fn a_file_that_cannot_be_read_is_an_empty_list_and_is_written_afresh() {
        let (dir, recent, [learning, _, _]) = setup();
        let file = dir.path().join("settings").join(FILE);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, "this is [not toml").unwrap();

        assert!(recent.list().is_empty());
        recent.opened(&learning, "Learning").unwrap();
        assert_eq!(paths(&recent), [learning]);
    }

    #[test]
    fn with_nowhere_to_keep_it_nothing_is_remembered_and_nothing_fails() {
        let dir = tempfile::tempdir().unwrap();
        let recent = Recent::at(None);
        recent.opened(dir.path(), "Learning").unwrap();
        recent.forget(dir.path()).unwrap();
        assert!(recent.list().is_empty());
    }

    #[test]
    fn a_backup_folder_and_hidden_panes_are_remembered_per_library() {
        let (dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.opened(&russian, "Russian").unwrap();
        let drive = dir.path().join("drive");
        fs::create_dir(&drive).unwrap();

        recent.backed_up(&learning, &drive).unwrap();
        recent
            .panes_hidden(&russian, "WORK", vec!["ED1".into(), "ED2".into()])
            .unwrap();

        let learned = recent.remembered(&learning);
        assert_eq!(learned.backup, Some(fs::canonicalize(&drive).unwrap()));
        assert!(learned.hidden_panes.is_empty());
        let russian_now = recent.remembered(&russian);
        assert_eq!(russian_now.backup, None);
        assert_eq!(russian_now.hidden_panes["WORK"], ["ED1", "ED2"]);

        // Showing every pane again forgets the work.
        recent.panes_hidden(&russian, "WORK", vec![]).unwrap();
        assert!(recent.remembered(&russian).hidden_panes.is_empty());
    }

    #[test]
    fn what_is_remembered_survives_opening_again_and_renaming() {
        let (dir, recent, [learning, russian, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        recent.backed_up(&learning, dir.path()).unwrap();
        recent
            .panes_hidden(&learning, "WORK", vec!["ED".into()])
            .unwrap();
        recent.opened(&russian, "Russian").unwrap();
        recent.opened(&learning, "Learning").unwrap();

        let nutrition = dir.path().join("nutrition");
        fs::rename(&learning, &nutrition).unwrap();
        recent.renamed(&learning, &nutrition, "Nutrition").unwrap();

        let kept = recent.remembered(&nutrition);
        assert!(kept.backup.is_some());
        assert_eq!(kept.hidden_panes["WORK"], ["ED"]);
    }

    #[test]
    fn nothing_is_remembered_for_a_library_not_on_the_list() {
        let (dir, recent, [learning, _, _]) = setup();
        recent.backed_up(&learning, dir.path()).unwrap();
        assert!(recent.list().is_empty());
        assert_eq!(recent.remembered(&learning), Remembered::default());
    }

    #[test]
    fn the_file_is_plain_toml_that_says_what_it_is() {
        let (dir, recent, [learning, _, _]) = setup();
        recent.opened(&learning, "Learning").unwrap();
        let text = fs::read_to_string(dir.path().join("settings").join(FILE)).unwrap();

        assert!(
            text.starts_with("# The libraries this computer has opened"),
            "{text}"
        );
        assert!(text.contains("[[library]]"), "{text}");
        assert!(text.contains(r#"name = "Learning""#), "{text}");
        // A date, unquoted, the way every other timestamp the application writes is.
        let opened = text.lines().find(|l| l.starts_with("opened = ")).unwrap();
        assert!(!opened.contains('"'), "{opened}");
    }
}

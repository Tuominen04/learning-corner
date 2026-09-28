//! The libraries this computer has opened, most recent first.
//!
//! The one thing the shell keeps from one run to the next, and a convenience only: losing the
//! file costs a folder dialog and nothing more (`packaging-fedora.md`). Everything here
//! follows from that. A list that cannot be read is an empty list, a list that cannot be
//! written is the old list next time, and neither ever stops a library from opening.
//!
//! Nothing from inside a library is kept here — only where it is and what it was called.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use plc_engine::{Error, Result, Timestamp};
use serde::{Deserialize, Serialize};

/// The file's name, inside the application's settings folder.
pub const FILE: &str = "recent-libraries.toml";

/// Enough to fill a start screen, and few enough to take in at a glance.
const KEEP: usize = 10;

/// What the file says about itself, to whoever opens it.
const HEADER: &str = "\
# The libraries this computer has opened, most recent first.
#
# A convenience only: deleting this file costs one folder dialog. Nothing in it is needed to
# open a library, and nothing from inside any library is kept here.

";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Entry {
    pub path: PathBuf,
    /// What the library was called when it was last opened, so the list reads as names —
    /// and still reads when the folder is on a drive that is not plugged in.
    pub name: String,
    pub opened: Timestamp,
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
        libraries.retain(|entry| entry.path != path);
        libraries.insert(
            0,
            Entry {
                path,
                name: name.to_string(),
                opened: Timestamp::now(),
            },
        );
        libraries.truncate(KEEP);
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
    plc_engine::atomic::write(file, &format!("{HEADER}{text}"))
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

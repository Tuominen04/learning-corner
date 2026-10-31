//! The commands the interface may call.
//!
//! Thin: each one converts arguments, calls the engine, and converts the result. Any logic
//! that appears here is logic in the wrong repository — the rule is in `architecture.md`, and
//! the reason is that nothing here can be tested without a window.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Mutex;

use base64::Engine as _;
use lc_engine::api::Engine;
use lc_engine::backup;
use lc_engine::store::Revision;
use lc_engine::{Error, Id};
use tauri::State;

use crate::closing::Closing;
use crate::dto::{
    BackupAnswer, BackupApplied, BackupPlan, CitationRequest, Document, DocumentRef, EngineError,
    ExportFormat, Field, Form, Keep, LibraryStatus, Locator, RecentLibrary, RenamedLibrary,
    SavedSource, SearchHit, Source, SourceType, Split, Topic, TopicContents,
};
use crate::dto::{
    EditionContents, NewEdition, RepeatSet, ResegmentPlan, Resegmented, Work, WorkContents,
    WorkSummary, WorkUnit,
};
use crate::recent::Recent;

/// The open library, or none. The interface holds no durable state of its own.
#[derive(Default)]
pub struct OpenLibrary(pub Mutex<Option<Engine>>);

type Answer<T> = Result<T, EngineError>;

/// Run `f` against the open library, or fail with `LibraryNotOpen`.
fn with<T>(
    state: &State<'_, OpenLibrary>,
    f: impl FnOnce(&mut Engine) -> Result<T, Error>,
) -> Answer<T> {
    let mut guard = state.0.lock().map_err(|_| EngineError {
        kind: "LibraryError".into(),
        message: "the library lock was poisoned by an earlier failure".into(),
    })?;
    let engine = guard.as_mut().ok_or(Error::LibraryNotOpen)?;
    f(engine).map_err(EngineError::from)
}

fn id(raw: &str) -> Result<Id, Error> {
    raw.parse()
}

// ---- library -------------------------------------------------------------------

/// Make a new library in a folder of its own, named after it, inside `location`.
#[tauri::command]
pub fn library_create(
    state: State<'_, OpenLibrary>,
    recent: State<'_, Recent>,
    location: String,
    name: String,
) -> Answer<LibraryStatus> {
    let engine = Engine::create_in(&location, name).map_err(EngineError::from)?;
    let status = LibraryStatus::of(&engine).map_err(EngineError::from)?;
    // The folder the library was made in, not the one that was chosen to put it in.
    remember(&recent, &status.path, &status.name);
    *state.0.lock().unwrap() = Some(engine);
    Ok(status)
}

#[tauri::command]
pub fn library_open(
    state: State<'_, OpenLibrary>,
    recent: State<'_, Recent>,
    path: String,
) -> Answer<LibraryStatus> {
    let engine = Engine::open(&path).map_err(EngineError::from)?;
    let status = LibraryStatus::of(&engine).map_err(EngineError::from)?;
    remember(&recent, &path, &status.name);
    *state.0.lock().unwrap() = Some(engine);
    Ok(status)
}

/// Give the open library another name — and its folder too, when the folder is its alone.
#[tauri::command]
pub fn library_rename(
    state: State<'_, OpenLibrary>,
    recent: State<'_, Recent>,
    name: String,
) -> Answer<RenamedLibrary> {
    with(&state, |e| rename_library(e, &recent, name))
}

/// The rename, and the start screen's list hearing about it: the list shows libraries by name
/// and finds them by folder, and both can change. Apart from the command so it can be tested
/// without a window.
fn rename_library(
    engine: &mut Engine,
    recent: &Recent,
    name: String,
) -> Result<RenamedLibrary, Error> {
    // Where the list knows it from, resolved while there is still something there to resolve.
    let from = std::fs::canonicalize(engine.root()).unwrap_or_else(|_| engine.root().into());
    let folder = engine.library_rename(name)?;
    let status = LibraryStatus::of(engine)?;
    // Logged and not reported, like everything about that list: the rename itself worked.
    if let Err(e) = recent.renamed(&from, engine.root(), &status.name) {
        eprintln!("the list of recent libraries was not updated: {e}");
    }
    Ok(RenamedLibrary {
        status,
        folder: folder.into(),
    })
}

/// Put a library that has just opened at the top of the start screen's list.
///
/// A failure goes to the log and nowhere else. The list is a convenience, and a library that
/// opened must not be reported as having failed to because a settings file could not be
/// written.
fn remember(recent: &Recent, path: &str, name: &str) {
    if let Err(e) = recent.opened(Path::new(path), name) {
        eprintln!("the list of recent libraries was not updated: {e}");
    }
}

#[tauri::command]
pub fn library_close(state: State<'_, OpenLibrary>) {
    *state.0.lock().unwrap() = None;
}

#[tauri::command]
pub fn library_status(state: State<'_, OpenLibrary>) -> Answer<LibraryStatus> {
    with(&state, |e| LibraryStatus::of(e))
}

#[tauri::command]
pub fn library_rebuild_index(state: State<'_, OpenLibrary>) -> Answer<LibraryStatus> {
    with(&state, |e| {
        e.rebuild_index()?;
        LibraryStatus::of(e)
    })
}

// ---- the start screen ------------------------------------------------------------
//
// Not engine operations. The list of recently opened libraries is the shell's own, kept in the
// application's settings folder, and a command-line client would have no use for it.

/// The libraries this computer has opened, most recent first.
#[tauri::command]
pub fn recent_libraries(recent: State<'_, Recent>) -> Vec<RecentLibrary> {
    recent
        .list()
        .into_iter()
        .map(|entry| RecentLibrary {
            found: entry.path.is_dir(),
            path: entry.path.to_string_lossy().into_owned(),
            name: entry.name,
            opened: entry.opened.to_string(),
        })
        .collect()
}

/// Take a library off the start screen's list. The library itself is not touched.
#[tauri::command]
pub fn forget_library(recent: State<'_, Recent>, path: String) -> Answer<()> {
    recent.forget(Path::new(&path)).map_err(EngineError::from)
}

// ---- the window ------------------------------------------------------------------

/// The interface has written everything it was holding, so the window may close.
#[tauri::command]
pub fn ready_to_close(closing: State<'_, Closing>) {
    closing.ready();
}

// ---- topics --------------------------------------------------------------------

#[tauri::command]
pub fn topic_tree(state: State<'_, OpenLibrary>) -> Answer<Vec<Topic>> {
    with(&state, |e| {
        Ok(e.topic_tree()?.into_iter().map(Topic::from).collect())
    })
}

#[tauri::command]
pub fn topic_create(
    state: State<'_, OpenLibrary>,
    parent: Option<String>,
    name: String,
) -> Answer<String> {
    with(&state, |e| {
        let parent = parent.as_deref().map(id).transpose()?;
        Ok(e.topic_create(parent, name)?.to_string())
    })
}

#[tauri::command]
pub fn topic_rename(state: State<'_, OpenLibrary>, topic: String, name: String) -> Answer<()> {
    with(&state, |e| e.topic_rename(id(&topic)?, name))
}

/// Move a topic, and everything in it, into another topic — or, with no parent, to the top.
///
/// The folder moves on disk, its documents and pictures inside it. Nothing refers to a topic or
/// a document by where it is, so no link or citation notices.
#[tauri::command]
pub fn topic_move(
    state: State<'_, OpenLibrary>,
    topic: String,
    parent: Option<String>,
) -> Answer<()> {
    with(&state, |e| {
        let parent = parent.as_deref().map(id).transpose()?;
        e.topic_move(id(&topic)?, parent)
    })
}

/// What deleting this topic would reach — every document anywhere below it, by name.
///
/// Asked before `topic_delete`, never after. The interface shows this and has to be told
/// what to do with the contents before anything is removed.
#[tauri::command]
pub fn topic_delete_plan(state: State<'_, OpenLibrary>, topic: String) -> Answer<TopicContents> {
    with(&state, |e| {
        Ok(TopicContents::from(e.topic_delete_plan(id(&topic)?)?))
    })
}

/// Delete a topic, having been told what becomes of what is inside it.
#[tauri::command]
pub fn topic_delete(
    state: State<'_, OpenLibrary>,
    topic: String,
    contents: crate::dto::Contents,
) -> Answer<()> {
    with(&state, |e| e.topic_delete(id(&topic)?, contents.into()))
}

// ---- documents -----------------------------------------------------------------

#[tauri::command]
pub fn document_create(
    state: State<'_, OpenLibrary>,
    topic: String,
    title: String,
) -> Answer<String> {
    with(&state, |e| {
        Ok(e.document_create(id(&topic)?, title)?.to_string())
    })
}

#[tauri::command]
pub fn document_read(state: State<'_, OpenLibrary>, document: String) -> Answer<Document> {
    with(&state, |e| {
        e.document_read(id(&document)?).map(Document::from)
    })
}

#[tauri::command]
pub fn document_write(
    state: State<'_, OpenLibrary>,
    document: String,
    body: String,
    revision: Revision,
) -> Answer<Document> {
    with(&state, |e| {
        e.document_write(id(&document)?, body, revision)
            .map(Document::from)
    })
}

#[tauri::command]
pub fn document_rename(
    state: State<'_, OpenLibrary>,
    document: String,
    title: String,
) -> Answer<Document> {
    with(&state, |e| {
        e.document_rename(id(&document)?, title).map(Document::from)
    })
}

/// Move a document into another topic, its pictures with it, and answer with it as it now is.
#[tauri::command]
pub fn document_move(
    state: State<'_, OpenLibrary>,
    document: String,
    topic: String,
) -> Answer<Document> {
    with(&state, |e| {
        e.document_move(id(&document)?, id(&topic)?)
            .map(Document::from)
    })
}

#[tauri::command]
pub fn document_delete(state: State<'_, OpenLibrary>, document: String) -> Answer<()> {
    with(&state, |e| e.document_delete(id(&document)?))
}

/// Keep a picture with a document, and answer with the name to write into the body.
///
/// The interface hands over a path it got from the file dialog and gets back a bare filename
/// — `diagram.png` — which it writes as `![alt](diagram.png)`. Beside the document rather than
/// in a folder of its own, so the `.md` shows its pictures in any Markdown reader.
///
/// `keep` decides what becomes of the file the user picked, exactly as it does for a source's
/// paper. The library's own copy is written first either way.
#[tauri::command]
pub fn document_attach_image(
    state: State<'_, OpenLibrary>,
    document: String,
    path: String,
    keep: Keep,
) -> Answer<String> {
    with(&state, |e| {
        e.document_attach_image(id(&document)?, std::path::Path::new(&path), keep.into())
    })
}

/// A picture the body names, as a `data:` URL the interface can put straight into an `img`.
///
/// The interface names a **document** and the **name its own body carries**, never a path —
/// the same arrangement `source_open` has, and the reason the window needs no filesystem
/// permission of its own. Nothing here can reach a file the engine did not resolve.
///
/// `None` means there is nothing to show, which is not an error. A body is plain text: it may
/// name a picture somebody has since deleted, or something that is not a filename at all, and
/// neither may fail the document around it. An extension the library never stores answers the
/// same way — the file is there, and this cannot honestly say what it is.
///
/// A `data:` URL rather than a path or a served file because it keeps the whole arrangement
/// above true, and because it costs nothing to get right: there is no object to release and
/// no lifetime to track on the other side.
#[tauri::command]
pub fn document_image(
    state: State<'_, OpenLibrary>,
    document: String,
    name: String,
) -> Answer<Option<String>> {
    with(&state, |e| {
        match e.document_image(id(&document)?, &name)? {
            Some(path) => data_url(&path),
            None => Ok(None),
        }
    })
}

/// A file on disk as a `data:` URL, or `None` if there is no honest way to say what it is.
///
/// Separated from the command because a command cannot be tested without a window, and this
/// is the half worth testing: the wrong media type means a picture the window refuses to
/// draw, with nothing on screen to say why.
fn data_url(path: &std::path::Path) -> Result<Option<String>, Error> {
    let Some(mime) = mime_for(path) else {
        return Ok(None);
    };
    let bytes = std::fs::read(path)
        .map_err(|why| Error::library(format!("cannot read {}: {why}", path.display())))?;
    Ok(Some(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )))
}

/// What a picture is, from the name the library gave it.
///
/// Only the kinds the engine accepts when a picture is attached, because those are the only
/// ones it ever writes. Anything else beside a document was put there by hand under a name
/// the body happens to mention, and guessing at it would mean handing the window a `data:`
/// URL that says one thing and contains another.
fn mime_for(path: &std::path::Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|e| e.to_str())?
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

/// Take part of a document out into a new one, leaving a link behind.
///
/// `start` and `end` are **character offsets into the body the interface last read**, which is
/// why the revision comes too: offsets into a file that changed underneath address different
/// text, and splitting on them takes the wrong words out of somebody's document.
///
/// The interface works in ProseMirror positions and the file is counted in characters. The
/// two do not agree — a citation is one position and thirty-five characters — so the
/// conversion happens on the interface side, where the editor's document actually is, and
/// arrives here already in the file's own terms.
#[tauri::command]
pub fn document_split(
    state: State<'_, OpenLibrary>,
    document: String,
    start: usize,
    end: usize,
    title: String,
    revision: Revision,
) -> Answer<Split> {
    with(&state, |e| {
        Ok(Split::from(e.document_split(
            id(&document)?,
            start..end,
            title,
            revision,
        )?))
    })
}

/// The documents linking here.
///
/// Derived from `[[…]]` in other documents' text, never stored — no file records what points
/// at it. That is what makes the relation impossible to get out of step with the writing: a
/// link deleted in a text editor stops being a backlink the next time the library is read.
#[tauri::command]
pub fn document_backlinks(
    state: State<'_, OpenLibrary>,
    document: String,
) -> Answer<Vec<DocumentRef>> {
    with(&state, |e| {
        Ok(e.backlinks(id(&document)?)?
            .into_iter()
            .map(DocumentRef::from)
            .collect())
    })
}

#[tauri::command]
pub fn search(state: State<'_, OpenLibrary>, query: String) -> Answer<Vec<SearchHit>> {
    with(&state, |e| {
        Ok(e.search(&query)?
            .into_iter()
            .map(|h| SearchHit {
                id: h.id.to_string(),
                kind: h.kind.into(),
                title: h.title,
                excerpt: h.excerpt,
            })
            .collect())
    })
}

// ---- sources -------------------------------------------------------------------

/// Save a new source.
///
/// Returns its identifier **and** whatever required fields it still lacks. A source short of a
/// field is stored, not refused: somebody who cannot find a publisher should end up with an
/// incomplete source rather than with no source at all.
#[tauri::command]
pub fn source_create(state: State<'_, OpenLibrary>, source: Source) -> Answer<SavedSource> {
    with(&state, |e| {
        let (id, missing) = e.source_create(source.into_engine()?)?;
        Ok(SavedSource {
            id: id.to_string(),
            missing: missing.into_iter().map(Field::from).collect(),
        })
    })
}

#[tauri::command]
pub fn source_read(state: State<'_, OpenLibrary>, source: String) -> Answer<Source> {
    with(&state, |e| e.source_read(id(&source)?).map(Source::from))
}

#[tauri::command]
pub fn source_update(state: State<'_, OpenLibrary>, source: Source) -> Answer<Vec<Field>> {
    with(&state, |e| {
        Ok(e.source_update(source.into_engine()?)?
            .into_iter()
            .map(Field::from)
            .collect())
    })
}

/// Every source in the library, already in reference-list order.
#[tauri::command]
pub fn source_list(state: State<'_, OpenLibrary>) -> Answer<Vec<Source>> {
    with(&state, |e| {
        Ok(e.source_list()?.into_iter().map(Source::from).collect())
    })
}

/// What would break if this source were deleted.
///
/// Two-phase without exception: deleting a source orphans every citation of it, so the
/// Keep a copy of a PDF with a source.
///
/// The interface sends a path it got from the file dialog, and the engine brings the file
/// into the library. That is the point: the original can be gone afterwards — deleted by the
/// user, or taken away by `Keep::Move` — and the source still has its paper.
#[tauri::command]
pub fn source_attach(
    state: State<'_, OpenLibrary>,
    source: String,
    path: String,
    keep: Keep,
) -> Answer<Source> {
    with(&state, |e| {
        Ok(Source::from(e.source_attach(
            id(&source)?,
            std::path::Path::new(&path),
            keep.into(),
        )?))
    })
}

#[tauri::command]
pub fn source_detach(state: State<'_, OpenLibrary>, source: String) -> Answer<Source> {
    with(&state, |e| Ok(Source::from(e.source_detach(id(&source)?)?)))
}

/// Open a source's PDF in whatever the desktop uses for PDFs.
///
/// The interface names a **source**, never a path. The path is the engine's answer, which is
/// why nothing the interface can say reaches a file outside the library — and why this needs
/// no filesystem permission on the JavaScript side at all.
///
/// `false` means there was nothing to open: no file kept, or the copy has been deleted from
/// the folder by hand. Not an error — a user may do what they like inside their own library,
/// and saying so plainly beats an error dialog about a missing path.
#[tauri::command]
pub fn source_open(state: State<'_, OpenLibrary>, source: String) -> Answer<bool> {
    with(&state, |e| {
        let Some(path) = e.source_file(id(&source)?)? else {
            return Ok(false);
        };
        tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|why| {
            lc_engine::Error::library(format!("cannot open {}: {why}", path.display()))
        })?;
        Ok(true)
    })
}

/// interface must show this list and be told to go ahead before `source_delete` may run.
#[tauri::command]
pub fn source_delete_plan(
    state: State<'_, OpenLibrary>,
    source: String,
) -> Answer<Vec<DocumentRef>> {
    with(&state, |e| {
        Ok(e.source_delete_plan(id(&source)?)?
            .into_iter()
            .map(DocumentRef::from)
            .collect())
    })
}

#[tauri::command]
pub fn source_delete(state: State<'_, OpenLibrary>, source: String) -> Answer<()> {
    with(&state, |e| e.source_delete(id(&source)?))
}

/// The documents citing this source.
///
/// The thing you are glad of on a bad day: a study is retracted, and this is how you find the
/// eleven places you leaned on it.
#[tauri::command]
pub fn source_citing_documents(
    state: State<'_, OpenLibrary>,
    source: String,
) -> Answer<Vec<DocumentRef>> {
    with(&state, |e| {
        Ok(e.source_citing_documents(id(&source)?)?
            .into_iter()
            .map(DocumentRef::from)
            .collect())
    })
}

/// Which fields APA 7 requires for a given type, so the form can ask for those and no others.
#[tauri::command]
pub fn source_required_fields(
    state: State<'_, OpenLibrary>,
    source_type: SourceType,
) -> Answer<Vec<Field>> {
    with(&state, |e| {
        Ok(e.source_required_fields(source_type.into())
            .into_iter()
            .map(Field::from)
            .collect())
    })
}

// ---- citations -----------------------------------------------------------------

/// The in-text citation for one source, disambiguated against the whole library.
#[tauri::command]
pub fn citation_format(
    state: State<'_, OpenLibrary>,
    source: String,
    form: Form,
    locator: Option<Locator>,
) -> Answer<String> {
    with(&state, |e| {
        e.citation_format(id(&source)?, form.into(), locator.map(Into::into))
    })
}

/// In-text citations for many at once, disambiguated against the whole library.
///
/// What the editor calls to render a document: one round trip, one pass over the library. A
/// request naming a source that no longer exists comes back as `null` in its place rather than
/// failing the batch — one citation pointing nowhere must not blank the other fourteen, and the
/// hole is what the reader needs to see.
#[tauri::command]
pub fn citation_format_many(
    state: State<'_, OpenLibrary>,
    requests: Vec<CitationRequest>,
) -> Answer<Vec<Option<String>>> {
    with(&state, |e| {
        let converted = requests
            .into_iter()
            .map(|r| Ok((id(&r.source)?, r.form.into(), r.locator.map(Into::into))))
            .collect::<Result<Vec<_>, Error>>()?;
        e.citation_format_many(&converted)
    })
}

/// The reference list for one document, built from the sources it actually cites.
#[tauri::command]
pub fn citation_reference_list(
    state: State<'_, OpenLibrary>,
    document: String,
) -> Answer<Vec<String>> {
    with(&state, |e| e.citation_reference_list(id(&document)?))
}

/// Write a document out as a file somebody else can read, wherever the save dialog put it.
#[tauri::command]
pub fn document_export(
    state: State<'_, OpenLibrary>,
    document: String,
    format: ExportFormat,
    path: String,
) -> Answer<()> {
    with(&state, |e| {
        export_to(e, id(&document)?, format, Path::new(&path))
    })
}

/// The engine makes the bytes and this puts them on disk, through the same temp-fsync-rename
/// the library's own files go through: an export that fails part way leaves whatever file was
/// there before, or none, and never half a document under the name somebody chose.
fn export_to(
    engine: &Engine,
    document: Id,
    format: ExportFormat,
    path: &Path,
) -> Result<(), Error> {
    let bytes = engine.export_document(document, format.into())?;
    lc_engine::atomic::write_bytes(path, &bytes)
}

// ---- works ---------------------------------------------------------------------
//
// Every change names the work's revision from the last read; the engine refuses with
// `Conflict` if any of its files changed since. Rows count from 1, in the original.

/// The re-division plan last made, waiting to be applied, or none. Like a backup's, it stays
/// here and the interface is shown a view of it.
#[derive(Default)]
pub struct PendingResegment(pub Mutex<Option<lc_engine::api::ResegmentPlan>>);

fn revision(raw: &str) -> lc_engine::works::WorkRevision {
    lc_engine::works::WorkRevision::from_token(raw)
}

fn ids(raw: &[String]) -> Result<Vec<Id>, Error> {
    raw.iter().map(|r| id(r)).collect()
}

fn maybe_id(raw: Option<&str>) -> Result<Option<Id>, Error> {
    raw.map(id).transpose()
}

#[tauri::command]
pub fn work_list(state: State<'_, OpenLibrary>) -> Answer<Vec<WorkSummary>> {
    with(&state, |e| {
        Ok(e.work_list()?.into_iter().map(WorkSummary::from).collect())
    })
}

#[tauri::command]
pub fn work_create(
    state: State<'_, OpenLibrary>,
    title: String,
    unit: WorkUnit,
    text: String,
    language: String,
    source: Option<String>,
) -> Answer<Work> {
    with(&state, |e| {
        let source = maybe_id(source.as_deref())?;
        Ok(e.work_create(title, unit.into(), &text, language, source)?
            .into())
    })
}

#[tauri::command]
pub fn work_read(state: State<'_, OpenLibrary>, work: String) -> Answer<Work> {
    with(&state, |e| Ok(e.work_read(id(&work)?, &[])?.into()))
}

#[tauri::command]
pub fn work_update(
    state: State<'_, OpenLibrary>,
    work: String,
    title: String,
    sources: Vec<String>,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(e.work_update(
            id(&work)?,
            title,
            ids(&sources)?,
            &self::revision(&revision),
        )?
        .into())
    })
}

#[tauri::command]
pub fn work_add_edition(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: NewEdition,
    text: String,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        let edition = lc_engine::works::NewEdition {
            kind: edition.kind.into(),
            language: edition.language,
            label: edition.label,
            scheme: edition.scheme,
            source: maybe_id(edition.source.as_deref())?,
        };
        Ok(
            e.work_add_edition(id(&work)?, edition, &text, &self::revision(&revision))?
                .into(),
        )
    })
}

#[tauri::command]
pub fn work_update_edition(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: String,
    label: Option<String>,
    scheme: Option<String>,
    source: Option<String>,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(e.work_update_edition(
            id(&work)?,
            id(&edition)?,
            label,
            scheme,
            maybe_id(source.as_deref())?,
            &self::revision(&revision),
        )?
        .into())
    })
}

/// Move an edition to `position` among the panes, counting from 1.
#[tauri::command]
pub fn work_move_edition(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: String,
    position: usize,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(e.work_move_edition(
            id(&work)?,
            id(&edition)?,
            position,
            &self::revision(&revision),
        )?
        .into())
    })
}

#[tauri::command]
pub fn work_remove_edition_plan(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: String,
) -> Answer<EditionContents> {
    with(&state, |e| {
        Ok(e.work_remove_edition_plan(id(&work)?, id(&edition)?)?
            .into())
    })
}

#[tauri::command]
pub fn work_remove_edition(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: String,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(
            e.work_remove_edition(id(&work)?, id(&edition)?, &self::revision(&revision))?
                .into(),
        )
    })
}

/// One row of one edition. Line breaks in `text` become lines within the row.
#[tauri::command]
pub fn work_write_row(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: String,
    row: usize,
    text: String,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(e.work_write_row(
            id(&work)?,
            id(&edition)?,
            row,
            &text,
            &self::revision(&revision),
        )?
        .into())
    })
}

#[tauri::command]
pub fn work_insert_row(
    state: State<'_, OpenLibrary>,
    work: String,
    row: usize,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(
            e.work_insert_row(id(&work)?, row, &self::revision(&revision))?
                .into(),
        )
    })
}

#[tauri::command]
pub fn work_remove_row(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: String,
    row: usize,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(
            e.work_remove_row(id(&work)?, id(&edition)?, row, &self::revision(&revision))?
                .into(),
        )
    })
}

#[tauri::command]
pub fn work_mark_empty(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: String,
    row: usize,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(
            e.work_mark_empty(id(&work)?, id(&edition)?, row, &self::revision(&revision))?
                .into(),
        )
    })
}

#[tauri::command]
pub fn work_join(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: String,
    row: usize,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(
            e.work_join(id(&work)?, id(&edition)?, row, &self::revision(&revision))?
                .into(),
        )
    })
}

#[tauri::command]
pub fn work_split(
    state: State<'_, OpenLibrary>,
    work: String,
    edition: String,
    row: usize,
    line: usize,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(e.work_split(
            id(&work)?,
            id(&edition)?,
            row,
            line,
            &self::revision(&revision),
        )?
        .into())
    })
}

#[tauri::command]
pub fn work_set_repeat(
    state: State<'_, OpenLibrary>,
    work: String,
    row: usize,
    of: Option<usize>,
    revision: String,
) -> Answer<RepeatSet> {
    with(&state, |e| {
        let (work, shared) = e.work_set_repeat(id(&work)?, row, of, &self::revision(&revision))?;
        Ok(RepeatSet {
            work: work.into(),
            shared,
        })
    })
}

#[tauri::command]
pub fn work_set_note(
    state: State<'_, OpenLibrary>,
    work: String,
    row: usize,
    text: String,
    revision: String,
) -> Answer<Work> {
    with(&state, |e| {
        Ok(
            e.work_set_note(id(&work)?, row, &text, &self::revision(&revision))?
                .into(),
        )
    })
}

/// What dividing the work again by `unit` would do. Nothing is written.
#[tauri::command]
pub fn work_resegment_plan(
    state: State<'_, OpenLibrary>,
    pending: State<'_, PendingResegment>,
    work: String,
    unit: WorkUnit,
) -> Answer<ResegmentPlan> {
    let plan = with(&state, |e| e.work_resegment_plan(id(&work)?, unit.into()))?;
    let view = ResegmentPlan::from(&plan);
    *lock(&pending.0)? = Some(plan);
    Ok(view)
}

/// Divide the work again, as the plan last made showed.
#[tauri::command]
pub fn work_resegment(
    state: State<'_, OpenLibrary>,
    pending: State<'_, PendingResegment>,
) -> Answer<Resegmented> {
    let mut pending = lock(&pending.0)?;
    let plan = pending
        .as_ref()
        .ok_or_else(|| EngineError::from(Error::invalid("plan", "make a plan first")))?;
    let done = with(&state, |e| e.work_resegment(plan))?;
    *pending = None;
    Ok(Resegmented {
        work: done.work.into(),
        notes_kept_at: done.notes_kept_at.map(|p| p.to_string_lossy().into_owned()),
    })
}

#[tauri::command]
pub fn work_delete_plan(state: State<'_, OpenLibrary>, work: String) -> Answer<WorkContents> {
    with(&state, |e| {
        let plan = e.work_delete_plan(id(&work)?)?;
        Ok(WorkContents {
            title: plan.title,
            editions: plan
                .editions
                .into_iter()
                .map(EditionContents::from)
                .collect(),
            notes: plan.notes,
        })
    })
}

#[tauri::command]
pub fn work_delete(state: State<'_, OpenLibrary>, work: String) -> Answer<()> {
    with(&state, |e| e.work_delete(id(&work)?))
}

/// The works citing a source, as the work's source or one of its editions'.
#[tauri::command]
pub fn source_citing_works(
    state: State<'_, OpenLibrary>,
    source: String,
) -> Answer<Vec<WorkSummary>> {
    with(&state, |e| {
        Ok(e.source_citing_works(id(&source)?)?
            .into_iter()
            .map(WorkSummary::from)
            .collect())
    })
}

// ---- backup --------------------------------------------------------------------
//
// Two-phase, like the engine: a plan is shown, and nothing is written until it is applied. The
// plan itself stays here, in `PendingPlan`, and the interface is shown a view of it. Losing it
// loses nothing — the next plan is made afresh from the disks.

/// The plan last made, waiting to be applied, or none.
#[derive(Default)]
pub struct PendingPlan(pub Mutex<Option<backup::Plan>>);

fn lock<T>(mutex: &Mutex<T>) -> Result<std::sync::MutexGuard<'_, T>, EngineError> {
    mutex.lock().map_err(|_| EngineError {
        kind: "LibraryError".into(),
        message: "a lock was poisoned by an earlier failure".into(),
    })
}

/// What backing the open library up to `destination` would do.
#[tauri::command]
pub fn backup_plan(
    state: State<'_, OpenLibrary>,
    pending: State<'_, PendingPlan>,
    destination: String,
) -> Answer<BackupPlan> {
    let plan = with(&state, |e| e.backup_plan(Path::new(&destination)))?;
    let view = BackupPlan::from(&plan);
    *lock(&pending.0)? = Some(plan);
    Ok(view)
}

/// Apply the backup plan last made. `overwrite` is the person's yes to replacing the drive's
/// own changes, which are kept in the library first.
#[tauri::command]
pub fn backup_apply(
    state: State<'_, OpenLibrary>,
    pending: State<'_, PendingPlan>,
    overwrite: bool,
) -> Answer<BackupApplied> {
    let mut pending = lock(&pending.0)?;
    let applied = apply_backup(&state.0, pending.as_ref(), overwrite)?;
    *pending = None;
    Ok(applied)
}

fn apply_backup(
    open: &Mutex<Option<Engine>>,
    plan: Option<&backup::Plan>,
    overwrite: bool,
) -> Answer<BackupApplied> {
    let plan = plan.ok_or_else(no_plan)?;
    if plan.direction != backup::Direction::Backup {
        return Err(no_plan());
    }
    let mut guard = lock(open)?;
    let engine = guard.as_mut().ok_or(Error::LibraryNotOpen)?;
    let done = engine.backup_apply(plan, overwrite)?;
    Ok(BackupApplied {
        copied: done.copied,
        removed: done.removed,
        kept: done.kept,
        status: LibraryStatus::of(engine)?,
    })
}

/// What bringing `drive` back would do: into the open library when `destination` is none, or
/// into the empty folder `destination` names — a restore.
#[tauri::command]
pub fn restore_plan(
    state: State<'_, OpenLibrary>,
    pending: State<'_, PendingPlan>,
    drive: String,
    destination: Option<String>,
) -> Answer<BackupPlan> {
    let destination = match destination {
        Some(d) => d.into(),
        None => with(&state, |e| Ok(e.root().to_path_buf()))?,
    };
    let plan = Engine::restore_plan(Path::new(&drive), &destination)?;
    let view = BackupPlan::from(&plan);
    *lock(&pending.0)? = Some(plan);
    Ok(view)
}

/// Apply the restore plan last made, with an answer for every file changed in both places.
/// Afterwards the library it went into is the open one.
#[tauri::command]
pub fn restore_apply(
    state: State<'_, OpenLibrary>,
    pending: State<'_, PendingPlan>,
    recent: State<'_, Recent>,
    answers: BTreeMap<String, BackupAnswer>,
) -> Answer<BackupApplied> {
    let mut pending = lock(&pending.0)?;
    let applied = apply_restore(&state.0, pending.as_ref(), answers)?;
    *pending = None;
    remember(&recent, &applied.status.path, &applied.status.name);
    Ok(applied)
}

/// The restore, apart from the command so it can be tested without a window.
///
/// Bringing back into the open library closes it first, as the engine asks, so nothing writes
/// to it from two places at once — and opens it again whatever happened, so a bring-back that
/// stops part way leaves the library open as it now is, with the error to say why.
fn apply_restore(
    open: &Mutex<Option<Engine>>,
    plan: Option<&backup::Plan>,
    answers: BTreeMap<String, BackupAnswer>,
) -> Answer<BackupApplied> {
    let plan = plan.ok_or_else(no_plan)?;
    if plan.direction != backup::Direction::Restore {
        return Err(no_plan());
    }
    let answers = answers.into_iter().map(|(p, a)| (p, a.into())).collect();
    let mut guard = lock(open)?;
    let into_open = guard
        .as_ref()
        .is_some_and(|e| same_folder(e.root(), &plan.library_root));
    if into_open {
        *guard = None;
    }

    let done = match Engine::restore_apply(plan, &answers) {
        // A restore into a new folder that stopped part way is not a library to open.
        Err(e) if !into_open => return Err(e.into()),
        done => done,
    };
    let mut engine = Engine::open(&plan.library_root)?;
    // Files arrived from outside the engine, so what it knows of them is made afresh.
    engine.rebuild_index()?;
    let status = LibraryStatus::of(&engine)?;
    *guard = Some(engine);
    let done = done?;
    Ok(BackupApplied {
        copied: done.copied,
        removed: done.removed,
        kept: done.kept,
        status,
    })
}

/// Forget the plan without applying it.
#[tauri::command]
pub fn backup_cancel(pending: State<'_, PendingPlan>) -> Answer<()> {
    *lock(&pending.0)? = None;
    Ok(())
}

fn no_plan() -> EngineError {
    Error::invalid(
        "plan",
        "there is no plan of that kind to apply; make one first",
    )
    .into()
}

fn same_folder(a: &Path, b: &Path) -> bool {
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

/// The picture half of the wire, where it can be reached without a window.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_export_lands_where_it_was_asked_to_and_replaces_what_was_there() {
        let dir = tempfile::tempdir().unwrap();
        let mut engine = Engine::create(dir.path().join("learning"), "Learning").unwrap();
        let topic = engine.topic_create(None, "Protein").unwrap();
        let doc = engine.document_create(topic, "What protein is").unwrap();
        let revision = engine.document_read(doc).unwrap().revision;
        engine
            .document_write(doc, "Protein is built from amino acids.", revision)
            .unwrap();

        let exports = dir.path().join("exports");
        std::fs::create_dir_all(&exports).unwrap();
        let target = exports.join("What protein is.html");
        std::fs::write(&target, "an older export").unwrap();

        export_to(&engine, doc, ExportFormat::Html, &target).unwrap();
        let written = std::fs::read_to_string(&target).unwrap();
        assert!(written.starts_with("<!DOCTYPE html>"), "{written}");
        assert!(written.contains("Protein is built from amino acids."));

        export_to(
            &engine,
            doc,
            ExportFormat::Text,
            &exports.join("What protein is.txt"),
        )
        .unwrap();
        for (format, name) in [
            (ExportFormat::Docx, "What protein is.docx"),
            (ExportFormat::Odt, "What protein is.odt"),
        ] {
            export_to(&engine, doc, format, &exports.join(name)).unwrap();
            // A zip, written whole: its last bytes are the end of its central directory.
            let bytes = std::fs::read(exports.join(name)).unwrap();
            assert!(bytes.starts_with(b"PK\x03\x04"), "{name}");
            assert_eq!(
                &bytes[bytes.len() - 22..bytes.len() - 18],
                b"PK\x05\x06",
                "{name}"
            );
        }
        // A PDF, written whole: it starts with its version and ends with its end-of-file mark.
        export_to(
            &engine,
            doc,
            ExportFormat::Pdf,
            &exports.join("What protein is.pdf"),
        )
        .unwrap();
        let bytes = std::fs::read(exports.join("What protein is.pdf")).unwrap();
        assert!(bytes.starts_with(b"%PDF-1."));
        assert!(bytes.trim_ascii_end().ends_with(b"%%EOF"));

        let names: Vec<String> = std::fs::read_dir(&exports)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names.len(), 5, "nothing left behind beside them: {names:?}");
    }

    #[test]
    fn exporting_a_document_that_is_gone_writes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::create(dir.path().join("learning"), "Learning").unwrap();
        let target = dir.path().join("gone.txt");
        let gone: Id = "01J8ZQ8D4Q6S8W0W2Y4A6C8E09".parse().unwrap();
        assert!(export_to(&engine, gone, ExportFormat::Text, &target).is_err());
        assert!(!target.exists());
    }

    #[test]
    fn a_renamed_library_is_listed_under_its_new_name_where_its_folder_went() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("learning");
        let mut engine = Engine::create(&root, "Learning").unwrap();
        let recent = Recent::at(Some(dir.path().join("settings").join(crate::recent::FILE)));
        recent.opened(&root, "Learning").unwrap();

        let renamed = rename_library(&mut engine, &recent, "Nutrition".into()).unwrap();

        let moved = dir.path().join("nutrition");
        assert_eq!(renamed.folder, crate::dto::LibraryFolder::Follows);
        assert_eq!(renamed.status.name, "Nutrition");
        assert_eq!(renamed.status.path, moved.to_string_lossy());
        let listed = &recent.list()[0];
        assert_eq!(listed.name, "Nutrition");
        assert_eq!(listed.path, std::fs::canonicalize(&moved).unwrap());
    }

    #[test]
    fn a_library_sharing_its_folder_is_listed_under_its_new_name_where_it_was() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("learning-corner");
        let mut engine = Engine::create(&root, "Learning").unwrap();
        std::fs::write(root.join("somebody-elses.txt"), "not the library's").unwrap();
        let recent = Recent::at(Some(dir.path().join("settings").join(crate::recent::FILE)));
        recent.opened(&root, "Learning").unwrap();

        let renamed = rename_library(&mut engine, &recent, "Nutrition".into()).unwrap();

        assert_eq!(renamed.folder, crate::dto::LibraryFolder::Shared);
        assert_eq!(renamed.status.path, root.to_string_lossy());
        let listed = &recent.list()[0];
        assert_eq!(
            (listed.name.as_str(), listed.path.clone()),
            ("Nutrition", std::fs::canonicalize(&root).unwrap())
        );
    }

    #[test]
    fn a_refused_name_is_not_listed() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("learning");
        let mut engine = Engine::create(&root, "Learning").unwrap();
        let recent = Recent::at(Some(dir.path().join("settings").join(crate::recent::FILE)));
        recent.opened(&root, "Learning").unwrap();

        assert!(rename_library(&mut engine, &recent, "   ".into()).is_err());
        assert_eq!(recent.list()[0].name, "Learning");
    }

    fn png(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, b"\x89PNG\r\n\x1a\nbody").unwrap();
        path
    }

    #[test]
    fn a_picture_crosses_as_a_data_url_the_window_can_draw() {
        let dir = tempfile::tempdir().unwrap();
        let url = data_url(&png(dir.path(), "diagram.png")).unwrap().unwrap();

        assert!(
            url.starts_with("data:image/png;base64,"),
            "a window will not draw this: {url}"
        );
        // Round-tripped rather than compared to a literal: what matters is that the bytes on
        // the other side are the bytes on disk, not that this crate spells base64 a
        // particular way.
        let encoded = url.strip_prefix("data:image/png;base64,").unwrap();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap();
        assert_eq!(
            decoded,
            std::fs::read(dir.path().join("diagram.png")).unwrap()
        );
    }

    #[test]
    fn every_kind_the_library_stores_is_named_correctly() {
        // These four are what the engine accepts when a picture is attached, so these four
        // are what can be beside a document. A media type that says one thing while the bytes
        // say another is a picture that silently fails to draw.
        for (name, expected) in [
            ("diagram.png", "image/png"),
            ("photo.jpg", "image/jpeg"),
            ("photo.jpeg", "image/jpeg"),
            ("animation.gif", "image/gif"),
            ("shot.webp", "image/webp"),
            // The extension is the library's own, and the library lowercases it — but a file
            // put beside a document by hand keeps whatever case it came with.
            ("SHOUTED.PNG", "image/png"),
        ] {
            assert_eq!(
                mime_for(std::path::Path::new(name)),
                Some(expected),
                "{name} was not recognised as {expected}"
            );
        }
    }

    #[test]
    fn anything_else_beside_a_document_is_not_offered_as_a_picture() {
        // The library never writes these, so one beside a document was put there by hand
        // under a name the body happens to mention. Guessing would mean handing the window a
        // `data:` URL that says one thing and contains another.
        let dir = tempfile::tempdir().unwrap();
        let notes = dir.path().join("notes.md");
        std::fs::write(&notes, "not a picture").unwrap();

        assert_eq!(mime_for(&notes), None);
        assert_eq!(data_url(&notes).unwrap(), None);
        assert_eq!(mime_for(std::path::Path::new("no-extension")), None);
    }

    /// A library with one document in it, open, and a drive folder beside it.
    fn library_and_drive() -> (
        tempfile::TempDir,
        Mutex<Option<Engine>>,
        Id,
        std::path::PathBuf,
    ) {
        let dir = tempfile::tempdir().unwrap();
        let mut engine = Engine::create(dir.path().join("learning"), "Learning").unwrap();
        let topic = engine.topic_create(None, "Protein").unwrap();
        let doc = engine.document_create(topic, "What protein is").unwrap();
        let revision = engine.document_read(doc).unwrap().revision;
        engine
            .document_write(doc, "Protein is built from amino acids.", revision)
            .unwrap();
        let drive = dir.path().join("drive");
        (dir, Mutex::new(Some(engine)), doc, drive)
    }

    fn plan_backup(open: &Mutex<Option<Engine>>, drive: &Path) -> backup::Plan {
        open.lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .backup_plan(drive)
            .unwrap()
    }

    #[test]
    fn a_bring_back_reopens_the_library_with_the_drive_s_change_in_it() {
        let (_dir, open, doc, drive) = library_and_drive();
        let plan = plan_backup(&open, &drive);
        let done = apply_backup(&open, Some(&plan), false).unwrap();
        assert!(!done.copied.is_empty());

        // Changed on the drive, as on another computer.
        let on_drive = std::fs::read_dir(drive.join("topics"))
            .unwrap()
            .flatten()
            .flat_map(|t| std::fs::read_dir(t.path()).unwrap().flatten())
            .find(|f| f.path().extension().is_some_and(|e| e == "md"))
            .unwrap()
            .path();
        let text = std::fs::read_to_string(&on_drive).unwrap();
        std::fs::write(
            &on_drive,
            text.replace("amino acids", "amino acids, twenty of them"),
        )
        .unwrap();

        let root = open.lock().unwrap().as_ref().unwrap().root().to_path_buf();
        let plan = Engine::restore_plan(&drive, &root).unwrap();
        assert_eq!(BackupPlan::from(&plan).asks, 0);
        let done = apply_restore(&open, Some(&plan), BTreeMap::new()).unwrap();
        assert_eq!(done.copied.len(), 1);
        assert_eq!(done.kept.len(), 1, "the library's version is kept");

        let guard = open.lock().unwrap();
        let engine = guard.as_ref().expect("the library is open again");
        assert!(engine
            .document_read(doc)
            .unwrap()
            .body
            .contains("twenty of them"));
    }

    #[test]
    fn a_restore_opens_the_library_in_its_new_folder() {
        let (dir, open, doc, drive) = library_and_drive();
        let plan = plan_backup(&open, &drive);
        apply_backup(&open, Some(&plan), false).unwrap();
        *open.lock().unwrap() = None;

        let into = dir.path().join("restored");
        let plan = Engine::restore_plan(&drive, &into).unwrap();
        let view = BackupPlan::from(&plan);
        assert_eq!(view.library_name, "Learning");
        assert_eq!(view.asks, 0);
        let done = apply_restore(&open, Some(&plan), BTreeMap::new()).unwrap();
        assert_eq!(done.status.documents, 1);

        let guard = open.lock().unwrap();
        let engine = guard.as_ref().unwrap();
        assert!(same_folder(engine.root(), &into));
        assert!(engine
            .document_read(doc)
            .unwrap()
            .body
            .contains("amino acids"));
    }

    #[test]
    fn a_plan_is_applied_only_in_its_own_direction() {
        let (_dir, open, _doc, drive) = library_and_drive();
        assert_eq!(
            apply_backup(&open, None, false).unwrap_err().kind,
            "Invalid"
        );
        let plan = plan_backup(&open, &drive);
        let wrong = apply_restore(&open, Some(&plan), BTreeMap::new()).unwrap_err();
        assert_eq!(wrong.kind, "Invalid");
        assert!(open.lock().unwrap().is_some(), "the library stays open");
    }

    #[test]
    fn a_work_s_revision_survives_the_trip_to_the_interface_and_back() {
        let dir = tempfile::tempdir().unwrap();
        let mut engine = Engine::create(dir.path().join("kielet"), "Kielet").unwrap();
        let view = engine
            .work_create(
                "Я вас любил",
                lc_engine::works::Unit::Line,
                "Я вас любил:\nлюбовь ещё",
                "ru",
                None,
            )
            .unwrap();
        // What the interface holds is the wire type, serialised as JSON and back.
        let wire: Work =
            serde_json::from_str(&serde_json::to_string(&Work::from(view)).unwrap()).unwrap();
        assert_eq!(wire.editions[0].rows, [["Я вас любил:"], ["любовь ещё"]]);
        let original = id(&wire.editions[0].id).unwrap();
        let written = engine
            .work_write_row(
                id(&wire.id).unwrap(),
                original,
                2,
                "любовь ещё, быть может,",
                &revision(&wire.revision),
            )
            .unwrap();
        assert_eq!(
            written.editions[0].cells[1].text(),
            "любовь ещё, быть может,"
        );
        // And the one it replaced is stale now.
        assert_eq!(
            EngineError::from(
                engine
                    .work_write_row(written.id, original, 1, "x", &revision(&wire.revision))
                    .unwrap_err()
            )
            .kind,
            "Conflict"
        );
    }
}

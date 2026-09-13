//! The commands the interface may call.
//!
//! Thin: each one converts arguments, calls the engine, and converts the result. Any logic
//! that appears here is logic in the wrong repository — the rule is in `architecture.md`, and
//! the reason is that nothing here can be tested without a window.

use std::sync::Mutex;

use plc_engine::api::Engine;
use plc_engine::store::Revision;
use plc_engine::{Error, Id};
use tauri::State;

use crate::dto::{
    CitationRequest, Document, DocumentRef, EngineError, Field, Form, LibraryStatus, Locator,
    SavedSource, SearchHit, Source, SourceType, Topic,
};

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

#[tauri::command]
pub fn library_create(
    state: State<'_, OpenLibrary>,
    path: String,
    name: String,
) -> Answer<LibraryStatus> {
    let engine = Engine::create(&path, name).map_err(EngineError::from)?;
    let status = engine.status().map_err(EngineError::from)?;
    *state.0.lock().unwrap() = Some(engine);
    Ok(status.into())
}

#[tauri::command]
pub fn library_open(state: State<'_, OpenLibrary>, path: String) -> Answer<LibraryStatus> {
    let engine = Engine::open(&path).map_err(EngineError::from)?;
    let status = engine.status().map_err(EngineError::from)?;
    *state.0.lock().unwrap() = Some(engine);
    Ok(status.into())
}

#[tauri::command]
pub fn library_close(state: State<'_, OpenLibrary>) {
    *state.0.lock().unwrap() = None;
}

#[tauri::command]
pub fn library_status(state: State<'_, OpenLibrary>) -> Answer<LibraryStatus> {
    with(&state, |e| e.status().map(LibraryStatus::from))
}

#[tauri::command]
pub fn library_rebuild_index(state: State<'_, OpenLibrary>) -> Answer<LibraryStatus> {
    with(&state, |e| {
        e.rebuild_index()?;
        e.status().map(LibraryStatus::from)
    })
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

#[tauri::command]
pub fn document_delete(state: State<'_, OpenLibrary>, document: String) -> Answer<()> {
    with(&state, |e| e.document_delete(id(&document)?))
}

#[tauri::command]
pub fn search(state: State<'_, OpenLibrary>, query: String) -> Answer<Vec<SearchHit>> {
    with(&state, |e| {
        Ok(e.search(&query)?
            .into_iter()
            .map(|h| SearchHit {
                id: h.id.to_string(),
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
/// The interface sends a path it got from the file dialog, and the engine copies the file
/// into the library. Copying is the point: the original can be deleted out of a downloads
/// folder afterwards and the source still has its paper.
#[tauri::command]
pub fn source_attach(
    state: State<'_, OpenLibrary>,
    source: String,
    path: String,
) -> Answer<Source> {
    with(&state, |e| {
        Ok(Source::from(e.source_attach(
            id(&source)?,
            std::path::Path::new(&path),
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
            plc_engine::Error::library(format!("cannot open {}: {why}", path.display()))
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

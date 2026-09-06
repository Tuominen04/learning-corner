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

use crate::dto::{Document, EngineError, LibraryStatus, SearchHit, Topic};

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

//! The commands the interface may call.
//!
//! Thin: each one converts arguments, calls the engine, and converts the result. Any logic
//! that appears here is logic in the wrong repository — the rule is in `architecture.md`, and
//! the reason is that nothing here can be tested without a window.

use std::sync::Mutex;

use base64::Engine as _;
use plc_engine::api::Engine;
use plc_engine::store::Revision;
use plc_engine::{Error, Id};
use tauri::State;

use crate::dto::{
    CitationRequest, Document, DocumentRef, EngineError, Field, Form, Keep, LibraryStatus, Locator,
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

/// The picture half of the wire, where it can be reached without a window.
#[cfg(test)]
mod tests {
    use super::*;

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
}

//! The wire types.
//!
//! The engine's own types are not sent across the boundary directly. Two reasons, and they
//! both matter: identifiers and revisions are opaque to the interface by design, and the
//! TypeScript the interface is written against is **generated from the types in this file**,
//! so the boundary has exactly one definition rather than two that drift.
//!
//! Every type here derives `TS`. `cargo test` regenerates `src/lib/bindings/`, and CI fails if
//! what is committed differs — so a change to the contract cannot land with stale bindings.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use plc_engine::api::{DocumentSummary, DocumentView, Status, TopicNode};
use plc_engine::store::Revision;

/// An entity identifier. Opaque: the interface stores it and passes it back, never parses it.
pub type Id = String;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct LibraryStatus {
    pub name: String,
    pub topics: usize,
    pub documents: usize,
    pub writable: bool,
    pub problems: Vec<LibraryProblem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct LibraryProblem {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct Topic {
    pub id: Id,
    pub name: String,
    pub children: Vec<Topic>,
    pub documents: Vec<DocumentRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct DocumentRef {
    pub id: Id,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct Document {
    pub id: Id,
    pub title: String,
    pub body: String,
    pub topic: Id,
    pub modified: String,
    /// Opaque. Hand it back to `document_write` unchanged; a mismatch means the file changed
    /// underneath and the write is refused rather than overwriting someone's edit.
    ///
    /// Typed as a branded object in TypeScript rather than as its actual shape, so the
    /// interface cannot read a field out of it, compare two of them, or construct one. It is a
    /// token to carry, and the type says so.
    #[ts(type = "{ readonly __opaque: \"Revision\" }")]
    pub revision: Revision,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct SearchHit {
    pub id: Id,
    pub title: String,
    pub excerpt: String,
}

/// A failure the interface is expected to handle, rather than a string to show raw.
///
/// `kind` mirrors the error causes in `backend-contract.md`, so the interface can branch on a
/// conflict without matching on prose.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct EngineError {
    pub kind: String,
    pub message: String,
}

impl From<plc_engine::Error> for EngineError {
    fn from(e: plc_engine::Error) -> Self {
        use plc_engine::Error::*;
        let kind = match &e {
            NotFound(_) => "NotFound",
            LibraryNotOpen => "LibraryNotOpen",
            FormatTooNew { .. } => "FormatTooNew",
            MigrationRequired { .. } => "MigrationRequired",
            Conflict { .. } => "Conflict",
            Incomplete { .. } => "Incomplete",
            Invalid { .. } => "Invalid",
            LibraryError(_) => "LibraryError",
            Io { .. } => "Io",
            Unimplemented(_) => "Unimplemented",
        };
        EngineError {
            kind: kind.to_string(),
            message: e.to_string(),
        }
    }
}

impl From<Status> for LibraryStatus {
    fn from(s: Status) -> Self {
        LibraryStatus {
            name: s.name,
            topics: s.topics,
            documents: s.documents,
            writable: s.writable,
            problems: s
                .problems
                .into_iter()
                .map(|p| LibraryProblem {
                    path: p.path.display().to_string(),
                    message: p.message,
                })
                .collect(),
        }
    }
}

impl From<TopicNode> for Topic {
    fn from(t: TopicNode) -> Self {
        Topic {
            id: t.id.to_string(),
            name: t.name,
            children: t.children.into_iter().map(Topic::from).collect(),
            documents: t.documents.into_iter().map(DocumentRef::from).collect(),
        }
    }
}

impl From<DocumentSummary> for DocumentRef {
    fn from(d: DocumentSummary) -> Self {
        DocumentRef {
            id: d.id.to_string(),
            title: d.title,
        }
    }
}

impl From<DocumentView> for Document {
    fn from(d: DocumentView) -> Self {
        Document {
            id: d.id.to_string(),
            title: d.title,
            body: d.body,
            topic: d.topic.to_string(),
            modified: d.modified.to_string(),
            revision: d.revision,
        }
    }
}

/// Regenerating the bindings is a test, so `cargo test` keeps `src/lib/bindings/` current and
/// CI fails on a stale committed copy. Written explicitly rather than relying on the derive's
/// own export hook, so it is obvious what runs and when.
#[cfg(test)]
mod export_bindings {
    use super::*;

    #[test]
    fn typescript_bindings_are_current() {
        let config = ts_rs::Config::default();
        LibraryStatus::export_all(&config).unwrap();
        Topic::export_all(&config).unwrap();
        Document::export_all(&config).unwrap();
        SearchHit::export_all(&config).unwrap();
        EngineError::export_all(&config).unwrap();
    }
}

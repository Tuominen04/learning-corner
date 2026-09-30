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
use plc_engine::citation as engine_src;
use plc_engine::citation::format as engine_fmt;
use plc_engine::store::Revision;

/// An entity identifier. Opaque: the interface stores it and passes it back, never parses it.
pub type Id = String;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct LibraryStatus {
    /// The library's folder. It can change while the library is open: renaming the library
    /// renames its folder too, when the folder is the library's alone.
    pub path: String,
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

/// A library this computer has opened before, for the start screen.
///
/// Not an engine type. The list is the shell's own, kept in the application's settings folder
/// rather than in any library — see `recent.rs`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct RecentLibrary {
    pub path: String,
    /// What it was called when it was last opened.
    pub name: String,
    /// When it was last opened, as RFC 3339.
    pub opened: String,
    /// Whether its folder is there now. A library on a drive that is not plugged in is not
    /// found, and is listed all the same.
    pub found: bool,
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
    /// A branded string in TypeScript. Branded so the interface cannot construct one from an
    /// arbitrary string or compare two of them; a string because a revision carries nanoseconds
    /// since the epoch, and any number that large is silently rounded by a JavaScript client.
    /// Sending it as a number is what made every write fail its conflict check.
    #[ts(type = "string & { readonly __opaque: \"Revision\" }")]
    pub revision: Revision,
}

/// What a topic holds, so that deleting it can be a decision rather than a surprise.
///
/// Documents named rather than counted: "3 documents" is a number somebody agrees to, and a
/// list of titles is a thing they recognise.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct TopicContents {
    /// Topics nested anywhere below this one.
    pub topics: u32,
    /// Every document anywhere below this one.
    pub documents: Vec<DocumentRef>,
}

impl From<plc_engine::api::TopicContents> for TopicContents {
    fn from(contents: plc_engine::api::TopicContents) -> Self {
        TopicContents {
            topics: u32::try_from(contents.topics).unwrap_or(u32::MAX),
            documents: contents
                .documents
                .into_iter()
                .map(DocumentRef::from)
                .collect(),
        }
    }
}

/// What renaming a library did with its folder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub enum LibraryFolder {
    /// Renamed to follow the name, or already called what the name would call it.
    Follows,
    /// Left as it is: it holds things that are not the library's.
    Shared,
    /// Left as it is: it is the top of a drive.
    Drive,
}

impl From<plc_engine::api::LibraryFolder> for LibraryFolder {
    fn from(folder: plc_engine::api::LibraryFolder) -> Self {
        match folder {
            plc_engine::api::LibraryFolder::Follows => LibraryFolder::Follows,
            plc_engine::api::LibraryFolder::Shared => LibraryFolder::Shared,
            plc_engine::api::LibraryFolder::Drive => LibraryFolder::Drive,
        }
    }
}

/// A library just renamed, and what became of its folder.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct RenamedLibrary {
    pub status: LibraryStatus,
    pub folder: LibraryFolder,
}

/// What becomes of what is inside a topic being deleted. There is no default, on purpose.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub enum Contents {
    /// Delete the topic and everything under it.
    Delete,
    /// Move what is directly inside up to the parent, then delete the empty topic.
    MoveUp,
}

impl From<Contents> for plc_engine::api::Contents {
    fn from(contents: Contents) -> Self {
        match contents {
            Contents::Delete => plc_engine::api::Contents::Delete,
            Contents::MoveUp => plc_engine::api::Contents::MoveUp,
        }
    }
}

/// The two documents a split leaves behind.
///
/// Both, because the interface has to redraw both: the one being written now carries a link
/// where the text used to be, and the new one has to appear in the tree. Returning only the
/// new document would leave the editor showing text that is no longer in the file.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct Split {
    /// The document that was split, now carrying a link where the text used to be.
    pub original: Document,
    /// The new document, holding the text that was taken out.
    pub taken: Document,
}

impl From<plc_engine::api::Split> for Split {
    fn from(split: plc_engine::api::Split) -> Self {
        Split {
            original: split.original.into(),
            taken: split.taken.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct SearchHit {
    pub id: Id,
    /// What was found. One index holds topics, documents and sources, so this is what lets a
    /// result be drawn and acted on — opening a source is not opening a document.
    pub kind: HitKind,
    pub title: String,
    pub excerpt: String,
}

/// What a search hit refers to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub enum HitKind {
    Topic,
    Document,
    Source,
}

impl From<plc_engine::index::Kind> for HitKind {
    fn from(kind: plc_engine::index::Kind) -> Self {
        match kind {
            plc_engine::index::Kind::Topic => HitKind::Topic,
            plc_engine::index::Kind::Document => HitKind::Document,
            plc_engine::index::Kind::Source => HitKind::Source,
        }
    }
}

// ---- sources -------------------------------------------------------------------
//
// The engine's `Source` is not sent directly, for the reason at the top of this file: its `id`
// is an `Id`, and an identifier crosses as an opaque string or not at all. The rest of the
// shape is deliberately the same, field for field, so a reader comparing the two files can
// see at a glance that nothing was dropped in translation.

/// What kind of thing a source is. The type decides which fields APA 7 requires.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
#[serde(rename_all = "kebab-case")]
pub enum SourceType {
    Book,
    BookChapter,
    JournalArticle,
    WebPage,
    Video,
    Audio,
    Report,
}

/// A field a type can require.
///
/// Named rather than stringly-typed on both sides of the wire, so "this source is missing its
/// publisher" arrives as something a form can highlight rather than a sentence to display.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
#[serde(rename_all = "kebab-case")]
pub enum Field {
    Authors,
    Editors,
    Date,
    Title,
    Container,
    Publisher,
    Site,
    Volume,
    Pages,
}

/// What a contributor did.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
#[serde(rename_all = "kebab-case")]
pub enum Role {
    Author,
    Editor,
    Translator,
    Director,
    Host,
}

/// One contributor: `family` plus `given`, **or** `literal`.
///
/// The literal form carries group authors and names that do not split into two Western parts.
/// Both shapes cross the wire because assuming every name in the world decomposes is a bug,
/// not a simplification the interface may make.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct Contributor {
    pub role: Role,
    pub family: Option<String>,
    pub given: Option<String>,
    pub literal: Option<String>,
    /// The short form a group author is known by after first use: `WHO`.
    pub abbreviation: Option<String>,
}

/// When a source was published.
///
/// A tagged union rather than three nullable numbers, because `no-date` is a **value**: APA 7
/// prints `n.d.` for it. Three nulls would mean "the user has not filled this in yet", which is
/// a different thing, and flattening the two is how `n.d.` turns into an empty string.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SourceDate {
    NoDate,
    Year {
        year: i32,
    },
    /// Year, month and day — for web pages, videos, and anything where the day matters.
    Full {
        year: i32,
        month: u8,
        day: u8,
    },
}

/// The user's own judgement of a source. Not a score the application computed.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct Appraisal {
    pub trust: Option<String>,
    pub note: Option<String>,
}

/// A source: something you learned from.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct Source {
    /// Empty when the interface is proposing a new source; the engine assigns the real one.
    pub id: Option<Id>,
    #[serde(rename = "type")]
    pub source_type: SourceType,
    pub title: String,
    pub date: SourceDate,
    pub contributors: Vec<Contributor>,
    /// The journal, book or collection this sits inside.
    pub container: Option<String>,
    pub publisher: Option<String>,
    pub site: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub edition: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    /// Only where content is designed to change and is not archived — not on every web page.
    pub retrieved: Option<SourceDate>,
    pub appraisal: Option<Appraisal>,
    /// The library's own copy of this source's paper, as a filename inside `sources/files/`.
    ///
    /// Read-only from the interface's point of view. It is carried on the way out so a source
    /// can be shown with its paper, and ignored on the way in: the engine keeps whatever it
    /// has stored, so a form that does not carry the field cannot detach a PDF by saving a
    /// corrected title. Attaching and detaching are their own commands.
    pub file: Option<String>,
}

/// What came back from saving a source.
///
/// `missing` is not an error. A source short of a required field is **saved** and reported, so
/// somebody who cannot find a publisher ends up with an incomplete source rather than none.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct SavedSource {
    pub id: Id,
    pub missing: Vec<Field>,
}

// ---- citations -----------------------------------------------------------------

/// Where the citation sits in the sentence, which decides `&` versus `and`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
#[serde(rename_all = "kebab-case")]
pub enum Form {
    /// `(Nieminen, 2021, p. 44)` — the fact matters, not who said it.
    Parenthetical,
    /// `Nieminen (2021)` — who said it is part of the point.
    Narrative,
}

/// What becomes of the file when a source keeps it.
///
/// The library gets its own copy either way. This is only about the file the user picked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub enum Keep {
    /// Leave it where it is.
    Copy,
    /// Take it away once the library's copy is safe.
    Move,
}

impl From<Keep> for plc_engine::api::Keep {
    fn from(keep: Keep) -> Self {
        match keep {
            Keep::Copy => plc_engine::api::Keep::Copy,
            Keep::Move => plc_engine::api::Keep::Move,
        }
    }
}

/// One citation the interface wants rendered.
///
/// Batched rather than asked for one at a time. Every single `citation_format` reads the whole
/// library and recomputes the disambiguation pass, so a document with fifteen citations over a
/// hundred sources would read fifteen hundred files to draw one screen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct CitationRequest {
    pub source: Id,
    pub form: Form,
    pub locator: Option<Locator>,
}

/// A page, paragraph, chapter or timestamp, as the user typed it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
#[serde(tag = "kind", content = "value", rename_all = "kebab-case")]
pub enum Locator {
    Page(String),
    Paragraph(String),
    Chapter(String),
    Timestamp(String),
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

impl LibraryStatus {
    /// The open library's summary, and where it is.
    pub fn of(engine: &plc_engine::api::Engine) -> Result<Self, plc_engine::Error> {
        let s: Status = engine.status()?;
        Ok(LibraryStatus {
            path: engine.root().to_string_lossy().into_owned(),
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
        })
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

// ---- source conversions ---------------------------------------------------------
//
// Written out rather than derived. The two shapes are close enough that a macro would hide the
// one place they genuinely differ — the identifier — and that is the difference worth seeing.

impl From<engine_src::SourceType> for SourceType {
    fn from(t: engine_src::SourceType) -> Self {
        use engine_src::SourceType as E;
        match t {
            E::Book => SourceType::Book,
            E::BookChapter => SourceType::BookChapter,
            E::JournalArticle => SourceType::JournalArticle,
            E::WebPage => SourceType::WebPage,
            E::Video => SourceType::Video,
            E::Audio => SourceType::Audio,
            E::Report => SourceType::Report,
        }
    }
}

impl From<SourceType> for engine_src::SourceType {
    fn from(t: SourceType) -> Self {
        use engine_src::SourceType as E;
        match t {
            SourceType::Book => E::Book,
            SourceType::BookChapter => E::BookChapter,
            SourceType::JournalArticle => E::JournalArticle,
            SourceType::WebPage => E::WebPage,
            SourceType::Video => E::Video,
            SourceType::Audio => E::Audio,
            SourceType::Report => E::Report,
        }
    }
}

impl From<engine_src::Field> for Field {
    fn from(f: engine_src::Field) -> Self {
        use engine_src::Field as E;
        match f {
            E::Authors => Field::Authors,
            E::Editors => Field::Editors,
            E::Date => Field::Date,
            E::Title => Field::Title,
            E::Container => Field::Container,
            E::Publisher => Field::Publisher,
            E::Site => Field::Site,
            E::Volume => Field::Volume,
            E::Pages => Field::Pages,
        }
    }
}

impl From<engine_src::Role> for Role {
    fn from(r: engine_src::Role) -> Self {
        use engine_src::Role as E;
        match r {
            E::Author => Role::Author,
            E::Editor => Role::Editor,
            E::Translator => Role::Translator,
            E::Director => Role::Director,
            E::Host => Role::Host,
        }
    }
}

impl From<Role> for engine_src::Role {
    fn from(r: Role) -> Self {
        use engine_src::Role as E;
        match r {
            Role::Author => E::Author,
            Role::Editor => E::Editor,
            Role::Translator => E::Translator,
            Role::Director => E::Director,
            Role::Host => E::Host,
        }
    }
}

impl From<engine_src::Contributor> for Contributor {
    fn from(c: engine_src::Contributor) -> Self {
        Contributor {
            role: c.role.into(),
            family: c.family,
            given: c.given,
            literal: c.literal,
            abbreviation: c.abbreviation,
        }
    }
}

impl From<Contributor> for engine_src::Contributor {
    fn from(c: Contributor) -> Self {
        engine_src::Contributor {
            role: c.role.into(),
            family: c.family,
            given: c.given,
            literal: c.literal,
            abbreviation: c.abbreviation,
        }
    }
}

impl From<engine_src::Date> for SourceDate {
    fn from(d: engine_src::Date) -> Self {
        match d {
            engine_src::Date::NoDate => SourceDate::NoDate,
            engine_src::Date::Year(year) => SourceDate::Year { year },
            engine_src::Date::Full(year, month, day) => SourceDate::Full { year, month, day },
        }
    }
}

impl From<SourceDate> for engine_src::Date {
    fn from(d: SourceDate) -> Self {
        match d {
            SourceDate::NoDate => engine_src::Date::NoDate,
            SourceDate::Year { year } => engine_src::Date::Year(year),
            SourceDate::Full { year, month, day } => engine_src::Date::Full(year, month, day),
        }
    }
}

impl From<engine_src::Appraisal> for Appraisal {
    fn from(a: engine_src::Appraisal) -> Self {
        Appraisal {
            trust: a.trust,
            note: a.note,
        }
    }
}

impl From<Appraisal> for engine_src::Appraisal {
    fn from(a: Appraisal) -> Self {
        engine_src::Appraisal {
            trust: a.trust,
            note: a.note,
        }
    }
}

impl From<engine_src::Source> for Source {
    fn from(s: engine_src::Source) -> Self {
        Source {
            id: Some(s.id.to_string()),
            source_type: s.source_type.into(),
            title: s.title,
            date: s.date.into(),
            contributors: s.contributors.into_iter().map(Contributor::from).collect(),
            container: s.container,
            publisher: s.publisher,
            site: s.site,
            volume: s.volume,
            issue: s.issue,
            pages: s.pages,
            edition: s.edition,
            doi: s.doi,
            url: s.url,
            retrieved: s.retrieved.map(SourceDate::from),
            appraisal: s.appraisal.map(Appraisal::from),
            file: s.file,
        }
    }
}

impl Source {
    /// Into the engine's own type, minting an identifier when the interface did not carry one.
    ///
    /// A new source arrives with `id: null`, because identifiers are the engine's to assign —
    /// letting the interface invent one is how two entities end up sharing an identity.
    pub fn into_engine(self) -> Result<engine_src::Source, plc_engine::Error> {
        let id = match self.id {
            Some(raw) => raw.parse()?,
            None => plc_engine::Id::new(),
        };
        Ok(engine_src::Source {
            id,
            source_type: self.source_type.into(),
            title: self.title,
            date: self.date.into(),
            contributors: self
                .contributors
                .into_iter()
                .map(engine_src::Contributor::from)
                .collect(),
            container: self.container,
            publisher: self.publisher,
            site: self.site,
            volume: self.volume,
            issue: self.issue,
            pages: self.pages,
            edition: self.edition,
            doi: self.doi,
            url: self.url,
            retrieved: self.retrieved.map(engine_src::Date::from),
            appraisal: self.appraisal.map(engine_src::Appraisal::from),
            // Sent, but not trusted: `source_update` overwrites it with what is stored. Here
            // so the struct is complete rather than so the value travels.
            file: self.file,
        })
    }
}

impl From<Form> for engine_fmt::Form {
    fn from(f: Form) -> Self {
        match f {
            Form::Parenthetical => engine_fmt::Form::Parenthetical,
            Form::Narrative => engine_fmt::Form::Narrative,
        }
    }
}

impl From<Locator> for engine_fmt::Locator {
    fn from(l: Locator) -> Self {
        match l {
            Locator::Page(v) => engine_fmt::Locator::Page(v),
            Locator::Paragraph(v) => engine_fmt::Locator::Paragraph(v),
            Locator::Chapter(v) => engine_fmt::Locator::Chapter(v),
            Locator::Timestamp(v) => engine_fmt::Locator::Timestamp(v),
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
        RenamedLibrary::export_all(&config).unwrap();
        RecentLibrary::export_all(&config).unwrap();
        Topic::export_all(&config).unwrap();
        Document::export_all(&config).unwrap();
        SearchHit::export_all(&config).unwrap();
        EngineError::export_all(&config).unwrap();
        Source::export_all(&config).unwrap();
        SavedSource::export_all(&config).unwrap();
        Form::export_all(&config).unwrap();
        Locator::export_all(&config).unwrap();
        CitationRequest::export_all(&config).unwrap();
        Split::export_all(&config).unwrap();
        TopicContents::export_all(&config).unwrap();
        Contents::export_all(&config).unwrap();
    }
}

/// The wire, tested where the wire actually is.
///
/// The engine has its own JSON tests, but this crate is the boundary a JavaScript client
/// crosses, and it had no coverage of it at all. That gap shipped a product in which no
/// document could be saved: a revision serialised as a number came back rounded by a
/// JavaScript client, every conflict check failed, and both the engine and the interface were
/// individually correct the whole time.
#[cfg(test)]
mod wire {
    use super::*;
    use plc_engine::api::Engine;

    fn library() -> (tempfile::TempDir, Engine) {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::create(dir.path(), "Learning").unwrap();
        (dir, engine)
    }

    #[test]
    fn a_search_hit_keeps_its_kind_across_the_wire() {
        // The interface decides what to draw and where a click goes from this one field, so a
        // kind that arrives as the wrong variant sends somebody to the wrong screen. Both the
        // conversion and the JSON spelling are checked, because either can drift alone.
        let (_dir, mut engine) = library();
        let topic = engine.topic_create(None, "Protein").unwrap();
        engine.document_create(topic, "What protein is").unwrap();

        let mut source = plc_engine::citation::source::Source::new(
            plc_engine::citation::source::SourceType::JournalArticle,
            "Protein in adults",
            plc_engine::citation::source::Date::Year(2021),
        );
        source.container = Some("Journal of Nutrition".into());
        engine.source_create(source).unwrap();

        let hits: Vec<SearchHit> = engine
            .search("protein")
            .unwrap()
            .into_iter()
            .map(|h| SearchHit {
                id: h.id.to_string(),
                kind: h.kind.into(),
                title: h.title,
                excerpt: h.excerpt,
            })
            .collect();

        let sent = serde_json::to_string(&hits).unwrap();
        let received: Vec<SearchHit> = serde_json::from_str(&sent).unwrap();
        assert_eq!(hits, received);

        for kind in [HitKind::Topic, HitKind::Document, HitKind::Source] {
            assert!(
                received.iter().any(|h| h.kind == kind),
                "expected a {kind:?} among {received:?}"
            );
        }

        // Kebab-case on the wire, because that is what the generated TypeScript union says.
        assert!(
            sent.contains(r#""kind":"document""#),
            "unexpected spelling in {sent}"
        );
        assert!(
            sent.contains(r#""kind":"source""#),
            "unexpected spelling in {sent}"
        );
    }

    #[test]
    fn a_document_written_with_a_round_tripped_revision_saves() {
        // Exactly what happens in the application: read a document, hand the revision to a
        // client as JSON, take it back from that client, write with it.
        let (_dir, mut engine) = library();
        let topic = engine.topic_create(None, "Protein").unwrap();
        let id = engine.document_create(topic, "What protein is").unwrap();

        let read: Document = engine.document_read(id).unwrap().into();

        let as_sent = serde_json::to_string(&read).unwrap();
        let as_returned: Document = serde_json::from_str(&as_sent).unwrap();

        assert_eq!(read.revision, as_returned.revision);

        engine
            .document_write(
                id,
                "Protein is built from amino acids.",
                as_returned.revision,
            )
            .expect("a revision that crossed the wire must still be accepted");
    }

    // ---- sources ---------------------------------------------------------------
    //
    // The same discipline as the revision tests above, for the same reason. A source is the
    // one thing in this application the user cannot reconstruct from memory, and every field
    // of it crosses this boundary twice on the way to a citation.

    fn a_book() -> Source {
        Source {
            id: None,
            source_type: SourceType::Book,
            title: "Ravinto ja terveys".into(),
            date: SourceDate::Year { year: 2021 },
            contributors: vec![Contributor {
                role: Role::Author,
                family: Some("Nieminen".into()),
                given: Some("Anna Maria".into()),
                literal: None,
                abbreviation: None,
            }],
            container: None,
            publisher: Some("Otava".into()),
            site: None,
            volume: None,
            issue: None,
            pages: None,
            edition: None,
            doi: None,
            url: None,
            retrieved: None,
            file: None,
            appraisal: None,
        }
    }

    #[test]
    fn a_source_survives_the_round_trip_a_client_puts_it_through() {
        // Saved, listed back, serialised to the client, returned by the client, saved again.
        // Anything lost in that loop is lost from the user's library.
        let (_dir, mut engine) = library();

        let sent = serde_json::to_string(&a_book()).unwrap();
        let received: Source = serde_json::from_str(&sent).unwrap();
        let (id, _) = engine
            .source_create(received.into_engine().unwrap())
            .unwrap();

        let listed: Source = engine.source_read(id).unwrap().into();
        let round_tripped: Source =
            serde_json::from_str(&serde_json::to_string(&listed).unwrap()).unwrap();

        assert_eq!(listed, round_tripped);
        assert_eq!(round_tripped.title, "Ravinto ja terveys");
        assert_eq!(round_tripped.publisher.as_deref(), Some("Otava"));
        assert_eq!(round_tripped.date, SourceDate::Year { year: 2021 });
        assert_eq!(round_tripped.contributors.len(), 1);
        assert_eq!(
            round_tripped.contributors[0].given.as_deref(),
            Some("Anna Maria"),
            "given names carry the initials APA prints; losing them silently degrades every \
             citation of this source"
        );
    }

    #[test]
    fn an_attached_paper_crosses_the_wire_and_survives_an_edit() {
        // Two things at once, because they fail together. The filename has to reach the client
        // so a source can be shown with its paper, and it has to survive the client sending
        // the source back — an interface whose form predates attachments sends `file: null`,
        // and that must not detach anything.
        let (dir, mut engine) = library();
        let (id, _) = engine
            .source_create(a_book().into_engine().unwrap())
            .unwrap();

        let pdf = dir.path().join("downloaded.pdf");
        std::fs::write(&pdf, "%PDF-1.7\n").unwrap();
        engine
            .source_attach(id, &pdf, plc_engine::api::Keep::Copy)
            .unwrap();

        let listed: Source = engine.source_read(id).unwrap().into();
        let received: Source =
            serde_json::from_str(&serde_json::to_string(&listed).unwrap()).unwrap();
        assert_eq!(
            received.file.as_deref(),
            Some("nieminen-2021.pdf"),
            "the client cannot show a paper it was never told about"
        );

        // Now the client sends it back the way a form that never heard of attachments would.
        let mut edited = received;
        edited.file = None;
        edited.title = "Ravinto ja terveys, 2. painos".into();
        engine.source_update(edited.into_engine().unwrap()).unwrap();

        let after: Source = engine.source_read(id).unwrap().into();
        assert_eq!(
            after.file.as_deref(),
            Some("nieminen-2021.pdf"),
            "correcting a title across the wire detached the paper"
        );
        assert_eq!(after.title, "Ravinto ja terveys, 2. painos");
    }

    #[test]
    fn a_new_source_arrives_without_an_identifier_and_leaves_with_one() {
        // Identifiers are the engine's to assign. If the interface could mint one, two entities
        // could be given the same identity and the library would have no way to tell them apart.
        let (_dir, mut engine) = library();

        let proposed = a_book();
        assert!(proposed.id.is_none());

        let (id, _) = engine
            .source_create(proposed.into_engine().unwrap())
            .unwrap();
        let saved: Source = engine.source_read(id).unwrap().into();

        assert_eq!(saved.id.as_deref(), Some(id.to_string().as_str()));
    }

    #[test]
    fn an_incomplete_source_is_saved_and_its_gaps_reported() {
        // Not an error. Somebody who cannot find the publisher must end up with an incomplete
        // source, never with no source — the whole point of `missing` crossing the wire.
        let (_dir, mut engine) = library();

        let mut book = a_book();
        book.publisher = None;

        let (id, missing) = engine.source_create(book.into_engine().unwrap()).unwrap();
        let missing: Vec<Field> = missing.into_iter().map(Field::from).collect();

        assert!(
            missing.contains(&Field::Publisher),
            "a book without a publisher is incomplete, and the form needs to know which field"
        );
        engine
            .source_read(id)
            .expect("the incomplete source must still have been saved");

        let saved = SavedSource {
            id: id.to_string(),
            missing,
        };
        let value = serde_json::to_value(&saved).unwrap();
        assert_eq!(value["missing"][0], "publisher");
    }

    #[test]
    fn no_date_crosses_as_a_value_not_as_an_absence() {
        // APA 7 prints `n.d.` for this. Were it flattened to null on the wire it would come back
        // as "the user has not filled this in", and the citation would print an empty year.
        let value = serde_json::to_value(SourceDate::NoDate).unwrap();
        assert_eq!(value, serde_json::json!({ "kind": "no-date" }));

        let back: SourceDate = serde_json::from_value(value).unwrap();
        assert_eq!(back, SourceDate::NoDate);
        assert_eq!(engine_src::Date::from(back), engine_src::Date::NoDate);
    }

    #[test]
    fn a_group_author_keeps_its_one_part_name() {
        // "World Health Organization" is not a family name plus a given name, and any wire that
        // assumes two Western parts turns it into something else on the way through.
        let (_dir, mut engine) = library();

        let mut report = a_book();
        report.source_type = SourceType::Report;
        report.contributors = vec![Contributor {
            role: Role::Author,
            family: None,
            given: None,
            literal: Some("World Health Organization".into()),
            abbreviation: Some("WHO".into()),
        }];

        let (id, _) = engine.source_create(report.into_engine().unwrap()).unwrap();
        let saved: Source = engine.source_read(id).unwrap().into();
        let back: Source = serde_json::from_str(&serde_json::to_string(&saved).unwrap()).unwrap();

        assert_eq!(
            back.contributors[0].literal.as_deref(),
            Some("World Health Organization")
        );
        assert_eq!(back.contributors[0].abbreviation.as_deref(), Some("WHO"));
        assert!(back.contributors[0].family.is_none());
    }

    #[test]
    fn a_locator_crosses_with_its_kind_intact() {
        // A page and a timestamp render differently — "p. 44" against "1:04:22". Collapsing them
        // to a bare string on the wire is how a video citation starts claiming a page number.
        let page = Locator::Page("44".into());
        let value = serde_json::to_value(&page).unwrap();
        assert_eq!(value, serde_json::json!({ "kind": "page", "value": "44" }));

        let back: Locator = serde_json::from_value(value).unwrap();
        assert_eq!(back, page);
    }

    #[test]
    fn every_locator_kind_reaches_the_engine_as_itself() {
        // One kind tested is one kind proven. The engine renders all four differently — "p. 44",
        // "para. 7", "Chapter 3", "1:04:22" — so a conversion that quietly collapses two of them
        // produces a citation that is wrong rather than missing, which is worse.
        use engine_fmt::Locator as E;
        let cases = [
            (Locator::Page("44".into()), E::Page("44".into())),
            (Locator::Paragraph("7".into()), E::Paragraph("7".into())),
            (Locator::Chapter("3".into()), E::Chapter("3".into())),
            (
                Locator::Timestamp("1:04:22".into()),
                E::Timestamp("1:04:22".into()),
            ),
        ];
        for (wire, expected) in cases {
            let json = serde_json::to_string(&wire).unwrap();
            let returned: Locator = serde_json::from_str(&json).unwrap();
            assert_eq!(
                engine_fmt::Locator::from(returned),
                expected,
                "{json} did not reach the engine as itself"
            );
        }
    }

    #[test]
    fn both_citation_forms_reach_the_engine_as_themselves() {
        for (wire, expected) in [
            (Form::Parenthetical, engine_fmt::Form::Parenthetical),
            (Form::Narrative, engine_fmt::Form::Narrative),
        ] {
            let json = serde_json::to_string(&wire).unwrap();
            let returned: Form = serde_json::from_str(&json).unwrap();
            assert_eq!(engine_fmt::Form::from(returned), expected);
        }
    }

    #[test]
    fn a_document_written_with_the_grown_syntax_builds_its_reference_list() {
        // The pin bump, proven rather than assumed. A narrative citation and a timestamp are
        // written through this crate's own command path, read back off disk by the engine at the
        // pinned tag, and counted. Against the old tag the citations parsed as ids only, so the
        // timestamp would have been a page and the narrative form would not have existed.
        let (_dir, mut engine) = library();

        let mut source = plc_engine::citation::Source::new(
            plc_engine::citation::SourceType::Video,
            "How muscle repairs",
            plc_engine::citation::Date::Year(2020),
        );
        source.contributors = vec![plc_engine::citation::Contributor::person(
            plc_engine::citation::Role::Author,
            "Chen",
            "Wei",
        )];
        source.site = Some("Aalto University".into());
        let (id, _) = engine.source_create(source).unwrap();

        let topic = engine.topic_create(None, "Protein").unwrap();
        let doc = engine.document_create(topic, "What protein is").unwrap();
        let revision = engine.document_read(doc).unwrap().revision;
        engine
            .document_write(
                doc,
                format!("[^cite:{id}!narrative] showed it.[^cite:{id}@time:1:04:22]"),
                revision,
            )
            .unwrap();

        // Cited twice, listed once: the reference list answers what the document draws on.
        assert_eq!(engine.citation_reference_list(doc).unwrap().len(), 1);

        // And the two places render differently, which is the whole point of the syntax growing.
        let body = engine.document_read(doc).unwrap().body;
        let refs = plc_engine::citation::reference::parse_all(&body);
        let requests: Vec<_> = refs
            .iter()
            .map(|r| (r.source, r.form, r.locator.clone()))
            .collect();
        let rendered = engine.citation_format_many(&requests).unwrap();

        assert_eq!(rendered[0].as_deref(), Some("Chen (2020)"));
        assert_eq!(rendered[1].as_deref(), Some("(Chen, 2020, 1:04:22)"));
    }

    #[test]
    fn a_stale_revision_is_refused_after_crossing_the_wire() {
        // The promise the editor makes in words — "This document changed on disk while you were
        // editing. Nothing has been overwritten." — depends entirely on this. Editing the file
        // in a text editor while the app holds it open is something the user is *told* they may
        // do, so a stale revision that quietly succeeded would silently eat their edit.
        //
        // The engine has its own conflict tests. This one is here because the revision has to
        // survive a JSON round trip *and* still be recognised as stale: the bug that shipped
        // once was not in the engine or in the interface but in the gap between them.
        let (_dir, mut engine) = library();
        let topic = engine.topic_create(None, "Protein").unwrap();
        let id = engine.document_create(topic, "What protein is").unwrap();

        // What the interface is holding, having read the document and been handed it as JSON.
        let read: Document = engine.document_read(id).unwrap().into();
        let held: Document = serde_json::from_str(&serde_json::to_string(&read).unwrap()).unwrap();

        // Meanwhile the file changes underneath — a hand edit, or another window.
        let current = engine.document_read(id).unwrap().revision;
        engine
            .document_write(id, "Edited somewhere else entirely.", current)
            .unwrap();

        let refused = engine.document_write(id, "What the app thinks is there.", held.revision);
        assert!(
            matches!(refused, Err(plc_engine::Error::Conflict { .. })),
            "a stale revision must be refused, not written: {refused:?}"
        );

        // And it has to arrive as something the interface can branch on rather than a sentence
        // to display — the editor shows a different message for a conflict than for a failure.
        let wire = EngineError::from(refused.unwrap_err());
        assert_eq!(wire.kind, "Conflict");

        // Nothing overwritten. This is the half that makes the message honest.
        assert_eq!(
            engine.document_read(id).unwrap().body,
            "Edited somewhere else entirely."
        );
    }

    #[test]
    fn a_revision_crosses_as_a_string_not_a_number() {
        // The guard. A JavaScript number holds integers exactly only to 2^53, and a revision
        // carries nanoseconds since the epoch — roughly two hundred times larger.
        let (_dir, mut engine) = library();
        let topic = engine.topic_create(None, "Protein").unwrap();
        let id = engine.document_create(topic, "What protein is").unwrap();
        let read: Document = engine.document_read(id).unwrap().into();

        let value = serde_json::to_value(&read).unwrap();
        let revision = &value["revision"];

        assert!(
            revision.is_string(),
            "a revision must cross as a string; as a number it is silently rounded: {revision}"
        );
    }
}

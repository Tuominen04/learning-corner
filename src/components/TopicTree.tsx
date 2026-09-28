import type { Deleting } from "./DeleteConfirm";
import { RenameableName } from "./RenameableName";
import type { Topic } from "../lib/engine";

// The sidebar mirrors the folders on disk, because the folders on disk mirror this. Opening
// the library folder in a file manager shows the same shape.
export function TopicTree({
  topics,
  selected,
  onSelectDocument,
  onAddDocument,
  onAddTopic,
  onRenameTopic,
  onRenameDocument,
  onDelete,
}: {
  topics: Topic[];
  selected: string | null;
  onSelectDocument: (id: string) => void;
  onAddDocument: (topicId: string) => void;
  onAddTopic: (parent: string | null) => void;
  onRenameTopic: (id: string, name: string) => void;
  onRenameDocument: (id: string, title: string) => void;
  /** Ask to delete something. Never deletes anything itself — the confirmation does. */
  onDelete: (what: Deleting) => void;
}) {
  return (
    <nav className="tree">
      <div className="tree-head">
        <h2>Topics</h2>
        <button className="ghost" onClick={() => onAddTopic(null)} title="New topic">
          +
        </button>
      </div>
      {topics.length === 0 ? (
        <p className="empty">
          No topics yet. Name the first one after the question you actually have.
        </p>
      ) : (
        <ul>
          {topics.map((topic) => (
            <TopicBranch
              key={topic.id}
              topic={topic}
              parent={null}
              selected={selected}
              onSelectDocument={onSelectDocument}
              onAddDocument={onAddDocument}
              onAddTopic={onAddTopic}
              onRenameTopic={onRenameTopic}
              onRenameDocument={onRenameDocument}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </nav>
  );
}

function TopicBranch({
  topic,
  parent,
  selected,
  onSelectDocument,
  onAddDocument,
  onAddTopic,
  onRenameTopic,
  onRenameDocument,
  onDelete,
}: {
  topic: Topic;
  /** The topic this one sits in, which is where "move up" would put its contents. */
  parent: Topic | null;
  selected: string | null;
  onSelectDocument: (id: string) => void;
  onAddDocument: (topicId: string) => void;
  onAddTopic: (parent: string | null) => void;
  onRenameTopic: (id: string, name: string) => void;
  onRenameDocument: (id: string, title: string) => void;
  onDelete: (what: Deleting) => void;
}) {
  return (
    <li className="branch">
      <div className="branch-head">
        <RenameableName
          name={topic.name}
          label="topic"
          onRename={(name) => onRenameTopic(topic.id, name)}
        />
        <span className="branch-actions">
          <button className="ghost" onClick={() => onAddDocument(topic.id)} title="New document">
            +doc
          </button>
          <button className="ghost" onClick={() => onAddTopic(topic.id)} title="Nested topic">
            +topic
          </button>
          <button
            className="ghost delete"
            title="Delete this topic"
            onClick={() =>
              onDelete({
                kind: "topic",
                id: topic.id,
                name: topic.name,
                parent: parent ? { id: parent.id, name: parent.name } : null,
              })
            }
          >
            <Bin />
          </button>
        </span>
      </div>

      <ul>
        {topic.documents.map((doc) => (
          // A row rather than a bare button, because the name and the pencil are two controls
          // and a button cannot contain another one.
          <li key={doc.id} className="doc-row">
            <RenameableName
              name={doc.title}
              label="document"
              selected={doc.id === selected}
              onSelect={() => onSelectDocument(doc.id)}
              onRename={(title) => onRenameDocument(doc.id, title)}
            />
            <button
              className="ghost delete"
              title="Delete this document"
              onClick={() => onDelete({ kind: "document", id: doc.id, title: doc.title })}
            >
              <Bin />
            </button>
          </li>
        ))}
        {topic.children.map((child) => (
          <TopicBranch
            key={child.id}
            topic={child}
            parent={topic}
            selected={selected}
            onSelectDocument={onSelectDocument}
            onAddDocument={onAddDocument}
            onAddTopic={onAddTopic}
            onRenameTopic={onRenameTopic}
            onRenameDocument={onRenameDocument}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </li>
  );
}

/**
 * A bin, drawn rather than written.
 *
 * Small and quiet on purpose, beside the pencil: deleting is something people look for when
 * they want it, not something the tree should shout about on every row. Every one of them
 * opens a confirmation, so a stray click costs a dialog and nothing else.
 */
function Bin() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.6 9.5h5.8l.6-9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

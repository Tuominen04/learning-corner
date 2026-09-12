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
}: {
  topics: Topic[];
  selected: string | null;
  onSelectDocument: (id: string) => void;
  onAddDocument: (topicId: string) => void;
  onAddTopic: (parent: string | null) => void;
  onRenameTopic: (id: string, name: string) => void;
  onRenameDocument: (id: string, title: string) => void;
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
              selected={selected}
              onSelectDocument={onSelectDocument}
              onAddDocument={onAddDocument}
              onAddTopic={onAddTopic}
              onRenameTopic={onRenameTopic}
              onRenameDocument={onRenameDocument}
            />
          ))}
        </ul>
      )}
    </nav>
  );
}

function TopicBranch({
  topic,
  selected,
  onSelectDocument,
  onAddDocument,
  onAddTopic,
  onRenameTopic,
  onRenameDocument,
}: {
  topic: Topic;
  selected: string | null;
  onSelectDocument: (id: string) => void;
  onAddDocument: (topicId: string) => void;
  onAddTopic: (parent: string | null) => void;
  onRenameTopic: (id: string, name: string) => void;
  onRenameDocument: (id: string, title: string) => void;
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
          </li>
        ))}
        {topic.children.map((child) => (
          <TopicBranch
            key={child.id}
            topic={child}
            selected={selected}
            onSelectDocument={onSelectDocument}
            onAddDocument={onAddDocument}
            onAddTopic={onAddTopic}
            onRenameTopic={onRenameTopic}
            onRenameDocument={onRenameDocument}
          />
        ))}
      </ul>
    </li>
  );
}

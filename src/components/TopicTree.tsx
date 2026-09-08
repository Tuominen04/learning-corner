import type { Topic } from "../lib/engine";

// The sidebar mirrors the folders on disk, because the folders on disk mirror this. Opening
// the library folder in a file manager shows the same shape.
export function TopicTree({
  topics,
  selected,
  onSelectDocument,
  onAddDocument,
  onAddTopic,
}: {
  topics: Topic[];
  selected: string | null;
  onSelectDocument: (id: string) => void;
  onAddDocument: (topicId: string) => void;
  onAddTopic: (parent: string | null) => void;
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
}: {
  topic: Topic;
  selected: string | null;
  onSelectDocument: (id: string) => void;
  onAddDocument: (topicId: string) => void;
  onAddTopic: (parent: string | null) => void;
}) {
  return (
    <li className="branch">
      <div className="branch-head">
        <span className="topic-name">{topic.name}</span>
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
          <li key={doc.id}>
            <button
              className={doc.id === selected ? "doc selected" : "doc"}
              onClick={() => onSelectDocument(doc.id)}
            >
              {doc.title}
            </button>
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
          />
        ))}
      </ul>
    </li>
  );
}

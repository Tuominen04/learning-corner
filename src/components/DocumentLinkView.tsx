import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { createContext, useContext } from "react";

// A link to another document, as it reads in the text.
//
// The file on disk holds `[[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]]` — an identifier, because a title is
// something people change their minds about and an identifier is not. What a reader wants is
// the title, so that is what this draws. Rename the target tomorrow and every link to it reads
// correctly, with nothing rewritten in any file.
//
// The title comes from the topic tree the application already holds, not from an engine call.
// Every document in the library is in it, with its title, which makes drawing a link free.

/** How a link finds its title, and what happens when somebody follows it. */
export type LinkTargets = {
  /** Every document in the library, by identifier. */
  titles: Map<string, string>;
  open: (id: string) => void;
};

export const DocumentLinks = createContext<LinkTargets>({
  titles: new Map(),
  open: () => {},
});

export function DocumentLinkView({ node }: NodeViewProps) {
  const { titles, open } = useContext(DocumentLinks);

  const id = String(node.attrs["document"] ?? "");
  const title = titles.get(id);

  // A link to a document that is no longer there. Worth showing plainly rather than hiding:
  // the text still says what it said, and the person can see what needs fixing. Deleting a
  // document does not reach into other people's sentences to tidy up after itself.
  if (title === undefined) {
    return (
      <NodeViewWrapper
        as="span"
        className="doc-link missing"
        title="This points at a document that is no longer in your library"
        data-document-link={id}
        contentEditable={false}
      >
        [missing document]
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className="doc-link"
      data-document-link={id}
      contentEditable={false}
    >
      <button
        className="doc-link-open"
        title={`Open “${title}”`}
        // A link inside the text somebody is writing, so it must not steal a click meant for
        // the cursor: the button is the whole node, and the node is an atom.
        onClick={() => open(id)}
      >
        {title}
      </button>
    </NodeViewWrapper>
  );
}

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { createContext, useContext } from "react";

// A picture as the document shows it.
//
// The file lives beside the document and the body names it plainly — `![Diagram](diagram.png)`
// — which is what keeps the `.md` readable outside this application: a Markdown viewer, a text
// editor or a forge shows the same picture, because the file is exactly where the line says it
// is. Nothing here rewrites that line; this is a view over it.
//
// The picture itself arrives as a `data:` URL from the shell. The interface never learns where
// the file is, which is why it needs no filesystem permission of its own.

/**
 * Pictures the document names, keyed by filename.
 *
 * `null` in a slot means there is nothing to show — the file has been deleted, or the name in
 * the body never led anywhere. Missing from the map means not fetched yet, which is a
 * different thing and worth showing differently: the first is for the user to notice, the
 * second resolves itself in a moment.
 */
export const DocumentImages = createContext<Map<string, string | null>>(new Map());

export function ImageView({ node }: NodeViewProps) {
  const images = useContext(DocumentImages);

  const name = String(node.attrs["name"] ?? "");
  const alt = String(node.attrs["alt"] ?? "");
  const known = images.has(name);
  const src = images.get(name) ?? null;

  return (
    <NodeViewWrapper as="span" className="picture" data-image={name} contentEditable={false}>
      {src !== null ? (
        // The alt text is the user's, from the body. A picture that fails to load falls back
        // to it, which is the same thing a Markdown reader would show.
        <img src={src} alt={alt} title={alt === "" ? name : `${alt} — ${name}`} />
      ) : (
        <span className={known ? "picture-missing" : "picture-pending"}>
          {known ? `[picture missing: ${name}]` : `[${name}]`}
        </span>
      )}
    </NodeViewWrapper>
  );
}

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { createContext, useContext } from "react";

import { citationKey } from "../lib/citation";
import type { Form } from "../lib/engine";
import { readEmphasis } from "../lib/references";

// A citation as it reads in the text.
//
// The appearance is the engine's answer, never this component's. `(Nieminen, 2021a, p. 44)` is
// not something the interface could work out: the `a` exists only because another Nieminen 2021
// is in the library, and the ampersand-versus-"and" rule depends on where the citation sits in
// the sentence. Everything here does is look up what came back and draw it.
//
// The text on disk is untouched. This is a view over `[^cite:…]`, not a replacement for it.

/**
 * Rendered citations, keyed by source, locator and form.
 *
 * `null` in a slot means the source is gone. Missing from the map means not asked for yet —
 * a different state, and one worth showing differently, since the first is a problem to fix
 * and the second resolves itself in a moment.
 */
export const RenderedCitations = createContext<Map<string, string | null>>(new Map());

export function CitationView({ node }: NodeViewProps) {
  const rendered = useContext(RenderedCitations);

  const source = String(node.attrs["source"] ?? "");
  const locatorAttr = node.attrs["locator"];
  const locator = typeof locatorAttr === "string" && locatorAttr !== "" ? locatorAttr : null;
  const form: Form = node.attrs["form"] === "narrative" ? "narrative" : "parenthetical";

  const key = citationKey(source, locator, form);
  const known = rendered.has(key);
  const text = rendered.get(key) ?? null;

  // Three states, and they are genuinely different things to a reader.
  const [className, title, content] = known
    ? text === null
      ? [
          "citation orphan",
          "This citation points at a source that is no longer in your library",
          "[source missing]",
        ]
      : [
          form === "narrative" ? "citation narrative" : "citation",
          "A claim anchored to a source",
          // A title standing in for an author comes back in italics, `(*Kalevala*, 1849)`,
          // marked the way the reference list marks them.
          readEmphasis(text).map((segment, i) =>
            segment.emphasis ? <em key={i}>{segment.text}</em> : segment.text,
          ),
        ]
    : [
        "citation pending",
        "Working out how this reads",
        // Not an empty box: a citation that briefly occupies no width makes the line jump.
        locator ? `[cite @${locator}]` : "[cite]",
      ];

  return (
    <NodeViewWrapper
      as="span"
      className={className}
      title={title}
      data-citation={source}
      data-form={form}
      contentEditable={false}
    >
      {content}
    </NodeViewWrapper>
  );
}

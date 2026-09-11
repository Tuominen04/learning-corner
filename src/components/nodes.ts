// The two inline node types the storage format defines.
//
// Registered in M0 even though they render plainly here, because retrofitting node types into
// a working editor means reworking every document interaction built before them (ADR 0005).
// In M1 the citation node renders as "(Nieminen, 2021, p. 44)" from the source record; the
// text on disk does not change.

import { Node } from "@tiptap/core";

import { CITATION, DOCUMENT_LINK } from "../lib/body";

export const Citation = Node.create({
  name: CITATION,
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      source: { default: "" },
      /** Exactly as written on disk: `44-46`, or `time:1:04:22`. Never reassembled. */
      locator: { default: null },
      /** `parenthetical` or `narrative` — which shape the sentence around it needs. */
      form: { default: "parenthetical" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-citation]" }];
  },

  renderHTML({ node }) {
    const locator = node.attrs["locator"] as string | null;
    const narrative = node.attrs["form"] === "narrative";
    return [
      "span",
      {
        "data-citation": node.attrs["source"] as string,
        "data-form": narrative ? "narrative" : "parenthetical",
        class: "citation",
        title: "A claim anchored to a source",
      },
      locator ? `[cite @${locator}]` : "[cite]",
    ];
  },
});

export const DocumentLink = Node.create({
  name: DOCUMENT_LINK,
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return { document: { default: "" } };
  },

  parseHTML() {
    return [{ tag: "span[data-document-link]" }];
  },

  renderHTML({ node }) {
    return [
      "span",
      {
        "data-document-link": node.attrs["document"] as string,
        class: "doc-link",
        title: "A link to another document",
      },
      "[link]",
    ];
  },
});

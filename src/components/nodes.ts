// The inline node types the storage format defines.
//
// Registered in M0 even though they rendered plainly then, because retrofitting node types
// into a working editor means reworking every document interaction built before them (ADR
// 0005). The citation node now renders as "(Nieminen, 2021, p. 44)" from the source record,
// and the picture node as the picture; the text on disk does not change either way.
//
// Headings are the exception: they are TipTap's own node, because `# ` has one spelling and
// nothing about it is ours. What is ours is `body.ts`, which decides which blocks are
// headings and writes them back.

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { CITATION, DOCUMENT_LINK, IMAGE } from "../lib/body";
import { CitationView } from "./CitationView";
import { DocumentLinkView } from "./DocumentLinkView";
import { ImageView } from "./ImageView";

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

  // The plain form, used when the editor renders to HTML without a React tree — copying to the
  // clipboard, for instance. What the reader sees in the editor comes from the node view below,
  // which can wait for the engine's answer; this cannot.
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

  // Where `(Nieminen, 2021a, p. 44)` comes from. It has to be a node view rather than
  // `renderHTML` because the text is the engine's answer and arrives asynchronously — the
  // disambiguating `a` is a fact about the whole library, not about this citation.
  addNodeView() {
    return ReactNodeViewRenderer(CitationView);
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

  // The plain form, for when the editor renders to HTML without a React tree. It carries the
  // identifier rather than the title, because the title belongs to another document and this
  // cannot go and look it up.
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

  // Where the title comes from. It has to be a node view because what a link reads as is a
  // fact about a different document — one that can be renamed without this file changing.
  addNodeView() {
    return ReactNodeViewRenderer(DocumentLinkView);
  },
});

/**
 * A picture kept beside the document, named plainly.
 *
 * Inline rather than block, so `As shown ![here](d.png) the bond forms` is a sentence and not
 * three. A picture on its own line is then simply a paragraph with one thing in it, which is
 * also how the Markdown reads.
 */
export const DocumentImage = Node.create({
  name: IMAGE,
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      /** The filename the body carries. Beside the document; never a path. */
      name: { default: "" },
      /** What the picture is, as the body says — read by anything that cannot show it. */
      alt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-image]" }];
  },

  // The plain form, for when the editor renders to HTML without a React tree — copying to the
  // clipboard, for instance. It carries the name rather than the picture, because the picture
  // is the shell's answer and cannot be waited for here.
  renderHTML({ node }) {
    return [
      "img",
      {
        "data-image": node.attrs["name"] as string,
        alt: node.attrs["alt"] as string,
        class: "picture",
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

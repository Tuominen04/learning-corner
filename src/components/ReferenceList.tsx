import { readEmphasis } from "../lib/references";

// The reference list a document builds from the sources it cites.
//
// You never type it and you never maintain it — it is worked out from the citations in the
// text every time the document is saved. It is also **not part of the file**: the document on
// disk holds `[^cite:…]` and nothing else, so a list that is out of date cannot exist and
// there is nothing here for a later edit to contradict.
//
// The ordering, the punctuation and the emphasis are all the engine's, against the whole
// library. Alphabetical by author is an APA 7 requirement, and `2021a` before `2021b` is a
// fact about the library rather than about this document.

export function ReferenceList({ entries }: { entries: string[] }) {
  // A document that cites nothing has no reference list, rather than an empty one. A heading
  // over nothing is a promise the page is not keeping.
  //
  // The `?? []` is not dead code, despite the type. This value crosses the IPC boundary from
  // the engine, where the contract is a promise rather than a guarantee, and the cost of the
  // guarantee failing is out of all proportion: a reference list that throws while rendering
  // takes the editor down with it, and the writing disappears from the screen. Nothing is lost
  // from disk, but nobody believes that while looking at a blank page.
  if ((entries ?? []).length === 0) return null;

  return (
    <section className="references">
      <h3>References</h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry}>
            {readEmphasis(entry).map((segment, i) =>
              segment.emphasis ? <em key={i}>{segment.text}</em> : <span key={i}>{segment.text}</span>,
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

import type { DocumentRef } from "../lib/engine";

// The documents linking here.
//
// Derived from the `[[…]]` in other documents, never stored — no file records what points at
// it. That is what makes this impossible to get out of step with the writing: a link deleted
// in a text editor stops being a backlink the next time the library is read, with nothing to
// tidy up and no second copy of the truth to go stale.
//
// It is also the half of linking nobody has to do any work for. You link forwards, on purpose,
// while writing; this appears on its own. The list is how you notice that two topics you
// thought were separate have been talking to each other for a while.

export function Backlinks({
  entries,
  onOpen,
}: {
  entries: DocumentRef[];
  onOpen: (id: string) => void;
}) {
  // Nothing linking here means no panel, rather than an empty one under a heading. A heading
  // over nothing is a promise the page is not keeping — the same judgement the reference list
  // makes. The `?? []` guards the same way: this crosses the IPC boundary, and a panel that
  // throws while rendering takes the editor down with it and the writing off the screen.
  if ((entries ?? []).length === 0) return null;

  return (
    <section className="backlinks">
      <h3>Linked from</h3>
      <ul>
        {entries.map((doc) => (
          <li key={doc.id}>
            <button className="ghost" onClick={() => onOpen(doc.id)}>
              {doc.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

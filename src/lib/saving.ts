// Everything typed, on disk, before whatever takes the editor away.
//
// Saving is continuous but not instant: the editor waits for a pause in the typing before it
// writes, so for a moment after every keystroke the newest words exist only on screen. Leaving
// the editor has to see that moment through. The editor does it for itself as it goes, since
// switching to another document is one click and a quick one lands inside the pause. Closing
// the library cannot wait for that, though — the words need the library they belong to, and
// it is about to go — so closing asks here first.

/** Writes whatever an editor has not written yet, and resolves once it is on disk. */
type Flush = () => Promise<void>;

const unsaved = new Set<Flush>();

/** Say how to write what an editor is holding. Returns what takes it back, for when it goes. */
export function holdUntilSaved(flush: Flush): () => void {
  unsaved.add(flush);
  return () => {
    unsaved.delete(flush);
  };
}

/**
 * Write everything still waiting for a pause, and wait for it to land.
 *
 * Rejects if any of it could not be written, so that whatever asked can stop rather than carry
 * on as though it had been.
 */
export async function saveEverything(): Promise<void> {
  await Promise.all([...unsaved].map((flush) => flush()));
}

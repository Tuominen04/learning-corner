// Whether the engine is pinned the way ADR 0006 asks: to a tagged release, in the manifest and
// in the lock alike. Pure, so it can be checked against any text — the files on disk, or the
// versions staged for a commit.

export const ENGINE_URL = "https://github.com/Tuominen04/personal-learning-corner-engine";
export const MANIFEST = "src-tauri/Cargo.toml";
export const LOCK = "src-tauri/Cargo.lock";

/** The tag src-tauri/Cargo.toml pins, from its text. */
export function pinnedTag(manifest) {
  const block = /plc-engine\s*=\s*\{([^}]*)\}/s.exec(manifest)?.[1] ?? "";
  if (/\bpath\s*=/.test(block)) return { error: "it names a local path" };
  if (!block.includes(ENGINE_URL)) return { error: "it does not name the engine's repository" };
  const tag = /\btag\s*=\s*"([^"]+)"/.exec(block)?.[1];
  return tag ? { tag } : { error: "it carries no tag" };
}

/** What Cargo.lock says the engine is, from its text. */
export function lockedSource(lock) {
  const entry = /\[\[package\]\]\r?\nname = "plc-engine"\r?\n([^[]*)/.exec(lock)?.[1] ?? "";
  return /^source = "([^"]+)"/m.exec(entry)?.[1] ?? null;
}

/**
 * Whether a manifest and a lock, as they stand, pin a tagged release — and the same one. The
 * lock is the one that matters: it is what a build from main actually resolves, and the only
 * file a local engine changes.
 */
export function verify(manifest, lock) {
  const pin = pinnedTag(manifest);
  if (pin.error) return `${MANIFEST} does not pin the engine to a tag: ${pin.error}.`;
  const source = lockedSource(lock);
  const expected = `git+${ENGINE_URL}?tag=${pin.tag}#`;
  if (source === null) {
    return `${LOCK} records a local engine, not ${pin.tag}. Run \`npm run engine:pinned\`, or take the lock out of the commit with \`git restore --staged ${LOCK}\`.`;
  }
  if (!source.startsWith(expected)) {
    return `${LOCK} records ${source}, not the tag ${MANIFEST} pins (${pin.tag}). Run a cargo build in src-tauri to bring it up to date.`;
  }
  return null;
}

// Talking about a file the user picked, in the words they would use for it.
//
// Nothing here touches the filesystem — it is string handling over a path a native dialog
// handed back, so it works the same on either side of a Windows separator. The engine is
// still the only thing that resolves a path to a file.

/** The last part of a path, for showing a chosen file by name rather than by where it sat. */
export function basename(path: string): string {
  const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return at === -1 ? path : path.slice(at + 1);
}

/**
 * The folder a chosen file sits in, named rather than spelt out in full.
 *
 * "Takes it out of Downloads" is a sentence somebody can check against what they meant. The
 * whole path would be true and unreadable, and this is the choice that deletes something.
 */
export function folder(path: string): string {
  const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (at <= 0) return "that folder";
  const parent = path.slice(0, at);
  const from = Math.max(parent.lastIndexOf("/"), parent.lastIndexOf("\\"));
  return from === -1 ? parent : parent.slice(from + 1) || "that folder";
}

/**
 * What to call a picture, taken from the file it came from.
 *
 * The alt text is the part of `![alt](diagram.png)` a person reads — in a plain-text editor,
 * in a Markdown viewer, in a screen reader. "Muscle repair" is what somebody called the file,
 * so it is a better guess than anything this side could invent, and better than nothing at
 * all, which is what an empty alt leaves behind.
 *
 * Characters that would stop the line round-tripping are taken out rather than escaped: a `]`
 * in the alt text ends the alt text early, and a newline ends the line. Both would mean the
 * editor writing a line it could not read back.
 */
export function altFromPath(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return stem.replace(/[[\]\n\r]/g, " ").replace(/\s+/g, " ").trim();
}

// What differs between the library's and the drive's version of a file changed in both places,
// line by line — so "keep mine or take the drive's" is answered by looking, not by guessing.
//
// The longest common run of lines is kept, and every other line is said to be only in one
// version. A changed line therefore shows as the library's line then the drive's, which is how
// a person compares two sentences anyway.

/** One line of the comparison. */
export type DiffLine =
  | { kind: "same"; text: string }
  | { kind: "library"; text: string }
  | { kind: "drive"; text: string };

/** A comparison with long unchanged stretches folded away: `skip` stands for that many lines. */
export type Shown = DiffLine | { kind: "skip"; count: number };

/**
 * Past this many line pairs, the comparison is not worked out here: the table it needs grows
 * with both lengths at once, and a file this long is better compared in a program made for it.
 */
export const MOST_PAIRS = 4_000_000;

function lines(text: string): string[] {
  if (text === "") return [];
  const all = text.replace(/\r\n?/g, "\n").split("\n");
  // A file ending in a line break has no empty last line, only a finished one.
  if (all.length > 1 && all[all.length - 1] === "") all.pop();
  return all;
}

/** Line by line, in order, or `null` when the two are too long to compare here. */
export function lineDiff(library: string, drive: string): DiffLine[] | null {
  const a = lines(library);
  const b = lines(drive);

  // Lines the two share at the start and end need no table.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const n = endA - start;
  const m = endB - start;
  if (n * m > MOST_PAIRS) return null;

  // length[i][j]: the longest common run of a[start+i..endA) and b[start+j..endB).
  const width = m + 1;
  const length = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      length[i * width + j] =
        a[start + i] === b[start + j]
          ? length[(i + 1) * width + j + 1]! + 1
          : Math.max(length[(i + 1) * width + j]!, length[i * width + j + 1]!);
    }
  }

  const out: DiffLine[] = a.slice(0, start).map((text) => ({ kind: "same", text }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[start + i] === b[start + j]) {
      out.push({ kind: "same", text: a[start + i]! });
      i++;
      j++;
    } else if (length[(i + 1) * width + j]! >= length[i * width + j + 1]!) {
      out.push({ kind: "library", text: a[start + i]! });
      i++;
    } else {
      out.push({ kind: "drive", text: b[start + j]! });
      j++;
    }
  }
  for (; i < n; i++) out.push({ kind: "library", text: a[start + i]! });
  for (; j < m; j++) out.push({ kind: "drive", text: b[start + j]! });
  for (const text of a.slice(endA)) out.push({ kind: "same", text });
  return out;
}

/**
 * The comparison with unchanged stretches folded: `context` lines are kept either side of each
 * change, and a run longer than that becomes one `skip`.
 */
export function folded(diff: DiffLine[], context = 3): Shown[] {
  const near = diff.map(() => false);
  diff.forEach((line, at) => {
    if (line.kind === "same") return;
    for (let k = Math.max(0, at - context); k <= Math.min(diff.length - 1, at + context); k++) {
      near[k] = true;
    }
  });
  const out: Shown[] = [];
  let skipped = 0;
  diff.forEach((line, at) => {
    if (near[at]) {
      if (skipped > 0) out.push({ kind: "skip", count: skipped });
      skipped = 0;
      out.push(line);
    } else {
      skipped++;
    }
  });
  if (skipped > 0) out.push({ kind: "skip", count: skipped });
  return out;
}

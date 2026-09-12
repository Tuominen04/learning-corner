// Reading the emphasis in a reference list entry.
//
// The engine formats each entry and marks emphasis as Markdown `*…*`, because that is what a
// document in this application is written in. APA 7 asks for it in specific places — a book's
// title, a journal's name, the volume number — and an entry that renders those as literal
// asterisks is not a reference list, it is a string with asterisks in it.
//
// This is deliberately not a Markdown parser. It understands one construct, and its first duty
// is to never lose a character: an asterisk with no partner is an asterisk, not the start of
// something that swallows the rest of the line.

export type Segment = { text: string; emphasis: boolean };

/**
 * Split one entry into plain and emphasised runs.
 *
 * Every character of the input survives except the asterisks that formed a pair, so an entry
 * can always be reassembled from what comes back.
 */
export function readEmphasis(entry: string): Segment[] {
  const segments: Segment[] = [];
  let plain = "";
  let i = 0;

  const flush = () => {
    if (plain !== "") segments.push({ text: plain, emphasis: false });
    plain = "";
  };

  while (i < entry.length) {
    if (entry[i] !== "*") {
      plain += entry[i];
      i += 1;
      continue;
    }

    // An opening asterisk is only an opening one if something closes it, and `**` closes
    // nothing worth showing. Otherwise it is just a character in somebody's title.
    const close = entry.indexOf("*", i + 2);
    if (close === -1) {
      plain += "*";
      i += 1;
      continue;
    }

    flush();
    segments.push({ text: entry.slice(i + 1, close), emphasis: true });
    i = close + 1;
  }

  flush();
  return segments;
}

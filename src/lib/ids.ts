// Identifiers the interface makes itself: a diagram's boxes (ADR 0011).
//
// A box's identifier is its own, inside one diagram, and the interface needs it before the
// engine has seen the box — a line is drawn to a box the moment it is added, and an undo has
// to put back exactly the box that was taken away. So it is made here, as the engine makes
// every other: a ULID, 26 characters, a millisecond clock followed by random bits, which is
// what `Id` in the engine parses.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A new identifier, timestamped now. `now` and `random` are there for tests. */
export function newId(now: number = Date.now(), random: () => number = secureRandom): string {
  let time = "";
  let rest = Math.floor(now);
  for (let i = 0; i < 10; i += 1) {
    time = ALPHABET[rest % 32]! + time;
    rest = Math.floor(rest / 32);
  }
  let tail = "";
  for (let i = 0; i < 16; i += 1) tail += ALPHABET[Math.floor(random() * 32)]!;
  return time + tail;
}

/** Whether `text` is shaped like an identifier the engine would accept. */
export function isId(text: string): boolean {
  return /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(text);
}

function secureRandom(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0]! / 2 ** 32;
}

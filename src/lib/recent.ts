// The start screen's list of libraries, put into words.

import { EngineFailure, type RecentLibrary } from "./engine";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Midnight at the start of `at`'s day, where the person is. */
function startOfDay(at: Date): number {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
}

/**
 * When a library was last opened, the way a person would say it.
 *
 * Counted in days on the calendar rather than hours on the clock: something opened late last
 * night was opened "yesterday", even if that was an hour ago. Rounded, because a day with a
 * clock change in it is 23 or 25 hours long and is still one day.
 */
export function whenOpened(opened: string, now: Date = new Date()): string {
  const then = new Date(opened);
  if (Number.isNaN(then.getTime())) return "";

  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  // A clock set wrong can put the last opening in the future. It was still the latest one.
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  const date = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
  return then.getFullYear() === now.getFullYear()
    ? `on ${date}`
    : `on ${date} ${then.getFullYear()}`;
}

/**
 * Why a library from the list did not open, said so that somebody knows what to do next.
 *
 * A folder that is not there gets words of its own. All the engine can say is that it found
 * no library where it looked, which is true and no help: the likely reasons are that it was
 * moved or renamed, or is on a drive that is not plugged in, and each of those has an
 * obvious remedy that nothing else on the screen would suggest.
 */
export function couldNotOpen(library: RecentLibrary, thrown: unknown): string {
  if (!library.found) {
    return `“${library.name}” is not at ${library.path} any more. If it is on a drive, plug the drive in and try again. If you moved it, open it from where it is now.`;
  }
  const reason = thrown instanceof EngineFailure ? thrown.message : String(thrown);
  return `“${library.name}” could not be opened: ${reason}`;
}

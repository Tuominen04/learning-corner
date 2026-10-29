// Saying what a backup plan would do, in the words somebody checks it against.
//
// Nothing here decides anything. The engine classified every file and chose every action; this
// only counts and names them, so the summary on screen is exactly the plan that will be applied.

import type { BackupAction, BackupAnswer, BackupEntry, BackupOutcome, BackupPlan } from "./engine";

/** "1 file", "3 files". */
export function files(n: number): string {
  return `${n} file${n === 1 ? "" : "s"}`;
}

/** How many entries take each action. */
export function counts(plan: BackupPlan): Record<BackupAction, number> {
  const by: Record<BackupAction, number> = {
    "copy-to-drive": 0,
    "remove-from-drive": 0,
    "copy-to-library": 0,
    "remove-from-library": 0,
    leave: 0,
    ask: 0,
  };
  for (const entry of plan.entries) by[entry.action] += 1;
  return by;
}

/**
 * The plan in one sentence: what it changes, and where.
 *
 * Only the actions that happen are named. "Nothing removed" is reassurance on a backup, where
 * removing is what a mirror does, so it is said there and nowhere else.
 */
export function summary(plan: BackupPlan): string {
  if (plan.entries.length === 0) return "Already in step: nothing to do.";
  const c = counts(plan);
  const parts: string[] = [];
  if (plan.direction === "backup") {
    if (c["copy-to-drive"] > 0) parts.push(`${files(c["copy-to-drive"])} to copy to the drive`);
    parts.push(
      c["remove-from-drive"] > 0
        ? `${files(c["remove-from-drive"])} to remove from it`
        : "nothing to remove",
    );
  } else {
    if (c["copy-to-library"] > 0) parts.push(`${files(c["copy-to-library"])} to bring in`);
    if (c["remove-from-library"] > 0)
      parts.push(`${files(c["remove-from-library"])} removed on the drive, to remove here`);
    if (c.ask > 0) parts.push(`${files(c.ask)} changed in both places, to decide about`);
    if (c.leave > 0)
      parts.push(`${files(c.leave)} changed only here, which the next backup takes out`);
  }
  return `${capitalise(parts.join(", "))}.`;
}

/** How one file differs, as somebody would say it. */
export function described(outcome: BackupOutcome): string {
  switch (outcome) {
    case "new-in-library":
      return "New here";
    case "new-on-drive":
      return "New on the drive";
    case "changed-in-library":
      return "Changed here";
    case "changed-on-drive":
      return "Changed on the drive";
    case "changed-in-both":
      return "Changed in both places";
    case "removed-on-drive":
      return "Removed on the drive";
    case "removed-on-drive-changed-in-library":
      return "Removed on the drive, changed here";
    case "removed-in-library":
      return "Removed here";
    case "removed-in-library-changed-on-drive":
      return "Removed here, changed on the drive";
  }
}

/** Keeping both needs a file on both sides: one stays, the other goes beside it. */
export function canKeepBoth(entry: BackupEntry): boolean {
  return entry.library !== null && entry.drive !== null;
}

/** The files still waiting for an answer. A bring-back is applied only when there are none. */
export function unanswered(plan: BackupPlan, answers: Record<string, BackupAnswer>): string[] {
  return plan.entries
    .filter((e) => e.action === "ask" && answers[e.path] === undefined)
    .map((e) => e.path);
}

/** "12 KB", for telling two versions of a file apart at a glance. */
export function size(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 100) / 10} KB`;
  return `${Math.round(bytes / 100_000) / 10} MB`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

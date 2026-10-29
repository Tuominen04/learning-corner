import { describe, expect, it } from "vitest";

import { canKeepBoth, size, summary, unanswered } from "./backup";
import type { BackupEntry, BackupPlan } from "./engine";

const side = { size: 10, modified: "2026-10-20T10:00:00Z" };

function entry(path: string, overrides: Partial<BackupEntry>): BackupEntry {
  return {
    path,
    outcome: "new-in-library",
    action: "copy-to-drive",
    library: side,
    drive: null,
    drive_change: false,
    ...overrides,
  };
}

function plan(direction: BackupPlan["direction"], entries: BackupEntry[]): BackupPlan {
  return {
    direction,
    library_name: "Learning",
    library_path: "/home/me/Learning",
    drive_path: "/run/media/me/USB/Learning",
    known_drive: true,
    entries,
    drive_changes: entries.filter((e) => e.drive_change).length,
    asks: entries.filter((e) => e.action === "ask").length,
    unchanged: 4,
  };
}

describe("a backup plan's summary", () => {
  it("says when there is nothing to do", () => {
    expect(summary(plan("backup", []))).toBe("Already in step: nothing to do.");
  });

  it("counts what goes to the drive, and says when nothing is removed", () => {
    const p = plan("backup", [entry("a.md", {}), entry("b.md", {})]);
    expect(summary(p)).toBe("2 files to copy to the drive, nothing to remove.");
  });

  it("names what a bring-back brings in, asks about and leaves", () => {
    const p = plan("restore", [
      entry("a.md", { outcome: "new-on-drive", action: "copy-to-library", library: null, drive: side }),
      entry("b.md", { outcome: "changed-in-both", action: "ask", drive: side }),
      entry("c.md", { outcome: "changed-in-library", action: "leave", drive: side }),
    ]);
    expect(summary(p)).toBe(
      "1 file to bring in, 1 file changed in both places, to decide about, 1 file changed only here, which the next backup takes out.",
    );
  });
});

describe("answering a bring-back", () => {
  const p = plan("restore", [
    entry("both.md", { outcome: "changed-in-both", action: "ask", drive: side }),
    entry("gone.md", {
      outcome: "removed-on-drive-changed-in-library",
      action: "ask",
      drive: null,
    }),
  ]);

  it("lists the files still waiting for an answer", () => {
    expect(unanswered(p, {})).toEqual(["both.md", "gone.md"]);
    expect(unanswered(p, { "both.md": "keep-both" })).toEqual(["gone.md"]);
  });

  it("offers keeping both only where both sides have the file", () => {
    expect(p.entries.map(canKeepBoth)).toEqual([true, false]);
  });
});

describe("a file's size", () => {
  it("reads at a glance", () => {
    expect(size(512)).toBe("512 B");
    expect(size(12_345)).toBe("12.3 KB");
    expect(size(4_200_000)).toBe("4.2 MB");
  });
});

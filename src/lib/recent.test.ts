import { describe, expect, it } from "vitest";

import { EngineFailure, type RecentLibrary } from "./engine";
import { couldNotOpen, whenOpened } from "./recent";

/** A moment in the local day, however the machine running the tests is set. */
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute);

describe("when a library was last opened", () => {
  const now = at(2026, 9, 28, 10, 15);

  it("says today for anything since midnight", () => {
    expect(whenOpened(at(2026, 9, 28, 0, 1).toISOString(), now)).toBe("today");
    expect(whenOpened(at(2026, 9, 28, 10, 14).toISOString(), now)).toBe("today");
  });

  it("goes by the calendar, not the clock", () => {
    // Twenty minutes ago, and yesterday all the same.
    const lateLastNight = at(2026, 9, 27, 23, 55);
    expect(whenOpened(lateLastNight.toISOString(), at(2026, 9, 28, 0, 15))).toBe("yesterday");
  });

  it("counts the days of the last week", () => {
    expect(whenOpened(at(2026, 9, 25).toISOString(), now)).toBe("3 days ago");
    expect(whenOpened(at(2026, 9, 22).toISOString(), now)).toBe("6 days ago");
  });

  it("names the date after that, and the year once it is not this one", () => {
    expect(whenOpened(at(2026, 9, 21).toISOString(), now)).toBe("on 21 September");
    expect(whenOpened(at(2025, 3, 12).toISOString(), now)).toBe("on 12 March 2025");
  });

  it("treats a moment in the future as the latest there is", () => {
    // A clock put right after the library was opened.
    expect(whenOpened(at(2026, 9, 30).toISOString(), now)).toBe("today");
  });

  it("reads the timestamps the shell actually writes", () => {
    // Whole seconds, UTC, no fraction — the form in the settings file.
    expect(whenOpened("2026-09-28T07:00:00Z", now)).not.toBe("");
  });

  it("says nothing rather than something wrong about a date it cannot read", () => {
    expect(whenOpened("not a date", now)).toBe("");
  });
});

describe("why a library did not open", () => {
  const learning: RecentLibrary = {
    path: "/run/media/me/USB/Learning",
    name: "Learning",
    opened: "2026-09-27T09:00:00Z",
    found: true,
  };

  it("says a missing folder is missing, and what to do about it", () => {
    const said = couldNotOpen({ ...learning, found: false }, null);
    expect(said).toContain("/run/media/me/USB/Learning");
    expect(said).toContain("plug the drive in");
  });

  it("passes on what the engine said about a folder that is there", () => {
    const said = couldNotOpen(
      learning,
      new EngineFailure({ kind: "FormatTooNew", message: "written by a newer version" }),
    );
    expect(said).toBe("“Learning” could not be opened: written by a newer version");
  });
});

import { describe, expect, it } from "vitest";

import { holdUntilSaved, saveEverything } from "./saving";

describe("saving everything", () => {
  it("has nothing to do when nothing is held", async () => {
    await expect(saveEverything()).resolves.toBeUndefined();
  });

  it("waits for what is held to land", async () => {
    let landed = false;
    const release = holdUntilSaved(async () => {
      await new Promise((done) => setTimeout(done, 10));
      landed = true;
    });

    await saveEverything();
    expect(landed).toBe(true);
    release();
  });

  it("asks nothing of an editor that has gone", async () => {
    let asked = 0;
    const release = holdUntilSaved(async () => {
      asked += 1;
    });
    release();

    await saveEverything();
    expect(asked).toBe(0);
  });

  it("says so when something could not be written", async () => {
    // The caller is about to close the library. Resolving here would tell it the words were
    // safe when they are only on screen.
    const release = holdUntilSaved(() => Promise.reject(new Error("the drive has gone")));

    await expect(saveEverything()).rejects.toThrow("the drive has gone");
    release();
  });
});

import { describe, expect, it } from "vitest";

import { isId, newId } from "./ids";

describe("identifiers", () => {
  it("are 26 characters of the alphabet the engine reads", () => {
    for (let i = 0; i < 200; i += 1) expect(isId(newId())).toBe(true);
    expect(newId()).toHaveLength(26);
  });

  it("start with the time, so later ones sort later", () => {
    const early = newId(1_700_000_000_000, () => 0.99);
    const late = newId(1_700_000_000_001, () => 0);
    expect(early < late).toBe(true);
    expect(newId(0, () => 0)).toBe("0".repeat(26));
  });

  it("differ from each other within one millisecond", () => {
    const made = new Set(Array.from({ length: 500 }, () => newId(1_700_000_000_000)));
    expect(made.size).toBe(500);
  });

  it("are told from what is not one", () => {
    expect(isId("01J8ZQ7B2N4Q6S8W0W2Y4A6C8E")).toBe(true);
    expect(isId("")).toBe(false);
    expect(isId("not-an-id")).toBe(false);
    expect(isId("01J8ZQ7B2N4Q6S8W0W2Y4A6C8")).toBe(false);
    // I, L, O and U are not in the alphabet; a first character past 7 overflows 128 bits.
    expect(isId("01J8ZQ7B2N4Q6S8W0W2Y4A6C8I")).toBe(false);
    expect(isId("81J8ZQ7B2N4Q6S8W0W2Y4A6C8E")).toBe(false);
  });
});

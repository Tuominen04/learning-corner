import { describe, expect, it } from "vitest";

import { base64 } from "./picture";

describe("a picture handed to the shell", () => {
  it("is base64, whatever alphabet its text is in", () => {
    const text = "<svg>Я вас любил — Ääkköset</svg>";
    const bytes = Uint8Array.from(atob(base64(text)), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe(text);
  });
});

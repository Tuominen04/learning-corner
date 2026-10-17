import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The window's content security policy, as the release build applies it. `tauri dev` loads the
// page straight from Vite and never applies it, and neither do the browser checks — so a policy
// that blocks something the interface relies on passes every other check and breaks only in the
// installed app. That is how the 0.19.1 build came out with every picture refused.

const config = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
const csp = config.app.security.csp;

/** The sources a directive allows, falling back to `default-src` as a browser does. */
function sources(directive) {
  const directives = new Map(
    csp
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name, values]),
  );
  return directives.get(directive) ?? directives.get("default-src") ?? [];
}

describe("the window's content security policy", () => {
  it("lets pictures through, which arrive from the shell as data: URLs", () => {
    expect(sources("img-src")).toContain("data:");
  });

  it("allows nothing from the network, in any directive", () => {
    for (const value of csp.split(/[\s;]+/)) {
      expect(value).not.toMatch(/^(https?:|wss?:|\*)/);
    }
  });

  it("keeps scripts and connections to the application itself", () => {
    expect(sources("script-src")).toEqual(["'self'"]);
    expect(sources("connect-src")).toEqual(["'self'"]);
  });
});

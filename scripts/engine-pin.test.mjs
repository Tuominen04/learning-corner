import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ENGINE_URL, lockedSource, pinnedTag, verify } from "./engine-pin.mjs";

describe("the pin as committed", () => {
  it("is a tagged release, and the lock agrees with it", () => {
    const manifest = readFileSync(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");
    const lock = readFileSync(new URL("../src-tauri/Cargo.lock", import.meta.url), "utf8");
    // First, so a failure reads as the reason: a local engine, a path, a tag the lock lacks.
    expect(verify(manifest, lock)).toBeNull();
    const { tag } = pinnedTag(manifest);
    expect(tag).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(lockedSource(lock)).toContain(`?tag=${tag}#`);
  });
});

// A manifest and lock in the shapes Cargo writes, small enough to read.
const manifest = `[dependencies]\nserde = "1"\nplc-engine = { \n    git = "${ENGINE_URL}", \n    tag = "v1.2.0" \n}\n`;
const engineEntry = (source) =>
  `[[package]]\nname = "plc-engine"\nversion = "1.2.0"\n${source ? `source = "${source}"\n` : ""}dependencies = [\n "serde",\n]\n`;
const lockWith = (source) =>
  `version = 4\n\n${engineEntry(source)}\n[[package]]\nname = "serde"\nversion = "1.0.0"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\n`;
const tagged = `git+${ENGINE_URL}?tag=v1.2.0#d2a4f5440979e3dc20fbb2acf8960f271bf3c27c`;

describe("what it accepts", () => {
  it("the pin spread over several lines, and a lock at that tag", () => {
    expect(verify(manifest, lockWith(tagged))).toBeNull();
  });

  it("the pin on one line", () => {
    const oneLine = `plc-engine = { git = "${ENGINE_URL}", tag = "v1.2.0" }\n`;
    expect(verify(oneLine, lockWith(tagged))).toBeNull();
  });

  it("a lock with Windows line endings", () => {
    expect(verify(manifest, lockWith(tagged).replace(/\n/g, "\r\n"))).toBeNull();
  });
});

describe("what it refuses", () => {
  it("a lock that records a local engine", () => {
    // The lock as `npm run engine:local` leaves it: the engine's entry without its source.
    expect(lockedSource(lockWith(null))).toBeNull();
    expect(verify(manifest, lockWith(null))).toMatch(/records a local engine, not v1\.2\.0/);
  });

  it("a path in the manifest, on a line of its own", () => {
    // The shape a one-line grep of the manifest cannot see.
    const withPath = manifest.replace(/tag = "[^"]+"/, 'path = "../personal-learning-corner-engine/crates/plc-engine"');
    expect(verify(withPath, lockWith(tagged))).toMatch(/names a local path/);
  });

  it("a manifest with no tag", () => {
    const branch = manifest.replace(/tag = "[^"]+"/, 'branch = "main"');
    expect(verify(branch, lockWith(tagged))).toMatch(/carries no tag/);
  });

  it("a manifest that pins some other repository", () => {
    const fork = manifest.replace(ENGINE_URL, "https://github.com/someone-else/engine-fork");
    expect(verify(fork, lockWith(tagged))).toMatch(/does not name the engine's repository/);
  });

  it("a lock at a different tag from the one pinned", () => {
    const bumped = manifest.replace(/tag = "[^"]+"/, 'tag = "v1.3.0"');
    expect(verify(bumped, lockWith(tagged))).toMatch(/not the tag .* pins \(v1\.3\.0\)/);
  });

  it("a lock at a branch rather than the tag", () => {
    const branch = `git+${ENGINE_URL}?branch=main#d2a4f5440979e3dc20fbb2acf8960f271bf3c27c`;
    expect(verify(manifest, lockWith(branch))).toMatch(/records git\+.*\?branch=main/);
  });

  it("a tag that only begins like the pinned one", () => {
    const longer = `git+${ENGINE_URL}?tag=v1.2.0-rc.1#d2a4f5440979e3dc20fbb2acf8960f271bf3c27c`;
    expect(verify(manifest, lockWith(longer))).toMatch(/not the tag/);
  });
});

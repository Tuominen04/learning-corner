// Which engine the shell builds against: the pinned release, or a checkout on this machine.
//
//   npm run engine:local [-- <path>]   build against a local engine checkout
//   npm run engine:pinned              back to the tagged release in src-tauri/Cargo.toml
//   npm run engine:status              which one is in use
//   npm run engine:check               is the pin, as it would be committed, a tagged release?
//
// "Local" is a Cargo [patch] in .cargo/config.toml at the top of this repository, which git
// ignores. Nothing committed changes: Cargo.toml keeps its tag. Cargo.lock does change while
// the patch is on — it records the local engine — and going back to pinned puts it back.
// Committing it in between is the one way to leak a local engine onto main, so `local`
// installs a pre-commit check that refuses exactly that (ADR 0006).

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ENGINE_URL, LOCK, MANIFEST, pinnedTag, verify } from "./engine-pin.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDE = join(ROOT, ".cargo", "config.toml");
const MARK = "# Written by `npm run engine:local`.";
const HOOK_MARK = "# Installed by `npm run engine:local`.";

/**
 * The local engine in use, or null when the build uses the pinned release. A config.toml this
 * script did not write is the person's own: it is never touched, and only matters here if it
 * patches the engine itself.
 */
function localEngine() {
  if (!existsSync(OVERRIDE)) return null;
  const text = readFileSync(OVERRIDE, "utf8");
  if (!text.includes(MARK)) return text.includes(ENGINE_URL) ? { foreign: true } : null;
  const path = /path\s*=\s*"([^"]+)"/.exec(text)?.[1];
  return { path };
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Resolve the dependency graph, which rewrites Cargo.lock to match what is in use now. */
function resolveLock() {
  try {
    execFileSync("cargo", ["metadata", "--format-version", "1"], {
      cwd: join(ROOT, "src-tauri"),
      stdio: ["ignore", "ignore", "inherit"],
    });
    return true;
  } catch (error) {
    if (error.code === "ENOENT") console.error("cargo is not on PATH, so the lock could not be brought up to date.");
    return false;
  }
}

function describeCheckout(path) {
  try {
    const run = (...args) => execFileSync("git", args, { cwd: path, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const branch = run("rev-parse", "--abbrev-ref", "HEAD");
    const commit = run("rev-parse", "--short", "HEAD");
    const dirty = run("status", "--porcelain") !== "";
    return `${branch} at ${commit}${dirty ? ", with uncommitted changes" : ""}`;
  } catch {
    return "not a git checkout";
  }
}

/** A pre-commit hook that refuses a commit whose Cargo.lock or Cargo.toml would leak a local engine. */
function installHook() {
  let hook;
  try {
    // Asking git, rather than assuming .git/hooks, finds the right place in a worktree and
    // honours core.hooksPath.
    hook = resolve(ROOT, git("rev-parse", "--git-path", "hooks/pre-commit").trim());
  } catch {
    console.log("Not a git checkout, so no pre-commit check was added.");
    return false;
  }
  if (existsSync(hook) && !readFileSync(hook, "utf8").includes(HOOK_MARK)) {
    console.log(
      "You have a pre-commit hook of your own, so none was added. Have it run " +
        "`node scripts/engine.mjs check --staged` to keep a local engine out of commits.",
    );
    return false;
  }
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(
    hook,
    "#!/bin/sh\n" +
      `${HOOK_MARK}\n` +
      "# Refuses a commit that would pin the engine to anything but a tagged release.\n" +
      "# `git commit --no-verify` skips it; deleting this file removes it.\n" +
      "[ -f scripts/engine.mjs ] || exit 0\n" +
      'command -v node >/dev/null 2>&1 || { echo "Engine pin not checked: node is not on PATH." >&2; exit 0; }\n' +
      "exec node scripts/engine.mjs check --staged\n",
  );
  chmodSync(hook, 0o755);
  return true;
}

function local(argument) {
  if (existsSync(OVERRIDE) && !readFileSync(OVERRIDE, "utf8").includes(MARK)) {
    fail(".cargo/config.toml exists and was not written by this script, so it is left alone. Add the [patch] to it by hand, or move it aside.");
  }
  const current = localEngine();
  const given = argument ?? process.env.LC_ENGINE_DIR ?? join(ROOT, "..", "learning-corner-engine");
  const checkout = resolve(ROOT, given);
  const crate = join(checkout, "crates", "lc-engine");
  if (!existsSync(join(crate, "Cargo.toml"))) {
    fail(`No engine checkout at ${checkout} (looked for crates/lc-engine/Cargo.toml). Pass its path: npm run engine:local -- /path/to/learning-corner-engine`);
  }
  const previous = current ? readFileSync(OVERRIDE, "utf8") : null;
  mkdirSync(dirname(OVERRIDE), { recursive: true });
  writeFileSync(
    OVERRIDE,
    `${MARK} Never committed: .gitignore keeps it out.\n` +
      `# \`npm run engine:pinned\` removes it and puts ${LOCK} back.\n` +
      `[patch."${ENGINE_URL}"]\n` +
      `lc-engine = { path = ${JSON.stringify(crate)} }\n`,
  );
  if (!resolveLock()) {
    if (previous === null) removeOverride();
    else writeFileSync(OVERRIDE, previous);
    fail("Cargo could not resolve the build against that checkout (see above), so nothing was changed.");
  }
  const guarded = installHook();
  console.log(`Building against the engine in ${checkout} (${describeCheckout(checkout)}).`);
  console.log(
    `${LOCK} now records it. Leave it out of commits${guarded ? " — a pre-commit check refuses it —" : ""} ` +
      "and run `npm run engine:pinned` when you are done.",
  );
}

function removeOverride() {
  rmSync(OVERRIDE);
  if (readdirSync(dirname(OVERRIDE)).length === 0) rmdirSync(dirname(OVERRIDE));
}

function pinned() {
  const current = localEngine();
  if (current?.foreign) fail(".cargo/config.toml patches the engine, and was not written by this script, so it is left alone. Remove the [patch] from it by hand.");
  if (current) removeOverride();
  if (!resolveLock()) {
    fail(`The local engine is switched off, but cargo could not resolve the pinned one (see above), so ${LOCK} still records the local engine. Run \`npm run engine:pinned\` again once cargo can reach GitHub, or \`git checkout -- ${LOCK}\` to put back the committed one.`);
  }
  const manifest = readFileSync(join(ROOT, MANIFEST), "utf8");
  const problem = verify(manifest, readFileSync(join(ROOT, LOCK), "utf8"));
  if (problem) fail(problem);
  console.log(`Building against the pinned engine, ${pinnedTag(manifest).tag}.`);
  let changed = false;
  try {
    changed = git("status", "--porcelain", "--", LOCK).trim() !== "";
  } catch {
    // Not a git checkout: there is no committed lock to compare with.
  }
  if (changed) {
    console.log(`${LOCK} differs from the last commit. Expected if you changed the pin; if you did not, \`git checkout -- ${LOCK}\` puts back the committed one.`);
  }
}

function status() {
  const current = localEngine();
  const pin = pinnedTag(readFileSync(join(ROOT, MANIFEST), "utf8"));
  const pinText = pin.tag ?? `none (${pin.error})`;
  if (current?.foreign) console.log(`.cargo/config.toml patches the engine: a [patch] of your own, not this script's. Pinned is ${pinText}.`);
  else if (current) console.log(`Local engine: ${current.path} (${describeCheckout(resolve(current.path, "..", ".."))}). Pinned is ${pinText}.`);
  else console.log(`Pinned engine: ${pinText}.`);
}

function check(staged) {
  const read = (file) => {
    if (!staged) return readFileSync(join(ROOT, file), "utf8");
    try {
      return git("show", `:${file}`);
    } catch {
      return fail(`Could not read the staged ${file}, so the engine pin was not checked.`);
    }
  };
  const problem = verify(read(MANIFEST), read(LOCK));
  if (problem) fail(staged ? `Commit refused. ${problem}` : problem);
  if (!staged) console.log("The engine is pinned to a tagged release, and the lock agrees.");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);
switch (command) {
  case "local":
    local(rest[0]);
    break;
  case "pinned":
    pinned();
    break;
  case "status":
    status();
    break;
  case "check":
    check(rest.includes("--staged"));
    break;
  default:
    fail("Usage: node scripts/engine.mjs local [path] | pinned | status | check [--staged]");
}

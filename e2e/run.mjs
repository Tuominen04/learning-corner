// The browser checks: the interface in a real Chromium, with a stub engine behind it, served by
// a Vite server of their own on a free port — so a `tauri dev` already running is no obstacle.
//
//   npm run e2e                    every check in e2e/checks
//   npm run e2e -- moving split    the ones whose file names contain "moving" or "split"
//
// Each file runs as its own process with its own browser, a few at a time. LC_E2E_JOBS sets
// how many; LC_E2E_CHROMIUM names a Chromium to use instead of Playwright's own.

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKS = join(HERE, "checks");
const TIMEOUT_MS = 180_000;
const JOBS = Number(process.env.LC_E2E_JOBS) || Math.max(1, Math.min(4, availableParallelism() - 1));

const wanted = process.argv.slice(2);
const files = readdirSync(CHECKS)
  .filter((name) => name.endsWith(".mjs"))
  .filter((name) => wanted.length === 0 || wanted.some((part) => name.includes(part)))
  .sort();
if (files.length === 0) {
  console.error(`No check in e2e/checks matches ${wanted.join(", ")}.`);
  process.exit(1);
}

const server = await createServer({
  root: join(HERE, ".."),
  clearScreen: false,
  logLevel: "warn",
  server: { port: 0, strictPort: false, open: false },
});
await server.listen();
const url = server.resolvedUrls.local[0];

const count = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** One check file, to the end: its output, its exit code, and how many of its checks passed. */
function run(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [join(CHECKS, file)], {
      env: { ...process.env, URL: url },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    const timer = setTimeout(() => {
      output += `\n(stopped: still running after ${TIMEOUT_MS / 1000} s)`;
      child.kill("SIGTERM");
    }, TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      // Counted from the lines themselves, so a file that stopped early still counts what it did.
      const lines = output.split("\n");
      const passed = lines.filter((line) => line.startsWith("ok  ")).length;
      const failed = lines.filter((line) => line.startsWith("FAIL")).length;
      resolve({
        file,
        ok: code === 0,
        finished: /^\d+ of \d+ checks passed$/m.test(output),
        output,
        seconds: (Date.now() - started) / 1000,
        passed,
        total: passed + failed,
      });
    });
  });
}

function report(result) {
  const name = result.file.replace(/\.mjs$/, "").padEnd(22);
  const time = `${result.seconds.toFixed(1)} s`;
  if (result.ok) {
    console.log(`  ok    ${name} ${String(result.total).padStart(3)} checks   ${time}`);
    return;
  }
  const tally = `${result.passed} of ${result.total} passed${result.finished ? "" : ", then stopped"}`;
  console.log(`  FAIL  ${name} ${tally}   ${time}`);
  // Everything but the checks that passed: the failures, and any error that stopped the file.
  for (const line of result.output.trimEnd().split("\n")) {
    if (!line.startsWith("ok  ") && !/^\d+ of \d+ checks passed$/.test(line)) console.log(`        ${line}`);
  }
}

const jobs = Math.min(JOBS, files.length);
console.log(`${count(files.length, "check file")} against ${url}, ${jobs} at a time\n`);
const queue = [...files];
const results = [];
await Promise.all(
  Array.from({ length: jobs }, async () => {
    while (queue.length > 0) {
      const result = await run(queue.shift());
      report(result);
      results.push(result);
    }
  }),
);
await server.close();

const failed = results.filter((result) => !result.ok);
const checks = results.reduce((sum, result) => sum + result.total, 0);
const passed = results.reduce((sum, result) => sum + result.passed, 0);
console.log(
  failed.length === 0
    ? `\nAll ${count(checks, "check")} in ${count(results.length, "file")} passed.`
    : `\n${failed.length} of ${count(results.length, "file")} failed (${passed} of ${count(checks, "check")} passed): ${failed.map((result) => result.file).join(", ")}`,
);
process.exit(failed.length === 0 ? 0 : 1);

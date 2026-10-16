// What every check in e2e/checks shares: where the interface is, a browser to load it in, and
// the tally that decides the exit code. Each check file is its own process, so the tally is
// simply this module's state.
//
// A check can also be run on its own, against a server you started (`npm run dev`):
//
//   node e2e/checks/layout.mjs [screenshots]
//
// The ones that take screenshots — citation-italics, export, layout — take them only when
// given a path to write them to, and never under `npm run e2e`.

import { chromium } from "playwright";

/** Where the interface is served. `npm run e2e` starts a server of its own and passes its address. */
export const URL = process.env.URL ?? "http://localhost:5173/";

/**
 * A headless Chromium: Playwright's own, which `npx playwright install chromium` fetches once,
 * or the one LC_E2E_CHROMIUM names — a Chromium from your package manager, for instance.
 */
export function launch() {
  return chromium.launch({ executablePath: process.env.LC_E2E_CHROMIUM || undefined });
}

/**
 * What the engine requires of each kind of source: its `SourceType::required_fields`, which the
 * shell's `source_required_fields` hands on. Kept in step with the pinned engine by hand.
 */
export const REQUIRED_FIELDS = {
  book: ["authors", "date", "title", "publisher"],
  "book-chapter": ["authors", "date", "title", "editors", "container", "publisher", "pages"],
  "journal-article": ["authors", "date", "title", "container", "volume"],
  "web-page": ["date", "title", "site"],
  video: ["authors", "date", "title", "site"],
  audio: ["authors", "date", "title", "container"],
  report: ["authors", "date", "title", "publisher"],
  pdf: ["date", "title"],
};

let passed = 0;
let failed = 0;

/** One result, printed as it happens. Returns `ok`, so a check can guard the ones after it. */
export function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : ` — ${detail}`}`);
  if (ok) passed += 1;
  else failed += 1;
  return ok;
}

/** The count, in the line `npm run e2e` reads, and an exit code that fails if anything did. */
export function finish() {
  console.log(`\n${passed} of ${passed + failed} checks passed`);
  process.exit(failed === 0 && passed > 0 ? 0 : 1);
}

// An in-text citation whose title stands in for its author: italics, never asterisks.

import { check, finish, launch, URL } from "../support.mjs";

const DOC = "01J8ZQ7B2N4Q6S8W0W2Y4A6C80";
const KALEVALA = "01J8ZQ8D4Q6S8W0W2Y4A6C8E01";
const NIEMINEN = "01J8ZQ8D4Q6S8W0W2Y4A6C8E02";
const GONE = "01J8ZQ8D4Q6S8W0W2Y4A6C8E09";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 600 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript((ids) => {
  const { DOC, KALEVALA, NIEMINEN, GONE } = ids;
  const body = `The epic was collected from singers.[^cite:${KALEVALA}] ` +
    `[^cite:${KALEVALA}!narrative] begins with creation. ` +
    `Protein matters.[^cite:${NIEMINEN}] An old claim.[^cite:${GONE}] Rated 5* online.[^cite:${NIEMINEN}@44]`;
  const rendered = {
    [`${KALEVALA}|parenthetical`]: "(*Kalevala*, 1849)",
    [`${KALEVALA}|narrative`]: "*Kalevala* (1849)",
    [`${NIEMINEN}|parenthetical`]: "(Nieminen, 2021)",
  };
  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      switch (command) {
        case "recent_libraries":
          return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", topics: 1, documents: 1, writable: true, problems: [] };
        case "topic_tree":
          return [{ id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", name: "Kalevala", children: [], documents: [{ id: DOC, title: "The epic" }] }];
        case "document_read":
          return { id: DOC, title: "The epic", topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", body, revision: "1", modified: "2026-09-01T00:00:00Z" };
        case "source_list":
          return [];
        case "citation_format_many":
          return args.requests.map((r) =>
            r.source === NIEMINEN && r.locator ? "(Nieminen, 2021, p. 44)" : rendered[`${r.source}|${r.form}`] ?? null);
        case "citation_reference_list":
          return ["*Kalevala*. (1849). Suomalaisen Kirjallisuuden Seura."];
        case "document_backlinks":
          return [];
        default:
          return null;
      }
    },
  };
}, { DOC, KALEVALA, NIEMINEN, GONE });

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");
await page.getByRole("button", { name: "The epic" }).first().click();
await page.waitForSelector(".prose .citation:not(.pending)");
await page.waitForTimeout(300);

const citations = await page.locator(".prose .citation").evaluateAll((els) =>
  els.map((el) => ({ text: el.textContent, italic: [...el.querySelectorAll("em")].map((e) => e.textContent) })),
);
check("no citation shows an asterisk", citations.every((c) => !c.text.includes("*")), JSON.stringify(citations));
check(
  "the title is in italics, in parentheses and in a sentence",
  citations[0]?.text === "(Kalevala, 1849)" && citations[0]?.italic[0] === "Kalevala" &&
    citations[1]?.text === "Kalevala (1849)" && citations[1]?.italic[0] === "Kalevala",
  JSON.stringify(citations.slice(0, 2)),
);
check(
  "a citation with nothing to italicise has no italics",
  citations[2]?.text === "(Nieminen, 2021)" && citations[2]?.italic.length === 0,
  JSON.stringify(citations[2]),
);
check(
  "a missing source still says so",
  (await page.locator(".prose .citation.orphan").innerText()) === "[source missing]",
);
check(
  "an asterisk in the writing itself is left alone",
  (await page.locator(".prose").innerText()).includes("Rated 5* online."),
);
if (process.argv[2]) await page.locator("main").screenshot({ path: process.argv[2] });
await browser.close();
finish();

// Claims in a real browser: the summary at the top of a document, the marks Show claims draws,
// and the setting holding as you move between documents.

import { check, finish, launch, URL } from "../support.mjs";

const ALPHA = "01J8ZQ7B2N4Q6S8W0W2Y4A6C80";
const BETA = "01J8ZQ7B2N4Q6S8W0W2Y4A6C81";
const NIEMINEN = "01J8ZQ8D4Q6S8W0W2Y4A6C8E01";
const KALLIO = "01J8ZQ8D4Q6S8W0W2Y4A6C8E02";
const GONE = "01J8ZQ8D4Q6S8W0W2Y4A6C8E09";

const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript((ids) => {
  const { ALPHA, BETA, NIEMINEN, KALLIO, GONE } = ids;
  const person = (family, given) => ({ role: "author", family, given, literal: null, abbreviation: null });
  const source = (id, title, family, year, trust) => ({
    id, type: "book", title, contributors: [person(family, "A.")], date: { kind: "year", year },
    container: null, publisher: null, site: null, volume: null, issue: null, pages: null,
    edition: null, doi: null, url: null, retrieved: null,
    appraisal: trust === null ? null : { trust, note: null }, file: null,
  });
  const sources = [
    source(NIEMINEN, "Ravinto ja terveys", "Nieminen", 2021, "peer-reviewed"),
    source(KALLIO, "Protein in Finland", "Kallio", 2019, null),
  ];
  const bodies = {
    [ALPHA]: `Protein is built from amino acids.[^cite:${NIEMINEN}] I think it matters.\n\nEggs are a complete protein.[^cite:${KALLIO}][^cite:${NIEMINEN}] A note of mine.`,
    [BETA]: `An old claim.[^cite:${GONE}] Nothing else.`,
  };
  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      switch (command) {
        case "recent_libraries":
          return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", topics: 1, documents: 2, writable: true, problems: [] };
        case "topic_tree":
          return [{ id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", name: "Protein", children: [],
            documents: [{ id: ALPHA, title: "Alpha" }, { id: BETA, title: "Beta" }] }];
        case "document_read":
          return { id: args.document, title: args.document === ALPHA ? "Alpha" : "Beta",
            topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", body: bodies[args.document], revision: "1",
            modified: "2026-09-01T00:00:00Z" };
        case "source_list":
          return sources;
        case "citation_format_many":
          return args.requests.map((r) => (r.source === NIEMINEN ? "(Nieminen, 2021)" : r.source === KALLIO ? "(Kallio, 2019)" : null));
        case "citation_reference_list":
          return [];
        case "document_backlinks":
          return [];
        default:
          return null;
      }
    },
  };
}, { ALPHA, BETA, NIEMINEN, KALLIO, GONE });

const summary = () => page.locator(".claim-summary").innerText();
const marked = () => page.locator(".prose .claim").allInnerTexts();

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");
await page.getByRole("button", { name: "Alpha" }).first().click();
await page.waitForSelector(".claim-summary .claim-sources");

const said = await summary();
check("the summary counts the claims", said.includes("2 claims"), said);
check("and the sources behind them, each once", said.includes("2 sources"), said);
check("naming each source with the trust you wrote for it", said.includes("Nieminen 2021") && said.includes("peer-reviewed"), said);
check("and saying plainly which you never rated", said.includes("Kallio 2019") && said.includes("not rated"), said);

check("nothing is marked until asked", (await marked()).length === 0);
await page.getByRole("button", { name: "Show claims" }).click();
await page.waitForSelector(".prose .claim");
const marks = (await marked()).join(" | ");
check(
  "Show claims marks the cited sentences",
  marks.includes("Protein is built from amino acids.") && marks.includes("Eggs are a complete protein."),
  marks,
);
check(
  "and not your own",
  !marks.includes("I think it matters") && !marks.includes("A note of mine"),
  marks,
);
check(
  "the button says it is on",
  (await page.getByRole("button", { name: "Show claims" }).getAttribute("aria-pressed")) === "true",
);

await page.getByRole("button", { name: "Beta" }).first().click();
await page.waitForFunction(() => document.querySelector(".editor h2")?.textContent?.includes("Beta"));
await page.waitForSelector(".prose .claim", { timeout: 3000 }).catch(() => {});
check(
  "the setting holds in the next document",
  (await marked()).join("").includes("An old claim."),
);
const beta = await summary();
check(
  "a citation whose source was deleted is still a claim, and says what became of its source",
  beta.includes("1 claim") && beta.includes("a source that no longer exists"),
  beta,
);

await page.getByRole("button", { name: "Show claims" }).click();
check("and turning it off takes the marks away", (await marked()).length === 0);

await browser.close();
finish();

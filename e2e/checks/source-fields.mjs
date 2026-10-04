// The source form after the APA audit: each type offers the fields its reference prints, a
// report or an episode has a number, and the title says how to write it.

import { check, finish, launch, REQUIRED_FIELDS, URL } from "../support.mjs";

const WHO = "01J8ZQ8D4Q6S8W0W2Y4A6C8E02";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(({ WHO, REQUIRED }) => {
  window.__sent = [];
  const report = {
    id: WHO, type: "report", title: "Taking time: Support for people with cancer",
    date: { kind: "year", year: 2019 },
    contributors: [{ role: "author", family: null, given: null, literal: "National Cancer Institute", abbreviation: null }],
    container: null, publisher: "U.S. Department of Health and Human Services", site: null,
    volume: null, issue: null, pages: null, edition: null,
    number: "NIH Publication No. 18-2059", doi: null, url: null, retrieved: null,
    appraisal: null, file: null,
  };
  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      switch (command) {
        case "recent_libraries":
          return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", topics: 0, documents: 0, writable: true, problems: [] };
        case "topic_tree":
          return [];
        case "source_list":
          return [report];
        case "source_required_fields":
          return REQUIRED[args.sourceType];
        case "source_create":
          window.__sent.push({ command, source: args.source });
          return { id: "01J8ZQ8D4Q6S8W0W2Y4A6C8E09", missing: [] };
        case "source_update":
          window.__sent.push({ command, source: args.source });
          return [];
        case "source_citing_documents":
          return [];
        default:
          return null;
      }
    },
  };
}, { WHO, REQUIRED: REQUIRED_FIELDS });

const labels = () =>
  page.locator(".source-form label.field > span").allInnerTexts().then((all) =>
    all.map((t) => t.replace(" · needed", "").trim()),
  );
const chooseType = async (type) => {
  await page.locator(".source-form select").first().selectOption(type);
  await page.waitForTimeout(150);
};
const showMore = async () => {
  const more = page.getByRole("button", { name: /^Show \d+ more field/ });
  if (await more.count()) await more.click();
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");
await page.getByRole("button", { name: "Sources", exact: true }).click();
await page.getByRole("button", { name: "New source" }).click();
await page.waitForSelector(".source-form");

check(
  "the title says how to write it",
  (await page.locator(".source-form").innerText()).includes("sentence case"),
);

// A book.
await page.waitForTimeout(200);
let shown = await labels();
check("a book asks for its publisher first", shown.includes("Publisher") && !shown.includes("Edition"), JSON.stringify(shown));
check(
  "and says how many more there are: edition, DOI, web address",
  (await page.getByRole("button", { name: "Show 3 more fields" }).count()) === 1,
);
await showMore();
shown = await labels();
check(
  "a book offers what its entry prints, and nothing else",
  ["Publisher", "Edition", "DOI", "Web address"].every((l) => shown.includes(l)) &&
    !shown.some((l) => /number|Volume|Issue|Pages|Part of|Journal|Site name/.test(l)),
  JSON.stringify(shown),
);

await chooseType("report");
shown = await labels();
check("a report has a number", shown.includes("Report number"), JSON.stringify(shown));
check(
  "and the number's hint shows a label written out",
  (await page.locator(".source-form").innerText()).includes("NIH Publication No. 18-2059"),
);

await chooseType("audio");
shown = await labels();
check(
  "an episode has a podcast and an episode number",
  shown.includes("Podcast") && shown.includes("Episode number"),
  JSON.stringify(shown),
);
check(
  "and the type says where the host goes",
  (await page.locator(".source-form").innerText()).includes("goes in as Host"),
);

await chooseType("web-page");
shown = await labels();
check(
  "a web page has no number and no volume",
  !shown.some((l) => /number|Volume/.test(l)) && shown.includes("Site name"),
  JSON.stringify(shown),
);

await chooseType("book-chapter");
shown = await labels();
check(
  "a chapter is offered the book's edition",
  shown.includes("Edition") && shown.includes("Book title") && !shown.some((l) => /number/.test(l)),
  JSON.stringify(shown),
);

// Save a new report with its number.
await chooseType("report");
await page.locator('.field input[placeholder="The title as it is printed"]').fill("Protein and amino acid requirements in human nutrition");
await page.locator('.contributor input[placeholder="Family name"]').fill("Nieminen");
const numberBox = page.locator("label.field", { hasText: "Report number" }).locator("input");
await numberBox.fill("  935 ");
await page.locator("label.field", { hasText: "Publisher" }).locator("input").fill("World Health Organization");
if (process.argv[3]) await page.locator(".source-form").screenshot({ path: process.argv[3] });
await page.getByRole("button", { name: "Save source" }).click();
await page.waitForFunction(() => window.__sent.length === 1, null, { timeout: 3000 }).catch(() => {});
let sent = await page.evaluate(() => window.__sent);
check("a new report's number is sent, trimmed", sent[0]?.source?.number === "935", JSON.stringify(sent[0]?.source?.number));

// Edit the stored report: its number is there, and goes back unchanged.
await page.waitForSelector(".source-list");
await page.locator(".source-row").first().getByRole("button", { name: "Edit" }).click();
await page.waitForSelector(".source-form");
await page.waitForTimeout(200);
await showMore();
check(
  "an existing report shows its number",
  (await page.locator("label.field", { hasText: "Report number" }).locator("input").inputValue()) ===
    "NIH Publication No. 18-2059",
);
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForFunction(() => window.__sent.length === 2, null, { timeout: 3000 }).catch(() => {});
sent = await page.evaluate(() => window.__sent);
check(
  "and saving it keeps the number",
  sent[1]?.command === "source_update" && sent[1]?.source?.number === "NIH Publication No. 18-2059",
  JSON.stringify(sent[1]),
);

if (process.argv[2]) await page.screenshot({ path: process.argv[2], fullPage: true });
await browser.close();
finish();

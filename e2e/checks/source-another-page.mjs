// Adding several pages from one website, in a real browser with a stub engine.
//
// What matters is what is carried from one page to the next and what is not: the site and an
// organisation as author go; the title, the address, the date and a person as author do not,
// so that nothing true of one page can be saved onto another by accident.

import { check, finish, launch, REQUIRED_FIELDS, URL } from "../support.mjs";

const WHO = "01J8ZQ8D4Q6S8W0W2Y4A6C8E02";
const BOOK = "01J8ZQ8D4Q6S8W0W2Y4A6C8E03";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(({ WHO, BOOK, REQUIRED }) => {
  window.__sent = [];
  const sources = [
    {
      id: WHO, type: "web-page", title: "Vitamin D", date: { kind: "full", year: 2019, month: 3, day: 4 },
      contributors: [
        { role: "author", family: null, given: null, literal: "World Health Organization", abbreviation: "WHO" },
        { role: "author", family: "Nieminen", given: "Anna", literal: null, abbreviation: null },
      ],
      container: null, publisher: "World Health Organization", site: "who.int",
      volume: null, issue: null, pages: null, edition: null, number: null, doi: null,
      url: "https://who.int/vitamin-d", retrieved: { kind: "full", year: 2020, month: 1, day: 2 },
      appraisal: { trust: "Reliable", note: null }, file: null,
    },
    {
      id: BOOK, type: "book", title: "Ravinto ja terveys", date: { kind: "year", year: 2021 },
      contributors: [{ role: "author", family: "Kallio", given: "Pekka", literal: null, abbreviation: null }],
      container: null, publisher: "Otava", site: null, volume: null, issue: null, pages: null,
      edition: null, number: null, doi: null, url: null, retrieved: null, appraisal: null, file: null,
    },
  ];
  let made = 0;
  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      switch (command) {
        case "recent_libraries":
          return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", documents: 0, writable: true, problems: [] };
        case "page_tree":
          return [];
        case "source_list":
          return sources;
        case "source_required_fields":
          return REQUIRED[args.sourceType];
        case "source_create": {
          window.__sent.push(args.source);
          made += 1;
          const id = `01J8ZQ8D4Q6S8W0W2Y4A6C8E1${made}`;
          sources.push({ ...args.source, id });
          return { id, missing: [] };
        }
        case "source_citing_documents":
        case "source_citing_works":
          return [];
        default:
          return null;
      }
    },
  };
}, { WHO, BOOK, REQUIRED: REQUIRED_FIELDS });

// By the label's own words, not by any text in the box: the DOI's hint talks about web addresses.
const field = (label) =>
  page
    .locator(".source-form label.field")
    .filter({ has: page.locator(":scope > span", { hasText: new RegExp(`^${label}`) }) })
    .locator("input")
    .first();

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");
await page.getByRole("button", { name: "Sources", exact: true }).click();
await page.waitForSelector(".source-list");

// ---- offered for a web page, and only for one -------------------------------------------------

const rows = page.locator(".source-list li");
check("a web page offers another from its site", (await rows.nth(0).getByRole("button", { name: "Another page" }).count()) === 1);
check("a book does not", (await rows.nth(1).getByRole("button", { name: "Another page" }).count()) === 0);

// ---- what is carried, and what is not -----------------------------------------------------------

await rows.nth(0).getByRole("button", { name: "Another page" }).click();
await page.waitForSelector(".source-form");
check("it opens a new source, not the old one", (await page.locator(".source-form h2").innerText()) === "New source");
check("of the same kind", (await page.locator(".source-form select").first().inputValue()) === "web-page");
check("with the title blank", (await page.getByPlaceholder("The title as it is printed").inputValue()) === "");
await page.getByRole("button", { name: /Show \d+ more field/ }).click().catch(() => {});
check("the site carried over", (await field("Site").inputValue()) === "who.int");
check("and the web address left blank", (await field("Web address").inputValue()) === "");
const contributors = await page.locator(".source-form").innerText();
check("the organisation is there as author", (await page.locator(".source-form input[value='World Health Organization']").count()) >= 1);
check("the person is not", !contributors.includes("Nieminen") && (await page.locator(".source-form input[value='Nieminen']").count()) === 0);
check("the date it was read is recorded, as today", /Record the date/.test(contributors) === false);

// ---- saving it, and the next one -------------------------------------------------------------------

await page.getByPlaceholder("The title as it is printed").fill("Calcium");
await field("Web address").fill("https://who.int/calcium");
await page.getByRole("button", { name: "Save source" }).click();
await page.waitForSelector(".saved-note");

const sent = await page.evaluate(() => window.__sent);
check("what was saved is the new page, with the old one's site", sent.length === 1 && sent[0].title === "Calcium" && sent[0].site === "who.int" && sent[0].id === null, JSON.stringify(sent[0]));
check("and nothing in a box the form does not show", sent[0].publisher === null, JSON.stringify(sent[0].publisher));
check("not with the first page's address or trust", sent[0].url === "https://who.int/calcium" && sent[0].appraisal === null, JSON.stringify(sent[0]));
check("and no person it did not name", sent[0].contributors.every((c) => c.family !== "Nieminen"));

check("a saved web page offers the next from its site, right there", (await page.locator(".saved-note").innerText()).includes("Add another page from who.int"));
await page.getByRole("button", { name: "Add another page from who.int" }).click();
await page.waitForSelector(".source-form");
check("which carries the site again, from the page just saved", (await field("Site").inputValue()) === "who.int" && (await page.getByPlaceholder("The title as it is printed").inputValue()) === "");

// Cancelling leaves nothing behind: a plain new source is a blank book again.
await page.getByRole("button", { name: "Cancel" }).click();
await page.getByRole("button", { name: "New source" }).click();
await page.waitForSelector(".source-form");
check("a new source after that starts blank, not as another page", (await page.locator(".source-form select").first().inputValue()) === "book" && (await page.getByPlaceholder("The title as it is printed").inputValue()) === "");

await browser.close();
finish();

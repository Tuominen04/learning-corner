// The sources screen in a real browser, with a stub engine behind it.
//
// What is being checked is the thing the feature is for: opening a source and being told where
// it is used, without having to start deleting it to find out.

import { check, finish, launch, URL } from "../support.mjs";

const browser = await launch();
const page = await browser.newPage();

page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(() => {
  const asked = [];
  window.__asked = asked;

  const source = (id, title, extra = {}) => ({
    id,
    type: "book",
    title,
    contributors: [{ role: "author", family: "Nieminen", given: "Anna Maria", group: null }],
    date: { kind: "year", year: 2021 },
    container: null,
    publisher: "Otava",
    edition: null,
    volume: null,
    issue: null,
    pages: null,
    doi: null,
    url: null,
    retrieved: null,
    appraisal: null,
    file: null,
    ...extra,
  });

  const CITED = {
    "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G": [
      { id: "01J8ZQ7B2N4Q6S8W0W2Y4A6C8E", title: "What protein is" },
      { id: "01J8ZQ7B2N4Q6S8W0W2Y4A6C8F", title: "Types of protein" },
    ],
    "01J8ZQ8D4Q6S8W0W2Y4A6C8E0H": [],
  };

  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      const status = {
        name: "Learning",
        topics: 1,
        documents: 2,
        writable: true,
        problems: [],
      };
      switch (command) {
        case "plugin:dialog|open":
          return "/home/user/Learning";
        case "library_open":
        case "library_create":
        case "library_status":
          return status;
        case "topic_tree":
          return [
            {
              id: "01J8ZQ6A1M3P5R7T9V1X3Z5B7D",
              name: "Protein",
              children: [],
              documents: [{ id: "01J8ZQ7B2N4Q6S8W0W2Y4A6C8E", title: "What protein is" }],
            },
          ];
        case "source_list":
          return [
            source("01J8ZQ8D4Q6S8W0W2Y4A6C8E0G", "Ravinto ja terveys"),
            source("01J8ZQ8D4Q6S8W0W2Y4A6C8E0H", "Something never cited"),
            source("01J8ZQ8D4Q6S8W0W2Y4A6C8E0J", "One the index cannot answer for"),
          ];
        case "source_citing_documents":
          asked.push(args.source);
          // The third source is the one whose lookup fails, so the screen has to say so
          // rather than sit on "Looking…".
          if (args.source === "01J8ZQ8D4Q6S8W0W2Y4A6C8E0J") {
            throw { kind: "LibraryError", message: "the index could not be read" };
          }
          return CITED[args.source] ?? [];
        case "source_delete_plan":
          return CITED[args.source] ?? [];
        case "document_read":
          return {
            id: args.document,
            title: "What protein is",
            topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B7D",
            body: "Protein is built from amino acids.",
            revision: "1",
            modified: "2026-09-01T00:00:00Z",
          };
        default:
          return null;
      }
    },
  };
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.getByRole("button", { name: "Sources" }).click();
await page.waitForSelector(".source-list");

// ---- the control is there to be scanned, not hunted for -------------------------

const buttons = page.getByRole("button", { name: "Used in" });
check("every source offers it", (await buttons.count()) === 3);

check(
  "it is visible without hovering the row",
  await page.evaluate(() => {
    const b = window.document.querySelector("button.used-in");
    return b !== null && getComputedStyle(b).opacity === "1";
  }),
);

check(
  "and nothing has been asked yet",
  (await page.evaluate(() => window.__asked.length)) === 0,
  "the screen asked before anybody wanted to know",
);

// ---- opening one ----------------------------------------------------------------

await buttons.first().click();
await page.waitForSelector(".uses-count");

check(
  "it says how many documents cite it",
  (await page.locator(".uses-count").innerText()).includes("Cited in 2 documents"),
);

const listed = await page.locator(".uses li button").allTextContents();
check(
  "and names them",
  listed.join("|") === "What protein is|Types of protein",
  JSON.stringify(listed),
);

check(
  "the open one is marked as open",
  (await buttons.first().getAttribute("aria-expanded")) === "true",
);

check(
  "only the source that was asked about was asked about",
  (await page.evaluate(() => window.__asked)).length === 1,
);

// ---- a source nothing cites ------------------------------------------------------

await buttons.nth(1).click();
await page.waitForFunction(() => window.document.querySelectorAll(".uses").length === 2);

check(
  "a source cited nowhere says so, and says it is fine",
  (await page.locator(".uses").nth(1).innerText()).includes("Nothing cites this yet"),
);

check(
  "two can be open at once",
  (await page.locator(".uses").count()) === 2,
);

// ---- closing keeps the answer ----------------------------------------------------

await buttons.first().click();
check("closing collapses it", (await page.locator(".uses").count()) === 1);

await buttons.first().click();
await page.waitForFunction(() => window.document.querySelectorAll(".uses").length === 2);
check(
  "reopening does not ask again",
  (await page.evaluate(() => window.__asked)).length === 2,
  `asked ${JSON.stringify(await page.evaluate(() => window.__asked))}`,
);

// ---- a lookup that fails ----------------------------------------------------------

await buttons.nth(2).click();
await page.waitForSelector(".sources .error");
check(
  "a failed lookup says what went wrong",
  (await page.locator(".sources .error").innerText()).includes("the index could not be read"),
);
check(
  "and collapses rather than sitting on \"Looking…\" forever",
  (await page.locator(".uses").count()) === 2 &&
    (await buttons.nth(2).getAttribute("aria-expanded")) === "false",
  `${await page.locator(".uses").count()} panels open`,
);

// ---- the delete warning still warns ------------------------------------------------

// It draws the same list component now, and a refactor that quietly emptied the warning
// before a destructive action would be the worst possible thing to get wrong here.
await page.locator(".source-row").first().hover();
// Scoped to the row: the tree beside it has delete buttons of its own now.
await page.locator(".source-row").first().getByRole("button", { name: "Delete" }).click();
await page.waitForSelector(".confirm");
check(
  "it still says how many documents would break",
  (await page.locator(".confirm .warning").innerText()).includes("2 documents cite"),
);
check(
  "and still names them",
  (await page.locator(".confirm li button").allTextContents()).join("|") ===
    "What protein is|Types of protein",
);
await page.getByRole("button", { name: "Keep it" }).click();

// ---- the list is a way in ---------------------------------------------------------

await page.locator(".uses li button").first().click();
await page.waitForSelector(".prose .ProseMirror");
check(
  "clicking a document opens it",
  (await page.locator(".editor h2").innerText()).includes("What protein is"),
);

await browser.close();

finish();

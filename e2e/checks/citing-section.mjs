// Citing a section — a heading in a source with no page numbers — in a real browser with a stub
// engine. What matters: the choice is offered; what is typed is passed to the engine as a
// section, written to the page as `@section:…`, and what cannot be kept is said at once rather
// than stripped or left to corrupt the page.

import { check, finish, launch, URL } from "../support.mjs";

const SOURCE = "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G";
const DOC = "01J8ZQ7B2N4Q6S8W0W2Y4A6C8E";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(({ SOURCE, DOC }) => {
  window.__written = [];
  window.__asked = [];
  let revision = "1";
  const doc = () => ({
    id: DOC, title: "What protein is", parent: null,
    body: window.__written.length > 0 ? window.__written.at(-1) : "Protein is built from amino acids.",
    revision, modified: "2026-11-22T00:00:00Z",
  });
  const source = {
    id: SOURCE, type: "web-page", title: "Vitamin D", date: { kind: "year", year: 2019 },
    contributors: [{ role: "author", family: null, given: null, literal: "World Health Organization", abbreviation: "WHO" }],
    container: null, publisher: null, site: "who.int", volume: null, issue: null, pages: null,
    edition: null, number: null, doi: null, url: null, retrieved: null, appraisal: null, file: null,
  };
  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      switch (command) {
        case "plugin:dialog|open":
          return "/home/you/learning";
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", documents: 1, works: 0, writable: true, problems: [] };
        case "library_remembered":
          return { backup: null, hidden_panes: {}, graph: null };
        case "page_tree":
          return [{ id: DOC, title: "What protein is", children: [] }];
        case "document_read":
          return doc();
        case "document_write":
          window.__written.push(args.body);
          revision = String(Number(revision) + 1);
          return doc();
        case "document_diagrams":
          return { shown: [], pointing_here: [] };
        case "source_list":
          return [source];
        case "citation_format_many":
          window.__asked.push(args.requests);
          // As the engine renders them: a section is its heading and the word section.
          return args.requests.map((r) =>
            r.locator && r.locator.kind === "section" ? `(WHO, 2019, ${r.locator.value} section)` : "(WHO, 2019)",
          );
        case "citation_reference_list":
          return ["World Health Organization. (2019). *Vitamin D*. who.int."];
        default:
          return null;
      }
    },
  };
}, { SOURCE, DOC });

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.getByRole("button", { name: "What protein is" }).first().click();
await page.waitForSelector(".prose .ProseMirror");

await page.locator(".prose p").first().click();
await page.keyboard.press("End");
await page.getByRole("button", { name: "Cite", exact: true }).click();
await page.locator(".cite-option", { hasText: "Vitamin D" }).click();

// ---- offered ----------------------------------------------------------------------------------

const kinds = await page.locator(".cite-where select option").allInnerTexts();
check("a section is among the places in a source to cite", kinds.join("|") === "Page|Paragraph|Chapter|Section|Timestamp", kinds.join("|"));

await page.locator(".cite-where select").selectOption("section");
check("its box says what to type", (await page.locator(".cite-where input").getAttribute("placeholder")) === "Methods");
check("and the hint says what it will be cited as", (await page.locator(".cite-where .hint").nth(0).innerText()).includes("“Methods section”"));

// ---- what cannot be kept is said at once, and nothing is changed ---------------------------------

await page.locator(".cite-where input").fill("Methods!");
check("a name with ! in it is refused, with the reason", (await page.locator("#locator-problem").innerText()).includes("cannot contain ] or !"));
check("and the value is exactly what was typed, not stripped", (await page.locator(".cite-where input").inputValue()) === "Methods!");
check("and it cannot be inserted", await page.getByRole("button", { name: "Insert citation" }).isDisabled());

await page.locator(".cite-where input").fill("Results: year two");
check("a colon in a section name is fine", (await page.locator("#locator-problem").count()) === 0 && !(await page.getByRole("button", { name: "Insert citation" }).isDisabled()));
check("and the hint follows what is typed", (await page.locator(".cite-where .hint").nth(0).innerText()).includes("“Results: year two section”"));

// ---- written, and passed to the engine as a section ------------------------------------------------

await page.getByRole("button", { name: "Insert citation" }).click();
await page.waitForFunction(() => window.__written.some((b) => b.includes("@section:")), null, { timeout: 8000 });
const written = await page.evaluate(() => window.__written.at(-1));
check("the page gets the one spelling: section: and the name", written.includes(`[^cite:${SOURCE}@section:Results: year two]`), written);
const asked = await page.evaluate(() => window.__asked.flat().filter((r) => r.locator?.kind === "section"));
check("the engine is asked to format it as a section, whole", asked.length >= 1 && asked.every((r) => r.locator.value === "Results: year two"), JSON.stringify(asked));
await page.locator(".prose .citation").first().waitFor();
check("and it reads as the engine renders it", (await page.locator(".prose").innerText()).includes("(WHO, 2019, Results: year two section)"));

// ---- a page with a colon is refused too: it is written bare ------------------------------------------

await page.locator(".prose p").first().click();
await page.keyboard.press("End");
await page.getByRole("button", { name: "Cite", exact: true }).click();
await page.locator(".cite-option", { hasText: "Vitamin D" }).click();
await page.locator(".cite-where input").fill("4:4");
check("a page number with a colon is refused as well", (await page.locator("#locator-problem").innerText()).includes("colon"));

await browser.close();
finish();

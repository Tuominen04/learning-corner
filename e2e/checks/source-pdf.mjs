// The source form's kinds and fields: a PDF document to choose, a web page that
// need not name anybody, every kind asking for its title — and placeholders that read as
// examples rather than as something already typed.

import { check, finish, launch, REQUIRED_FIELDS, URL } from "../support.mjs";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1300 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(({ REQUIRED }) => {
  window.__sent = [];
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
          return [];
        case "source_required_fields":
          return REQUIRED[args.sourceType];
        case "source_create":
          window.__sent.push(args.source);
          return { id: "01J8ZQ8D4Q6S8W0W2Y4A6C8E09", missing: [] };
        default:
          return null;
      }
    },
  };
}, { REQUIRED: REQUIRED_FIELDS });

const form = page.locator(".source-form");
const chooseType = async (label) => {
  await form.locator("select").first().selectOption({ label });
  await page.waitForTimeout(150);
};
const who = () => form.locator(".contributors > .field-label").innerText();
const titleLabel = () => form.locator("label.field", { has: page.locator("input[placeholder='The title as it is printed']") }).locator("> span").innerText();

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");
await page.getByRole("button", { name: "Sources", exact: true }).click();
await page.getByRole("button", { name: "New source" }).click();
await page.waitForSelector(".source-form");
await page.waitForTimeout(200);

// Placeholders: dimmed well below what is typed.
const colours = await page.evaluate(() => {
  const input = document.querySelector(".source-form input[placeholder='The title as it is printed']");
  return { typed: getComputedStyle(input).color, placeholder: getComputedStyle(input, "::placeholder").color };
});
check("a placeholder is the soft grey of hints, not the colour of typed text",
  colours.placeholder === "rgb(93, 96, 112)" && colours.typed !== colours.placeholder, JSON.stringify(colours));
const everywhere = await page.evaluate(() =>
  [...document.querySelectorAll("input[placeholder]")].map((i) => getComputedStyle(i, "::placeholder").color));
check("and every placeholder on the screen is", everywhere.length >= 4 && everywhere.every((c) => c === "rgb(93, 96, 112)"), JSON.stringify(everywhere));

// The kinds on offer.
const kinds = await form.locator("select").first().locator("option").allInnerTexts();
check("PDF document is in the list of kinds, after Report",
  JSON.stringify(kinds) === JSON.stringify(["Book", "Chapter in a book", "Journal article", "Web page", "Video", "Audio", "Report", "PDF document"]),
  JSON.stringify(kinds));

// A book still needs somebody named.
check("a book: who made it is needed", (await who()).includes("needed"), await who());

// A web page need not name anybody.
await chooseType("Web page");
check("a web page: who made it is not needed", !(await who()).includes("needed"), await who());
check("a web page: the title is needed", (await titleLabel()).includes("needed"), await titleLabel());
check("a web page: the site is needed", (await form.innerText()).includes("Site name · needed"));

// A PDF document.
await chooseType("PDF document");
check("a PDF document says what it is for", (await form.innerText()).includes("A PDF that is none of the above"));
check("its title is needed", (await titleLabel()).includes("needed"), await titleLabel());
check("nobody need be named", !(await who()).includes("needed"), await who());
check("a date is asked for", (await form.locator(".date-field > .field-label").first().innerText()).includes("needed"));
check("and three more fields are offered", (await page.getByRole("button", { name: "Show 3 more fields" }).count()) === 1);
check("no date you read it: a document does not change", !(await form.innerText()).includes("When you read it"));
await page.getByRole("button", { name: "Show 3 more fields" }).click();
const offered = (await form.locator("label.field > span").allInnerTexts()).map((t) => t.replace(" · needed", "").trim());
check("who published it, its DOI and its web address", ["Publisher", "DOI", "Web address"].every((f) => offered.includes(f)) && !offered.includes("Site name") && !offered.includes("Edition"),
  JSON.stringify(offered));

await form.locator("input[placeholder='The title as it is printed']").fill("Protein and exercise: A guide for students");
await form.locator("input[placeholder='Family name']").fill("");
if (process.argv[2]) await form.screenshot({ path: process.argv[2] });
await page.getByRole("button", { name: "Save source" }).click();
await page.waitForTimeout(200);
const sent = await page.evaluate(() => window.__sent.at(-1));
check("saved as a PDF document, with nobody named", sent?.type === "pdf" && sent?.contributors.length === 0 && sent?.title === "Protein and exercise: A guide for students",
  JSON.stringify(sent));

await browser.close();
finish();

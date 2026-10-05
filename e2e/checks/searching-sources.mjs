// Searching sources on the Sources screen, with a stub engine whose search behaves like the
// real one: it matches the start of words, ranks, and returns every kind of hit — so the
// screen has to keep only the sources itself.

import { check, finish, launch, URL } from "../support.mjs";

const NIEMINEN = "01J8ZQ8D4Q6S8W0W2Y4A6C8E01";
const WHO = "01J8ZQ8D4Q6S8W0W2Y4A6C8E02";
const KALLIO = "01J8ZQ8D4Q6S8W0W2Y4A6C8E03";

const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(({ NIEMINEN, WHO, KALLIO }) => {
  const calls = [];
  window.__calls = calls;
  const person = (family, given) => ({ role: "author", family, given, literal: null });
  const source = (id, type, title, contributors, year) => ({
    id, type, title, contributors, date: { kind: "year", year },
    container: null, publisher: null, site: null, volume: null, issue: null, pages: null,
    edition: null, doi: null, url: null, retrieved: null, appraisal: null, file: null,
  });
  let sources = [
    source(NIEMINEN, "book", "Ravinto ja terveys", [person("Nieminen", "Anna Maria")], 2021),
    source(WHO, "report", "Protein and amino acid requirements in human nutrition",
      [{ role: "author", family: null, given: null, literal: "World Health Organization" }], 2007),
    source(KALLIO, "journal-article", "Protein intake in Finnish adults", [person("Kallio", "Kari")], 2019),
  ];
  const words = (s) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const text = (s) =>
    [s.title, ...s.contributors.map((c) => c.literal ?? `${c.given} ${c.family}`)].join(" ");

  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      calls.push({ command, args: args ?? {} });
      switch (command) {
        case "recent_libraries":
          return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", topics: 1, documents: 1, writable: true, problems: [] };
        case "topic_tree":
          return [{ id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", name: "Protein", children: [],
            documents: [{ id: "01J8ZQ7B2N4Q6S8W0W2Y4A6C80", title: "What protein is" }] }];
        case "source_list":
          return sources;
        case "search": {
          // Prefix matching per word, every term required — the real engine's behaviour.
          const terms = words(args.query);
          const hits = [];
          // A document matching "protein", to prove the screen drops what is not a source.
          if (terms.every((t) => "what protein is".includes(t))) {
            hits.push({ id: "01J8ZQ7B2N4Q6S8W0W2Y4A6C80", kind: "document", title: "What protein is", excerpt: "" });
          }
          // Ranked shortest title first: a deterministic stand-in for relevance, and an order
          // unlike the list's, so a screen that ignored the ranking would be caught.
          const found = sources
            .filter((s) => terms.every((t) => words(text(s)).some((w) => w.startsWith(t))))
            .sort((a, b) => a.title.length - b.title.length);
          for (const s of found) hits.push({ id: s.id, kind: "source", title: s.title, excerpt: "" });
          return hits;
        }
        case "source_citing_documents":
          return [{ id: "01J8ZQ7B2N4Q6S8W0W2Y4A6C80", title: "What protein is" }];
        default:
          return null;
      }
    },
  };
}, { NIEMINEN, WHO, KALLIO });

const titles = () => page.locator(".source-list .source-row strong").allInnerTexts();
const searches = () => page.evaluate(() => window.__calls.filter((c) => c.command === "search").length);

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");
await page.getByRole("button", { name: "Sources", exact: true }).click();
await page.waitForSelector(".source-list");

const all = await titles();
check("every source is listed before anything is searched", all.length === 3, JSON.stringify(all));

const box = page.getByRole("textbox", { name: "Search your sources" });
await box.pressSequentially("protein", { delay: 30 });
await page.waitForFunction(() => document.querySelectorAll(".source-list .source-row").length === 2, null, { timeout: 3000 }).catch(() => {});
const found = await titles();
check(
  "a word finds the sources it is in, best match first",
  JSON.stringify(found) ===
    JSON.stringify(["Protein intake in Finnish adults", "Protein and amino acid requirements in human nutrition"]),
  JSON.stringify(found),
);
check(
  "and nothing that is not a source, although the search found a document too",
  !(await page.locator(".sources").innerText()).includes("What protein is"),
);
check(
  "typing a word is not a search per letter",
  (await searches()) < "protein".length,
  `${await searches()} searches for 7 letters`,
);

await box.fill("niem");
await page.waitForFunction(() => document.querySelectorAll(".source-list .source-row").length === 1, null, { timeout: 3000 }).catch(() => {});
check(
  "the start of an author's name is enough",
  JSON.stringify(await titles()) === JSON.stringify(["Ravinto ja terveys"]),
  JSON.stringify(await titles()),
);

await page.locator(".source-row").first().getByRole("button", { name: "Used in" }).click();
await page.waitForSelector(".uses li");
check(
  "a match is the whole row, with what it is used in",
  (await page.locator(".uses").innerText()).includes("What protein is"),
);

await box.fill("vitamin");
await page.waitForSelector("text=No source matches");
check(
  "a search that finds nothing says so",
  (await page.locator(".sources .empty").innerText()).includes("vitamin"),
);

await page.getByRole("button", { name: "Clear the search" }).click();
check(
  "clearing it brings the whole list back at once",
  (await titles()).length === 3,
  JSON.stringify(await titles()),
);

await browser.close();
finish();

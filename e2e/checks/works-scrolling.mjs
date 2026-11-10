// Scrolling a long prose text separately: a column per pane, each scrolling on its own, and a
// row chosen in one brought level in the others.

import { check, finish, launch, URL } from "../support.mjs";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(() => {
  const ROWS = 40;
  // The original's paragraphs are long, the translation's short: the shape that makes panes
  // scrolling together leave long gaps.
  const long = (n) => [`Kappale ${n}. ` + "Pitkä virke, joka jatkuu ja jatkuu. ".repeat(12)];
  const short = (n) => [`Paragraph ${n}.`];
  const work = {
    id: "01J9WORK0000000000000000BB", title: "Proosa", unit: "paragraph", created: "2026-11-07T10:00:00Z",
    sources: [], notes: [], repeats: [], misalignments: [], revision: "1",
    editions: [
      { id: "01J9ED00000000000000000011", kind: "original", language: "fi", scheme: null, label: null, source: null, missing: false,
        rows: Array.from({ length: ROWS }, (_, i) => long(i + 1)) },
      { id: "01J9ED00000000000000000012", kind: "translation", language: "en", scheme: null, label: null, source: null, missing: false,
        rows: Array.from({ length: ROWS }, (_, i) => short(i + 1)) },
    ],
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 0,
    invoke: async (command) => {
      switch (command) {
        case "recent_libraries":
          return [{ path: "/home/you/kielet", name: "Kielet", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/kielet", name: "Kielet", documents: 0, works: 1, writable: true, problems: [] };
        case "page_tree":
        case "source_list":
          return [];
        case "work_list":
          return [{ id: work.id, title: work.title, languages: ["fi", "en"], misaligned: false }];
        case "work_read":
          return structuredClone(work);
        case "library_remembered":
          return { backup: null, hidden_panes: {} };
        default:
          return null;
      }
    },
  };
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Works" }).click();
await page.locator(".work-item").click();
await page.locator(".work-view").waitFor();

await page.getByRole("button", { name: "Scroll separately" }).click();
const columns = page.locator(".column-rows");
check("a column per pane", (await columns.count()) === 2);
const scrollable = await columns.evaluateAll((cs) => cs.map((c) => getComputedStyle(c).overflowY === "auto" && c.scrollHeight > c.clientHeight));
check("the long one scrolls on its own", scrollable[0] === true, JSON.stringify(scrollable));
check("every row keeps its number in every pane", (await page.locator(".column-rows").nth(1).locator(".row-number").count()) === 40);

// Read on in the original without the translation moving.
await columns.nth(0).evaluate((c) => { c.scrollTop = c.scrollHeight / 2; });
const tops = () => columns.evaluateAll((cs) => cs.map((c) => c.scrollTop));
const [originalTop, translationTop] = await tops();
check("scrolling one pane leaves the other where it was", originalTop > 0 && translationTop === 0, JSON.stringify(await tops()));

// Choose the row in view in the original: the translation brings the same row level with it.
const row = await columns.nth(0).evaluate((c) => {
  const rows = [...c.querySelectorAll("[data-row]")];
  const seen = rows.find((r) => r.offsetTop >= c.scrollTop);
  return Number(seen.dataset.row);
});
await page.getByRole("button", { name: `Original (Finnish), row ${row}` }).click();
await page.waitForTimeout(100);
const level = await columns.evaluateAll((cs, r) => cs.map((c) => {
  const el = c.querySelector(`[data-row="${r}"]`);
  return Math.round(el.offsetTop - c.scrollTop);
}), row);
check(`choosing row ${row} brings it level in the other pane`, Math.abs(level[0] - level[1]) <= 2, JSON.stringify(level));
check("and the pane it was chosen in did not move", (await tops())[0] === originalTop, JSON.stringify(await tops()));
check("its tools are shown above the panes", await page.getByRole("toolbar", { name: `Row ${row}` }).isVisible());

await browser.close();
finish();

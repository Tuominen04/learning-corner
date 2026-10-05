// The document view's layout, in a real browser, in a laptop-sized window and a wide one:
// Cite among the tools, the tools staying on screen as a long document scrolls, what they open
// appearing by them, and on a wide window the page centred with the tools down its left side.

import { check, finish, launch, URL } from "../support.mjs";

const MAIN = "01J8ZQ7B2N4Q6S8W0W2Y4A6C80";
const OTHER = "01J8ZQ7B2N4Q6S8W0W2Y4A6C81";
const THIRD = "01J8ZQ7B2N4Q6S8W0W2Y4A6C82";
const LIPSUM = "01J8ZQ8D4Q6S8W0W2Y4A6C8E01";
const READHAT = "01J8ZQ8D4Q6S8W0W2Y4A6C8E02";

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc luctus lacus id suscipit molestie. Sed dignissim malesuada lorem, et accumsan mi viverra ut. Vivamus commodo nulla cursus mattis luctus. Etiam nunc nulla, porttitor sed magna quis, tristique imperdiet leo.";

function body() {
  const parts = ["# Ihan legit H1", "Tässä testataan eri osa-alueita", "## H2"];
  for (let i = 0; i < 14; i += 1) {
    if (i === 5) parts.push("### Ollakseen totta");
    const cite = i % 3 === 0 ? `[^cite:${i % 2 ? LIPSUM : READHAT}]` : "";
    parts.push(`Paragraph ${i + 1}. ${LOREM}${cite} ${LOREM}`);
  }
  return parts.join("\n\n");
}

async function open(width, height) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => check("no page errors", false, e.message));
  await page.addInitScript((ids) => {
    const { MAIN, OTHER, THIRD, LIPSUM, READHAT, BODY } = ids;
    window.__calls = [];
    let text = BODY;
    let revision = 1;
    const titles = { [MAIN]: "Testaus Docs 1 Main", [OTHER]: "Lorem Ipsum 1", [THIRD]: "lorem 2" };
    const doc = (id) => ({ id, title: titles[id], topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B70",
      body: id === MAIN ? text : "Short.", revision: String(revision), modified: "2026-10-03T00:00:00Z" });
    const person = (family) => ({ role: "author", family, given: "A.", literal: null, abbreviation: null });
    const source = (id, title, family) => ({ id, type: "book", title, contributors: [person(family)],
      date: { kind: "year", year: 2026 }, container: null, publisher: null, site: null, volume: null,
      issue: null, pages: null, edition: null, doi: null, url: null, retrieved: null, appraisal: null,
      file: null, number: null });
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: async (command, args) => {
        window.__calls.push({ command, args: args ?? {} });
        switch (command) {
          case "recent_libraries":
            return [{ path: "/home/you/learning", name: "Learning1234", opened: new Date().toISOString(), found: true }];
          case "library_open":
          case "library_status":
            return { path: "/home/you/learning", name: "Learning1234", topics: 1, documents: 3, writable: true, problems: [] };
          case "topic_tree":
            return [{ id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", name: "Testaus Topic", children: [],
              documents: [{ id: THIRD, title: titles[THIRD] }, { id: OTHER, title: titles[OTHER] }, { id: MAIN, title: titles[MAIN] }] }];
          case "document_read":
            return doc(args.document);
          case "document_write":
            text = args.body;
            revision += 1;
            return doc(args.document);
          case "source_list":
            return [source(LIPSUM, "Lipsum", "Lipsum"), source(READHAT, "Readhat", "Readhat")];
          case "citation_format_many":
            return args.requests.map((r) => (r.source === LIPSUM ? "(Lipsum, 2026)" : "(Readhat, 2026)"));
          case "citation_reference_list":
            return ["Lipsum, A. (2026). *Lipsum*.", "Readhat, A. (2026). *Readhat*."];
          case "document_backlinks":
            return [{ id: OTHER, title: titles[OTHER] }];
          default:
            return null;
        }
      },
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, { MAIN, OTHER, THIRD, LIPSUM, READHAT, BODY: body() });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".tree");
  await page.getByRole("button", { name: "Testaus Docs 1 Main" }).first().click();
  await page.waitForSelector(".prose .ProseMirror");
  await page.waitForSelector(".references li");
  return { browser, page };
}

/** Where things are, in the view's own pixels. */
const geometry = (page) =>
  page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const main = document.querySelector(".app > main");
    const style = getComputedStyle(main);
    const m = main.getBoundingClientRect();
    const contentLeft = m.left + main.clientLeft + parseFloat(style.paddingLeft);
    const contentRight = m.left + main.clientLeft + main.clientWidth - parseFloat(style.paddingRight);
    return {
      main: { top: m.top, bottom: m.top + main.clientHeight, left: contentLeft, right: contentRight },
      page: box(".prose"),
      references: box(".references"),
      backlinks: box(".backlinks"),
      note: box(".editor footer.note"),
      claims: box(".claim-summary"),
      title: box(".editor .title"),
      name: box(".editor h2 .name"),
      exportButton: box(".export-action"),
      insert: box(".insert"),
      toolbar: box(".toolbar"),
      panel: box(".insert-panel"),
      scrollTop: main.scrollTop,
    };
  });

const toolNames = (page) => page.locator(".toolbar button").allInnerTexts();
const scrollMain = (page, to) => page.evaluate((y) => { document.querySelector(".app > main").scrollTop = y; }, to);
const near = (a, b, within = 1.5) => Math.abs(a - b) <= within;

/** Put the cursor at the end of a paragraph, brought to the middle of the view first. */
async function cursorInto(page, text) {
  const target = page.locator(".prose p", { hasText: text });
  await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await target.boundingBox();
  await page.mouse.click(box.x + 40, box.y + box.height / 2);
  await page.keyboard.press("End");
}

// ---------------------------------------------------------------- a laptop-sized window

{
  const { browser, page } = await open(1100, 757);
  console.log("-- 1100 × 757");

  check("the tools read H1 H2 H3 Picture Link Cite Split, Cite between Link and Split",
    JSON.stringify(await toolNames(page)) === JSON.stringify(["H1", "H2", "H3", "Picture", "Link", "Cite", "Split"]),
    JSON.stringify(await toolNames(page)));
  const headerButtons = await page.locator(".editor > header button:not(.pencil)").allInnerTexts();
  check("the header keeps Export, and only Export", JSON.stringify(headerButtons) === JSON.stringify(["Export"]), JSON.stringify(headerButtons));

  let g = await geometry(page);
  check("the tools sit above the page", g.toolbar.bottom <= g.page.top && g.toolbar.left >= g.page.left - 1, JSON.stringify({ toolbar: g.toolbar, page: g.page }));
  check("the page is centred in the room there is",
    near(g.page.left - g.main.left, g.main.right - g.page.right), JSON.stringify({ main: g.main, page: g.page }));
  check("title, page, references and footer share one column",
    near(g.title.left, g.page.left) && near(g.references.left, g.page.left) && near(g.note.left, g.page.left) && near(g.references.right, g.page.right),
    JSON.stringify({ title: g.title, page: g.page, references: g.references, note: g.note }));
  check("Export at the right of that column", near(g.exportButton.right, g.page.right), JSON.stringify({ exportButton: g.exportButton, page: g.page }));
  check("nothing wider than the view", await page.evaluate(() => { const m = document.querySelector(".app > main"); return m.scrollWidth <= m.clientWidth; }));

  // Halfway down a long document, the tools are still there, and nothing shows above them.
  await scrollMain(page, 1400);
  await page.waitForTimeout(100);
  g = await geometry(page);
  check("scrolled down, the tools stay at the top of the view", g.scrollTop > 1000 && near(g.insert.top, g.main.top), JSON.stringify({ scrollTop: g.scrollTop, insert: g.insert, main: g.main }));
  const covered = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return hit?.closest(".insert") !== null;
  }, { x: g.toolbar.right + 20 < g.page.right ? g.toolbar.right + 20 : g.page.right - 10, y: g.insert.top + 3 });
  check("and the writing passes under them rather than showing through", covered);

  // Cite, from halfway down: the panel opens by the tools, in view, and the citation goes
  // where the cursor is.
  await cursorInto(page, "Paragraph 9.");
  const before = (await geometry(page)).scrollTop;
  await page.getByRole("button", { name: "Cite", exact: true }).click();
  await page.waitForSelector(".insert-panel .cite-picker");
  g = await geometry(page);
  check("Cite opens its panel right under the tools", near(g.panel.top, g.insert.bottom, 1) && near(g.panel.left, g.page.left) && near(g.panel.right, g.page.right),
    JSON.stringify({ panel: g.panel, insert: g.insert, page: g.page }));
  check("the whole panel is on screen", g.panel.top >= g.main.top && g.panel.bottom <= g.main.bottom, JSON.stringify({ panel: g.panel, main: g.main }));
  check("and opening it does not move the writing", near(g.scrollTop, before, 1), `${before} → ${g.scrollTop}`);
  await page.locator(".cite-option", { hasText: "Lipsum" }).click();
  await page.getByRole("button", { name: "Insert citation" }).click();
  await page.waitForSelector(".insert-panel", { state: "detached" });
  const cited = await page.evaluate(() => [...document.querySelectorAll(".prose p")].find((p) => p.textContent.startsWith("Paragraph 9."))?.querySelectorAll(".citation").length ?? 0);
  check("the citation lands in the paragraph being written", cited === 1, `citations in paragraph 9: ${cited}`);
  check("and nothing else changed shape", (await page.locator(".prose h2, .prose h3").allInnerTexts()).join("|") === "H2|Ollakseen totta",
    (await page.locator(".prose h2, .prose h3").allInnerTexts()).join("|"));

  // One panel at a time.
  await page.getByRole("button", { name: "Cite", exact: true }).click();
  await page.waitForSelector(".insert-panel .cite-picker");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  const opened = await page.locator(".insert-panel h3").allInnerTexts();
  check("choosing another tool swaps the panel rather than stacking a second", opened.length === 1 && !opened[0].includes("Cite"), JSON.stringify(opened));
  await page.locator(".insert-panel").getByTitle("Close").click();

  // A cursor moved up under the tools is brought back out from behind them.
  const para = page.locator(".prose p", { hasText: "Paragraph 6." });
  await para.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const pb = await para.boundingBox();
  await page.mouse.click(pb.x + 30, pb.y + 8); // on its first line
  g = await geometry(page);
  await scrollMain(page, g.scrollTop + (pb.y - g.main.top) - 6); // that line now sits under the bar
  await page.waitForTimeout(50);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  const caret = await page.evaluate(() => {
    const s = window.getSelection();
    const r = s.getRangeAt(0).getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });
  g = await geometry(page);
  check("a cursor under the tools is scrolled back into sight", caret.top >= g.insert.bottom, JSON.stringify({ caret, insertBottom: g.insert.bottom }));

  if (process.argv[2]) {
    await scrollMain(page, 0);
    await page.screenshot({ path: `${process.argv[2]}-1100-top.png` });
    await scrollMain(page, 1400);
    await page.getByRole("button", { name: "Cite", exact: true }).click();
    await page.waitForSelector(".insert-panel .cite-picker");
    await page.screenshot({ path: `${process.argv[2]}-1100-cite.png` });
    await page.locator(".insert-panel").getByTitle("Close").click();
    await page.screenshot({ path: `${process.argv[2]}-1100-scrolled.png` });
  }
  await browser.close();
}

// ---------------------------------------------------------------- a wide window

{
  const { browser, page } = await open(1554, 978);
  console.log("-- 1554 × 978");

  let g = await geometry(page);
  check("the page is centred in the room there is",
    near(g.page.left - g.main.left, g.main.right - g.page.right), JSON.stringify({ main: g.main, page: g.page }));
  check("a page wide, as before", near(g.page.width, 42 * 16), String(g.page.width));
  check("nothing wider than the view", await page.evaluate(() => { const m = document.querySelector(".app > main"); return m.scrollWidth <= m.clientWidth; }));
  check("references, what links here and the footer centred with it",
    [g.references, g.backlinks, g.note].every((b) => near(b.left, g.page.left) && near(b.right, g.page.right)),
    JSON.stringify({ page: g.page, references: g.references, backlinks: g.backlinks, note: g.note }));
  check("the claims line is in that column too", near(g.claims.left, g.page.left), JSON.stringify({ claims: g.claims, page: g.page }));
  const nameCentre = (g.name.left + g.name.right) / 2;
  const titleCentre = (g.title.left + g.title.right) / 2;
  const pageCentre = (g.page.left + g.page.right) / 2;
  check("the title is centred over the page", near(titleCentre, pageCentre, 1) && Math.abs(nameCentre - pageCentre) < 60,
    JSON.stringify({ titleCentre, nameCentre, pageCentre }));
  check("Export stays at the top right", near(g.exportButton.right, g.main.right) && g.exportButton.top < g.page.top,
    JSON.stringify({ exportButton: g.exportButton, main: g.main }));
  check("the tools stand to the left of the page, level with its top",
    g.toolbar.right <= g.page.left - 16 && near(g.toolbar.top, g.page.top, 2),
    JSON.stringify({ toolbar: g.toolbar, page: g.page }));
  const tools = await page.evaluate(() => [...document.querySelectorAll(".toolbar button")].map((b) => {
    const r = b.getBoundingClientRect();
    return { name: b.textContent, left: Math.round(r.left), top: Math.round(r.top) };
  }));
  const levels = tools.slice(0, 3);
  const rest = tools.slice(3);
  check("in a column: the heading levels side by side, then one tool under another",
    levels.every((t) => t.top === levels[0].top) && rest.every((t, i) => t.left === rest[0].left && (i === 0 || t.top > rest[i - 1].top)) && rest[0].top > levels[0].top,
    JSON.stringify(tools));
  check("still in that order", JSON.stringify(tools.map((t) => t.name)) === JSON.stringify(["H1", "H2", "H3", "Picture", "Link", "Cite", "Split"]));

  await scrollMain(page, 1600);
  await page.waitForTimeout(100);
  g = await geometry(page);
  check("scrolled down, the tools stay in view, a little below the top", g.scrollTop > 1000 && near(g.toolbar.top, g.main.top + 24, 2),
    JSON.stringify({ scrollTop: g.scrollTop, toolbar: g.toolbar, main: g.main }));

  await cursorInto(page, "Paragraph 10.");
  const before = (await geometry(page)).scrollTop;
  await page.getByRole("button", { name: "Cite", exact: true }).click();
  await page.waitForSelector(".insert-panel .cite-picker");
  g = await geometry(page);
  check("Cite opens beside the tools, over the page and as wide as it",
    near(g.panel.top, g.toolbar.top, 1) && near(g.panel.left, g.page.left) && near(g.panel.width, g.page.width),
    JSON.stringify({ panel: g.panel, toolbar: g.toolbar, page: g.page }));
  check("the whole panel is on screen", g.panel.top >= g.main.top && g.panel.bottom <= g.main.bottom, JSON.stringify({ panel: g.panel, main: g.main }));
  check("and opening it does not move the writing", near(g.scrollTop, before, 1), `${before} → ${g.scrollTop}`);
  const onTop = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".insert-panel") !== null,
    { x: g.panel.left + 30, y: g.panel.top + 30 });
  check("drawn over the writing, not under it", onTop);
  await page.locator(".cite-option", { hasText: "Readhat" }).click();
  await page.getByRole("button", { name: "Insert citation" }).click();
  await page.waitForSelector(".insert-panel", { state: "detached" });
  const cited = await page.evaluate(() => [...document.querySelectorAll(".prose p")].find((p) => p.textContent.startsWith("Paragraph 10."))?.querySelectorAll(".citation").length ?? 0);
  check("the citation lands in the paragraph being written", cited >= 1, `citations in paragraph 10: ${cited}`);

  if (process.argv[2]) {
    await scrollMain(page, 0);
    await page.screenshot({ path: `${process.argv[2]}-1554-top.png` });
    await scrollMain(page, 1600);
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await page.waitForSelector(".insert-panel");
    await page.screenshot({ path: `${process.argv[2]}-1554-link.png` });
    await page.locator(".insert-panel").getByTitle("Close").click();
    await page.screenshot({ path: `${process.argv[2]}-1554-scrolled.png` });
  }
  await browser.close();
}

// ---------------------------------------------------------------- a short window

{
  const { browser, page } = await open(1100, 560);
  console.log("-- 1100 × 560");
  await scrollMain(page, 1400);
  await cursorInto(page, "Paragraph 9.");
  await page.getByRole("button", { name: "Cite", exact: true }).click();
  await page.waitForSelector(".insert-panel .cite-picker");
  const g = await geometry(page);
  check("a panel taller than the view is cut to fit it", g.panel.top >= g.main.top && g.panel.bottom <= g.main.bottom, JSON.stringify({ panel: g.panel, main: g.main }));
  const reach = await page.evaluate(() => {
    const panel = document.querySelector(".insert-panel");
    const scrolls = panel.scrollHeight > panel.clientHeight;
    panel.scrollTop = panel.scrollHeight;
    const button = [...panel.querySelectorAll("button")].find((b) => b.textContent === "Cancel");
    const r = button.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    return { scrolls, inside: r.top >= p.top && r.bottom <= p.bottom };
  });
  check("and scrolls, so its buttons can still be reached", reach.scrolls && reach.inside, JSON.stringify(reach));
  await browser.close();
}

// ---------------------------------------------------------------- just short of wide

{
  const { browser, page } = await open(1280, 800);
  console.log("-- 1280 × 800");
  const g = await geometry(page);
  check("too narrow for a column of tools beside the page, so they stay above it",
    g.toolbar.bottom <= g.page.top && near(g.page.left - g.main.left, g.main.right - g.page.right),
    JSON.stringify({ toolbar: g.toolbar, page: g.page, main: g.main }));
  await browser.close();
}

finish();

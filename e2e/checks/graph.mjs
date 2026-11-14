// The library graph, in a real browser with a stub engine behind it (ADR 0010).
//
// The picture is a canvas, which a check cannot read, so what is checked is everything the
// picture is drawn from and everything beside it: how many nodes and lines are on it, what a
// chosen page is joined to, narrowing to a page, opening one, what is remembered, and what is
// handed to the shell to save. Nothing is ever written to the library.
//
//   node e2e/checks/graph.mjs [screenshot.png]

import { check, finish, launch, URL } from "../support.mjs";

const SUBJECT = "01J8ZQ6A1M3P5R7T9V1X3Z5B70";
const HISTORY = "01J8ZQ6A1M3P5R7T9V1X3Z5B71";
const TYPE_1 = "01J8ZQ6A1M3P5R7T9V1X3Z5B72";
const TYPE_2 = "01J8ZQ6A1M3P5R7T9V1X3Z5B73";
const DETAIL = "01J8ZQ6A1M3P5R7T9V1X3Z5B74";
const OTHER = "01J8ZQ6A1M3P5R7T9V1X3Z5B75";
const ALONE = "01J8ZQ6A1M3P5R7T9V1X3Z5B76";
const SURVEY = "01J8ZQ8D4Q6S8W0W2Y4A6C8E01";

const shot = process.argv[2];
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript((ids) => {
  const { SUBJECT, HISTORY, TYPE_1, TYPE_2, DETAIL, OTHER, ALONE, SURVEY } = ids;
  window.__calls = [];
  window.__remembered = { backup: null, hidden_panes: {}, graph: null };

  // Subject ─ History, Type 1, Type 2 ─ Detail;  Another subject;  On its own.
  const pages = [
    [SUBJECT, "Subject", SUBJECT, null],
    [HISTORY, "History", SUBJECT, SUBJECT],
    [TYPE_1, "Type 1", SUBJECT, SUBJECT],
    [TYPE_2, "Type 2", SUBJECT, SUBJECT],
    [DETAIL, "Detail", SUBJECT, TYPE_2],
    [OTHER, "Another subject", OTHER, null],
    [ALONE, "On its own", ALONE, null],
  ];
  const graph = (sources) => ({
    nodes: [
      ...pages.map(([id, title, top]) => ({ id, kind: "page", title, top })),
      ...(sources ? [{ id: SURVEY, kind: "source", title: "A survey of the field", top: null }] : []),
    ],
    lines: [
      ...pages.filter((p) => p[3]).map(([id, , , parent]) => ({ from: id, to: parent, kind: "under" })),
      { from: TYPE_1, to: TYPE_2, kind: "links-to" },
      { from: TYPE_2, to: TYPE_1, kind: "links-to" },
      { from: OTHER, to: HISTORY, kind: "links-to" },
      ...(sources ? [{ from: HISTORY, to: SURVEY, kind: "cites" }] : []),
    ],
  });

  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 0,
    invoke: async (command, args) => {
      window.__calls.push({ command, args: args ?? {} });
      switch (command) {
        case "plugin:dialog|open":
          return "/home/you/learning";
        case "plugin:dialog|save":
          return `/home/you/${args.options.defaultPath}`;
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", documents: 7, works: 0, writable: true, problems: [] };
        case "page_tree":
          return [];
        case "library_remembered":
          return window.__remembered;
        case "remember_graph_view":
          window.__remembered = { ...window.__remembered, graph: args.view };
          return null;
        case "library_graph":
          return graph(args.sources);
        case "document_read": {
          const found = pages.find((p) => p[0] === args.document);
          return { id: args.document, title: found[1], parent: found[3], body: "Written.", revision: "1", modified: "2026-11-14T00:00:00Z" };
        }
        default:
          return null;
      }
    },
  };
}, { SUBJECT, HISTORY, TYPE_1, TYPE_2, DETAIL, OTHER, ALONE, SURVEY });

const calls = (command) => page.evaluate((c) => window.__calls.filter((x) => x.command === c), command);
const canvas = page.locator(".graph-canvas");
const on = async () => ({
  nodes: Number(await canvas.getAttribute("data-nodes")),
  lines: Number(await canvas.getAttribute("data-lines")),
});
const joined = (title) =>
  page.locator(".graph-joined", { has: page.locator("h4", { hasText: title }) }).locator("button").allInnerTexts();
const find = async (title) => {
  await page.getByLabel("Find a page or source on the graph, by title").fill(title);
  await page.locator(".graph-found button", { hasText: title }).first().click();
};
/** Whether anything but the ground's colour was drawn: the picture is there, not a blank. */
const drawn = () =>
  canvas.evaluate((c) => {
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 97) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return seen.size;
  });

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.getByRole("button", { name: "Graph", exact: true }).click();
await canvas.waitFor();
await page.waitForFunction(() => document.querySelector(".graph-canvas")?.dataset.nodes === "7");

// ---- what is on it ------------------------------------------------------------------------

check("every page is on the graph, with the tree and the links as lines", JSON.stringify(await on()) === '{"nodes":7,"lines":7}', JSON.stringify(await on()));
check("sources are not asked for until they are wanted", (await calls("library_graph")).every((c) => c.args.sources === false));
check("and something is drawn", (await drawn()) > 3, `${await drawn()} colours`);
check("the picture says what it is to a screen reader", (await canvas.getAttribute("aria-label")).includes("7 pages and 7 lines"), await canvas.getAttribute("aria-label"));

await page.getByLabel("Show the tree").uncheck();
check("without the tree, only the links are lines", (await on()).lines === 3 && (await on()).nodes === 7, JSON.stringify(await on()));
await page.getByLabel("Show the tree").check();

await page.getByLabel("Show sources").check();
await page.waitForFunction(() => document.querySelector(".graph-canvas")?.dataset.nodes === "8");
check("showing sources reads the graph again with them, and their citations", (await on()).lines === 8 && (await calls("library_graph")).at(-1).args.sources === true, JSON.stringify(await on()));

// ---- a page, and what it is joined to -----------------------------------------------------

await find("History");
check("finding a page chooses it", (await page.locator(".graph-chosen h3").innerText()).trim() === "History");
check("and says what it is under", (await joined("Under")).join("|") === "Subject", (await joined("Under")).join("|"));
check("what links to it", (await joined("Linked from")).join("|") === "Another subject", (await joined("Linked from")).join("|"));
check("and what it cites", (await joined("Cites")).join("|") === "A survey of the field", (await joined("Cites")).join("|"));

await page.locator(".graph-joined button", { hasText: /^Subject$/ }).click();
check("a page it is joined to is a step away", (await page.locator(".graph-chosen h3").innerText()).trim() === "Subject");
check("which lists the pages under it", (await joined("Pages under it")).join("|") === "History|Type 1|Type 2", (await joined("Pages under it")).join("|"));

// ---- the keyboard -------------------------------------------------------------------------

await find("Type 2");
await canvas.focus();
let moved = false;
for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
  await page.keyboard.press(key);
  if ((await canvas.getAttribute("data-selected")) !== TYPE_2) {
    moved = true;
    break;
  }
}
const landed = await canvas.getAttribute("data-selected");
check("an arrow key moves along a line to a page it is joined to", moved && [SUBJECT, TYPE_1, DETAIL].includes(landed), landed);

// ---- narrowing ----------------------------------------------------------------------------

await find("Type 2");
await page.getByRole("button", { name: "1 step", exact: true }).click();
check("one step from a page keeps it and what it is joined to", JSON.stringify(await on()) === '{"nodes":4,"lines":5}', JSON.stringify(await on()));
check("and says so, with the way back", (await page.locator(".graph-focus").innerText()).includes("within 1 step"), await page.locator(".graph-focus").innerText());

await find("On its own");
check("finding something outside what is shown shows everything again", (await on()).nodes === 8, JSON.stringify(await on()));
check("a page joined to nothing says so", (await page.locator(".graph-chosen").innerText()).includes("Joined to nothing"));
await find("Subject");
await page.getByRole("button", { name: "Pages under it", exact: true }).click();
check("the pages under a page are it and all of them, however deep", (await on()).nodes === 5, JSON.stringify(await on()));

const kept = await page.evaluate(() => window.__remembered.graph);
check("how the graph was left is remembered", kept?.sources === true && kept?.tree === true && kept?.focus === SUBJECT && kept?.reach === "under", JSON.stringify(kept));

if (shot) await page.screenshot({ path: shot.replace(/\.png$/, "-focus.png") });
await page.getByRole("button", { name: "Show everything" }).click();
check("Show everything is everything", (await on()).nodes === 8);
if (shot) {
  await find("Type 2");
  await page.screenshot({ path: shot });
}

// ---- saving a picture ---------------------------------------------------------------------

await page.getByRole("button", { name: "SVG…" }).click();
await page.locator(".graph-panel .folder-note").waitFor();
const svg = (await calls("graph_export")).at(-1);
const text = Buffer.from(svg.args.data, "base64").toString("utf8");
check("the SVG goes where the dialog said", svg.args.path === "/home/you/graph.svg", svg.args.path);
check("and is the picture: a shape for every node, a line for every line", (text.match(/<circle/g) ?? []).length === 7 && (text.match(/<rect x=/g) ?? []).length === 1 && (text.match(/<line/g) ?? []).length === 8, text.slice(0, 300));
check("with titles in it as text", text.includes("<title>Type 2</title>") && text.includes("A survey of the field"));

await page.getByRole("button", { name: "PNG…" }).click();
await page.waitForFunction(() => window.__calls.filter((c) => c.command === "graph_export").length === 2);
const png = (await calls("graph_export")).at(-1);
check("the PNG is a PNG", Buffer.from(png.args.data, "base64").subarray(1, 4).toString() === "PNG" && png.args.path.endsWith("graph.png"));

// ---- opening, and coming back -------------------------------------------------------------

await find("Detail");
await page.getByRole("button", { name: "Open this page" }).click();
await page.waitForSelector(".prose .ProseMirror");
check("opening a page goes to it", (await page.locator(".editor h2").innerText()).includes("Detail"));

const before = (await calls("library_graph")).length;
await page.getByRole("button", { name: "Graph", exact: true }).click();
await canvas.waitFor();
await page.waitForFunction((n) => window.__calls.filter((c) => c.command === "library_graph").length > n, before);
check("coming back reads the graph again, so what was written since is on it", true);
await page.waitForFunction(() => document.querySelector(".graph-canvas")?.dataset.nodes === "8");
check("as it was left: sources still shown", (await on()).nodes === 8, JSON.stringify(await on()));

const wrote = await page.evaluate(() => window.__calls.map((c) => c.command).filter((c) => /write|create|delete|move|rename|split/.test(c)));
check("and nothing in the library was changed by any of it", wrote.length === 0, wrote.join(", "));

await browser.close();
finish();

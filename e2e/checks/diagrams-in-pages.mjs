// A diagram shown in a page, and put there (ADR 0011), in a real browser with a stub engine.
//
// What matters: the page keeps one line and never a copy; the line is written back exactly as
// it was read; the diagram is drawn from its own file, each box for a page opening that page; a
// diagram that is gone reads as a picture that is gone; and a page says which diagrams point at
// it.
//
//   node e2e/checks/diagrams-in-pages.mjs [screenshot.png]

import { check, finish, launch, URL } from "../support.mjs";

const shot = process.argv[2];
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

const TREE = "01J8ZQ9TREE0000000000000AA";
const NET = "01J8ZQ9NET0000000000000BB0";
const GONE_DIAGRAM = "01J8ZQ9GXN0000000000000CC0";
const SUBJECT = "01J8ZQ6A1M3P5R7T9V1X3Z5B70";
const HISTORY = "01J8ZQ6A1M3P5R7T9V1X3Z5B71";

const BODY = [
  "What the subject is, in brief.",
  "",
  `![Family tree](diagram:${TREE})`,
  "",
  `And inline: ![Lost](diagram:${GONE_DIAGRAM}) there, with ääkköset.`,
  "",
  "![Typed by hand](diagram:nonsense)",
].join("\n");

await page.addInitScript(
  ({ body, TREE, NET, SUBJECT, HISTORY }) => {
    window.__calls = [];
    window.__written = [];
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    let revision = "1";
    const titles = { [SUBJECT]: "Subject", [HISTORY]: "History" };
    const doc = (id) => ({
      id,
      title: titles[id],
      parent: null,
      body: id === SUBJECT ? (window.__written.length > 0 ? window.__written.at(-1) : body) : "History written here.",
      revision,
      modified: "2026-11-18T00:00:00Z",
    });
    const A = "01J8ZQ9NODE000000000000001";
    const B = "01J8ZQ9NODE000000000000002";
    const C = "01J8ZQ9NODE000000000000003";
    const diagrams = {
      [TREE]: {
        id: TREE, title: "Family tree", layout: "layered", direction: "down", revision: "1",
        nodes: [
          { id: A, page: { id: SUBJECT, title: "Subject" }, label: null, when: null, x: null, y: null },
          { id: B, page: { id: HISTORY, title: "History" }, label: null, when: null, x: null, y: null },
          { id: C, page: null, label: "Mother", when: null, x: null, y: null },
        ],
        lines: [{ from: A, to: B, label: "led to" }, { from: C, to: A, label: null }],
      },
      [NET]: {
        id: NET, title: "Network", layout: "free", direction: "down", revision: "1",
        nodes: [{ id: A, page: null, label: "Hub", when: null, x: 0, y: 0 }],
        lines: [],
      },
    };
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: async (command, args) => {
        window.__calls.push({ command, args: args ?? {} });
        switch (command) {
          case "plugin:dialog|open":
            return "/home/you/learning";
          case "library_open":
          case "library_status":
            return { path: "/home/you/learning", name: "Learning", documents: 2, works: 0, writable: true, problems: [] };
          case "library_remembered":
            return { backup: null, hidden_panes: {}, graph: null };
          case "page_tree":
            return [{ id: SUBJECT, title: "Subject", children: [{ id: HISTORY, title: "History", children: [] }] }];
          case "document_read":
            return doc(args.document);
          case "document_write":
            window.__written.push(args.body);
            revision = String(Number(revision) + 1);
            return doc(args.document);
          case "document_image":
            return null;
          case "document_diagrams":
            return args.document === HISTORY
              ? { shown: [], pointing_here: [{ id: TREE, title: "Family tree", layout: "layered" }] }
              : { shown: [{ id: TREE, title: "Family tree", layout: "layered" }], pointing_here: [{ id: TREE, title: "Family tree", layout: "layered" }, { id: NET, title: "Network", layout: "free" }] };
          case "diagram_list":
            return [
              { id: TREE, title: "Family tree", layout: "layered" },
              { id: NET, title: "Network", layout: "free" },
            ];
          case "diagram_read":
            if (diagrams[args.diagram]) return diagrams[args.diagram];
            throw { kind: "NotFound", message: `${args.diagram} not found` };
          default:
            return null;
        }
      },
    };
  },
  { body: BODY, TREE, NET, SUBJECT, HISTORY },
);

const calls = (command) => page.evaluate((c) => window.__calls.filter((x) => x.command === c), command);

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.getByRole("button", { name: "Subject", exact: true }).first().click();
await page.waitForSelector(".prose .ProseMirror");
await page.locator(".diagram-in-page svg").waitFor();

// ---- shown -----------------------------------------------------------------------------------

check("a picture line that names a diagram is drawn as that diagram", (await page.locator(".diagram-in-page svg").getAttribute("data-boxes")) === "3");
check("with its lines", (await page.locator(".diagram-in-page svg").getAttribute("data-lines")) === "2");
check("under the diagram's own title", (await page.locator(".diagram-in-page figcaption strong").innerText()) === "Family tree");
const said = (await page.locator(".diagram-in-page svg").textContent()) ?? "";
check("a box says its page's title, and a label its own words", said.includes("Subject") && said.includes("History") && said.includes("Mother") && said.includes("led to"), said);
check("and the address is not on screen", !(await page.locator(".prose").innerText()).includes(TREE));

check("a diagram that is not there reads as a picture that is gone, and the page is still whole", (await page.locator(".prose .picture-missing").first().innerText()).includes("[diagram missing: Lost]") && (await page.locator(".prose").innerText()).includes("ääkköset"));
check("so does an address that is no identifier at all", (await page.locator(".prose .picture-missing").allInnerTexts()).some((t) => t.includes("[diagram missing: Typed by hand]")));

// No file was asked for: a diagram is not a picture beside the page.
check("nothing is fetched as a picture file for a diagram line", (await calls("document_image")).length === 0);

// ---- the line is the page's, and is written back as it was ----------------------------------

await page.locator(".prose p", { hasText: "ääkköset" }).click({ position: { x: 5, y: 5 } });
await page.keyboard.press("End");
await page.keyboard.type(" More.");
await page.waitForFunction(() => window.__written.length > 0, null, { timeout: 8000 });
const written = await page.evaluate(() => window.__written.at(-1));
check("typing in the page writes the diagram line back character for character", written.includes(`![Family tree](diagram:${TREE})`) && written.includes(`![Lost](diagram:${GONE_DIAGRAM})`) && written.includes("![Typed by hand](diagram:nonsense)") && written.includes(" More.") && written.includes("with ääkköset."), written);
check("and only the one line names the diagram: nothing of it is copied in", !written.includes("Mother") && !written.includes("led to"));

// ---- following a box, and going to edit ---------------------------------------------------------

if (shot) await page.screenshot({ path: shot });
await page.locator(".diagram-in-page svg g[role=link]", { hasText: "History" }).click();
await page.waitForFunction(() => window.document.querySelector(".editor h2")?.innerText.includes("History"), null, { timeout: 5000 });
check("a box for a page opens that page", true);

// And back: the page it points at lists the diagrams that point at it.
await page.locator(".on-diagrams li button", { hasText: "Family tree" }).waitFor();
check("a page lists the diagrams that have a box for it", (await page.locator(".on-diagrams li button").allInnerTexts()).join("|") === "Family tree");
await page.locator(".on-diagrams li button").click();
await page.locator(".diagram-editor").waitFor();
check("and choosing one goes to that diagram", (await page.locator(".diagram-bar h2").innerText()).includes("Family tree"));

await page.getByRole("button", { name: "Documents", exact: true }).click();
await page.getByRole("button", { name: "Subject", exact: true }).first().click();
await page.locator(".diagram-in-page").waitFor();
await page.getByRole("button", { name: "Edit", exact: true }).click();
await page.locator(".diagram-editor").waitFor();
check("Edit on a shown diagram goes to it", (await page.locator(".diagram-bar h2").innerText()).includes("Family tree"));

// ---- putting one there -----------------------------------------------------------------------

await page.getByRole("button", { name: "Documents", exact: true }).click();
await page.getByRole("button", { name: "Subject", exact: true }).first().click();
await page.waitForSelector(".prose .ProseMirror");
await page.getByRole("button", { name: "Diagram", exact: true }).click();
await page.locator(".diagram-picker .cite-option", { hasText: "Network" }).waitFor();
check("the tool lists the diagrams, with their kinds", (await page.locator(".diagram-picker").innerText()).includes("Family tree") && (await page.locator(".diagram-picker").innerText()).includes("Free"));
const before = await page.evaluate(() => window.__written.length);
await page.locator(".diagram-picker .cite-option", { hasText: "Network" }).click();
await page.waitForFunction((n) => window.__written.length > n, before, { timeout: 8000 });
const after = await page.evaluate(() => window.__written.at(-1));
check("choosing one puts one picture line in the page, with its title for the words", after.includes(`![Network](diagram:${NET})`), after);
await page.waitForFunction(() => document.querySelectorAll(".diagram-in-page").length === 2);
check("and it is drawn there", (await page.locator(".diagram-in-page figcaption strong").allInnerTexts()).includes("Network"));

await browser.close();
finish();

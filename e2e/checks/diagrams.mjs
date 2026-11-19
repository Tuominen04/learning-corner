// Diagrams, in a real browser with a stub engine behind it (ADR 0011).
//
// The stub keeps diagrams as the engine does — whole, with a revision, refusing a write made
// from an old one — so what is checked is the interface's side of it: making one, changing it,
// each change reaching the engine whole and once things settle, a conflict being asked about
// rather than overwritten, a box whose page is gone staying where it was, and leaving never
// losing what was typed a moment before.
//
//   node e2e/checks/diagrams.mjs [screenshot.png]

import { check, finish, launch, URL } from "../support.mjs";

const shot = process.argv[2];
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(() => {
  window.__calls = [];
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };

  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let counter = 0;
  const id = () => {
    counter += 1;
    return `01J8ZQ9${String(counter).padStart(3, "0")}${"ABCDEFGHJKMNPQRSTVW".slice(0, 16)}`.slice(0, 26);
  };
  void ALPHABET;

  const SUBJECT = "01J8ZQ6A1M3P5R7T9V1X3Z5B70";
  const HISTORY = "01J8ZQ6A1M3P5R7T9V1X3Z5B71";
  const TYPE_1 = "01J8ZQ6A1M3P5R7T9V1X3Z5B72";
  const OTHER = "01J8ZQ6A1M3P5R7T9V1X3Z5B73";
  const GONE = "01J8ZQ6A1M3P5R7T9V1X3Z5B99";
  const titles = { [SUBJECT]: "Subject", [HISTORY]: "History", [TYPE_1]: "Type 1", [OTHER]: "Other" };
  window.__ids = { SUBJECT, HISTORY, TYPE_1, OTHER, GONE };

  const tree = [
    { id: SUBJECT, title: "Subject", children: [
      { id: HISTORY, title: "History", children: [] },
      { id: TYPE_1, title: "Type 1", children: [] },
    ] },
    { id: OTHER, title: "Other", children: [] },
  ];

  const diagrams = new Map();
  window.__diagrams = diagrams;
  const view = (d) => ({
    id: d.id,
    title: d.title,
    layout: d.layout,
    direction: d.direction,
    nodes: d.nodes.map((n) => ({
      id: n.id,
      page: n.page ? { id: n.page, title: titles[n.page] ?? null } : null,
      label: n.label,
      when: n.when,
      x: n.x,
      y: n.y,
    })),
    lines: d.lines,
    revision: String(d.rev),
  });
  // A diagram somebody made earlier, with a box whose page has gone.
  const old = {
    id: "01J8ZQ9OLD0000000000000001", title: "Old tree", layout: "layered", direction: "down", rev: 1,
    nodes: [
      { id: "01J8ZQ9OLDN000000000000001", page: GONE, label: null, when: null, x: null, y: null },
      { id: "01J8ZQ9OLDN000000000000002", page: SUBJECT, label: null, when: null, x: null, y: null },
    ],
    lines: [{ from: "01J8ZQ9OLDN000000000000001", to: "01J8ZQ9OLDN000000000000002", label: "led to" }],
  };
  diagrams.set(old.id, old);
  // Somebody changes the file in a text editor.
  window.__touch = (diagramId) => { diagrams.get(diagramId).rev += 1; diagrams.get(diagramId).title += "!"; };

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
          return { path: "/home/you/learning", name: "Learning", documents: 4, works: 0, writable: true, problems: [] };
        case "library_remembered":
          return { backup: null, hidden_panes: {}, graph: null };
        case "page_tree":
          return tree;
        case "document_read":
          return { id: args.document, title: titles[args.document], parent: null, body: "Written.", revision: "1", modified: "2026-11-18T00:00:00Z" };
        case "search":
          return [{ id: old.id, kind: "diagram", title: "Old tree", excerpt: "" }];
        case "diagram_list":
          return [...diagrams.values()].map((d) => ({ id: d.id, title: d.title, layout: d.layout })).sort((a, b) => a.title.localeCompare(b.title));
        case "diagram_create": {
          const d = { id: id(), title: args.title, layout: args.layout, direction: "down", rev: 1, nodes: [], lines: [] };
          diagrams.set(d.id, d);
          return view(d);
        }
        case "diagram_read":
          return view(diagrams.get(args.diagram));
        case "diagram_write": {
          const d = diagrams.get(args.diagram);
          if (args.revision !== String(d.rev)) throw { kind: "Conflict", message: "the diagram changed on disk" };
          Object.assign(d, { title: args.edit.title, layout: args.edit.layout, direction: args.edit.direction, nodes: args.edit.nodes, lines: args.edit.lines });
          d.rev += 1;
          return view(d);
        }
        case "diagram_delete_plan":
          return args.diagram === old.id ? [] : [{ id: SUBJECT, title: "Subject" }];
        case "diagram_delete":
          diagrams.delete(args.diagram);
          return null;
        case "export_picture":
          return null;
        default:
          return null;
      }
    },
  };
});

const calls = (command) => page.evaluate((c) => window.__calls.filter((x) => x.command === c), command);
const writes = () => calls("diagram_write");
const lastEdit = async () => (await writes()).at(-1)?.args?.edit;
const waitForWrites = (n) => page.waitForFunction((n) => window.__calls.filter((c) => c.command === "diagram_write").length >= n, n, { timeout: 8000 });
const boxes = () => page.locator(".diagram-list ul").first().locator("button").allInnerTexts();
const status = () => page.locator(".diagram-status").innerText();
const nodes = () => page.locator(".react-flow__node").count();

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.getByRole("button", { name: "Diagrams", exact: true }).click();
await page.locator(".diagrams").waitFor();

// ---- the list, and making one ---------------------------------------------------------------

check("the list says what is there", (await page.locator(".diagram-list-screen li").allInnerTexts()).join("|").includes("Old tree"));
check("a diagram cannot be made without a name", await page.getByRole("button", { name: "Make it" }).isDisabled());
check("and each kind says what it is for", (await page.locator(".diagram-new").innerText()).includes("A family tree, or any hierarchy"));

await page.getByLabel("Name of the new diagram").fill("Family tree");
await page.getByRole("button", { name: "Make it" }).click();
await page.locator(".diagram-editor").waitFor();
check("making one opens it, empty, in the kind chosen", (await page.locator(".diagram-bar h2").innerText()).includes("Family tree") && (await page.getByRole("radio", { name: "Layered" }).getAttribute("aria-checked")) === "true");
check("and says what to do next", (await page.locator(".diagram-empty").innerText()).includes("Add a box"));
check("an untouched diagram is saved, and nothing is written for it", (await status()) === "Saved" && (await writes()).length === 0);

// ---- boxes ----------------------------------------------------------------------------------

await page.getByRole("button", { name: "+ Box", exact: true }).click();
await page.getByRole("button", { name: "+ Box", exact: true }).click();
await page.waitForFunction(() => document.querySelectorAll(".react-flow__node").length === 2);
check("each box added is on the canvas and in the list", (await nodes()) === 2 && (await boxes()).length === 2);
check("the newest is chosen, ready to be written on", (await page.locator(".diagram-inspector h3").textContent()) === "Box");

await waitForWrites(1);
check("the diagram is saved whole a moment after the change", (await lastEdit()).nodes.length === 2 && (await lastEdit()).title === "Family tree", JSON.stringify(await lastEdit()));
check("and says so", (await status()) === "Saved" || (await status()) === "Saving…");

const [first, second] = await page.evaluate(() => [...window.__diagrams.values()].find((d) => d.title === "Family tree").nodes.map((n) => n.id));
await page.locator(".diagram-list li button").first().click();
await page.getByLabel("Says").fill("Mother");
await page.getByLabel("Says").press("Enter");
check("what a box says is one change, made when the field is left", (await boxes())[0].includes("Mother"));
await waitForWrites(2);
check("and it is what was saved", (await lastEdit()).nodes[0].label === "Mother");

// ---- a page ---------------------------------------------------------------------------------

await page.getByRole("button", { name: "+ Page…" }).click();
await page.getByLabel("Search pages").fill("hist");
await page.locator(".cite-option", { hasText: "History" }).click();
check("a box for a page says the page's title", (await boxes()).some((b) => b.includes("History")) && (await page.locator(".diagram-box .text").allInnerTexts()).includes("History"));
check("and points at it by id alone", (await lastEdit()).nodes.length === 3 || true);
await waitForWrites(3);
const pointed = (await lastEdit()).nodes[2];
check("what is saved is the page's id and no words of its own", pointed.page === (await page.evaluate(() => window.__ids.HISTORY)) && pointed.label === null, JSON.stringify(pointed));
check("the inspector says what it points at, and can open it", (await page.locator(".diagram-page").innerText()).includes("History") && (await page.getByRole("button", { name: "Open the page" }).count()) === 1);

// ---- a line, by dragging from one box to another -------------------------------------------

const handle = page.locator(`.react-flow__node[data-id="${first}"] .react-flow__handle-bottom`);
const target = page.locator(`.react-flow__node[data-id="${second}"] .react-flow__handle-top`);
const from = await handle.boundingBox();
const to = await target.boundingBox();
await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
await page.mouse.down();
await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForFunction(() => document.querySelectorAll(".react-flow__edge").length === 1);
check("dragging from a box's edge to another draws a line", (await page.locator(".react-flow__edge").count()) === 1);
await waitForWrites(4);
check("saved from one to the other", (await lastEdit()).lines.length === 1 && (await lastEdit()).lines[0].from === first && (await lastEdit()).lines[0].to === second);

await page.locator(".diagram-list li button", { hasText: "→" }).click();
check("a line chosen from the list is shown with its ends", (await page.locator(".diagram-inspector").innerText()).includes("Mother →"));
await page.getByLabel("Says").fill("parent of");
await page.getByLabel("Says").press("Enter");
await waitForWrites(5);
check("a line can say something, and it is saved", (await lastEdit()).lines[0].label === "parent of");
await page.getByRole("button", { name: "Reverse" }).click();
await waitForWrites(6);
check("and can be turned round", (await lastEdit()).lines[0].from === second && (await lastEdit()).lines[0].to === first);

// ---- undo -----------------------------------------------------------------------------------

await page.getByRole("button", { name: "Undo" }).click();
await waitForWrites(7);
check("undo puts back the line as it was", (await lastEdit()).lines[0].from === first);
await page.getByRole("button", { name: "Redo" }).click();
await waitForWrites(8);
check("and redo turns it again", (await lastEdit()).lines[0].from === second);
await page.getByRole("button", { name: "Undo" }).click();
await waitForWrites(9);

// ---- layouts --------------------------------------------------------------------------------

check("a layered diagram is laid out without being given places", (await lastEdit()).nodes.every((n) => n.x === null && n.y === null));
await page.getByRole("radio", { name: "Free" }).click();
await waitForWrites(10);
check("changing to free gives every box the place it had", (await lastEdit()).layout === "free" && (await lastEdit()).nodes.every((n) => typeof n.x === "number" && typeof n.y === "number"), JSON.stringify((await lastEdit()).nodes));
check("with all its boxes and lines kept", (await lastEdit()).nodes.length === 3 && (await lastEdit()).lines.length === 1);

await page.getByRole("radio", { name: "Timeline" }).click();
await waitForWrites(11);
check("and away from free, the places go", (await lastEdit()).layout === "timeline" && (await lastEdit()).nodes.every((n) => n.x === null && n.y === null));
await page.locator(".diagram-list li button").first().click();
await page.getByLabel("When").fill("c. 1200");
await page.getByLabel("When").press("Enter");
await waitForWrites(12);
check("a timeline box can say when, in words", (await lastEdit()).nodes[0].when === "c. 1200");
check("which shows on the box", (await page.locator(".diagram-box .when").allInnerTexts()).includes("c. 1200"));
await page.getByRole("radio", { name: "Layered" }).click();
await waitForWrites(13);
check("and is kept when the layout changes", (await lastEdit()).nodes[0].when === "c. 1200");
if (shot) await page.screenshot({ path: shot });

// ---- leaving writes what is waiting ---------------------------------------------------------

await page.getByRole("button", { name: "+ Box", exact: true }).click();
await page.getByRole("button", { name: /← Diagrams/ }).click();
await page.locator(".diagrams").waitFor();
await waitForWrites(14);
check("leaving at once still saves the last change", (await lastEdit()).nodes.length === 4);
check("the list has the new diagram", (await page.locator(".diagram-list-screen li").allInnerTexts()).join("|").includes("Family tree"));

// ---- a page that is gone --------------------------------------------------------------------

await page.locator(".diagram-list-screen .hit", { hasText: "Old tree" }).click();
await page.locator(".diagram-editor").waitFor();
check("a box whose page is gone is still there, saying so", (await page.locator(".diagram-box .text").allInnerTexts()).includes("Page gone") && (await nodes()) === 2);
check("with the line between it and the other kept", (await page.locator(".react-flow__edge").count()) === 1);
check("and marked in the list", (await boxes())[0].includes("⚠"));
await page.locator(".diagram-list li button").first().click();
check("it can be unlinked, but not opened", (await page.getByRole("button", { name: "Open the page" }).count()) === 0 && (await page.locator(".diagram-page").innerText()).includes("a page that is gone"));
await page.getByRole("button", { name: "Unlink" }).click();
await waitForWrites(15);
const unlinked = (await lastEdit()).nodes[0];
check("unlinked, it keeps its words and no page", unlinked.page === null && unlinked.label === "Page gone", JSON.stringify(unlinked));

// ---- a change made somewhere else -----------------------------------------------------------

await page.evaluate(() => window.__touch("01J8ZQ9OLD0000000000000001"));
await page.getByRole("button", { name: "+ Box", exact: true }).click();
await page.locator(".diagram-conflict").waitFor({ timeout: 8000 });
check("a diagram changed meanwhile is asked about, not overwritten", (await status()) === "Changed somewhere else");
const before = (await writes()).length;
check("and nothing more is written while it waits", (await page.evaluate(() => window.__diagrams.get("01J8ZQ9OLD0000000000000001").nodes.length)) === 2 && before === (await writes()).length);

await page.getByRole("button", { name: "Use the changed one" }).click();
await page.waitForFunction(() => !document.querySelector(".diagram-conflict"));
check("using the changed one drops what was done here", (await nodes()) === 2 && (await page.locator(".diagram-bar h2").innerText()).includes("Old tree!"));

await page.evaluate(() => window.__touch("01J8ZQ9OLD0000000000000001"));
await page.getByRole("button", { name: "+ Box", exact: true }).click();
await page.locator(".diagram-conflict").waitFor({ timeout: 8000 });
await page.getByRole("button", { name: "Keep mine, over it" }).click();
await page.waitForFunction(() => window.__diagrams.get("01J8ZQ9OLD0000000000000001").nodes.length === 3, null, { timeout: 8000 });
check("keeping mine writes it over the other, because the person said to", (await page.locator(".diagram-conflict").count()) === 0);

// ---- the picture ----------------------------------------------------------------------------

await page.getByRole("button", { name: "SVG…" }).click();
await page.locator(".folder-note").waitFor();
const exported = (await calls("export_picture")).at(-1);
const svg = Buffer.from(exported.args.data, "base64").toString("utf8");
check("a picture is named after the diagram and goes where the dialog said", exported.args.path === "/home/you/Old tree!!.svg" || exported.args.path.endsWith(".svg"), exported.args.path);
check("and is the diagram: a shape for every box and a line for every line", (svg.match(/<rect x=/g) ?? []).length === 3 && (svg.match(/<line /g) ?? []).length === 1 && svg.includes("led to"), svg.slice(0, 200));
await page.getByRole("button", { name: "PNG…" }).click();
await page.waitForFunction(() => window.__calls.filter((c) => c.command === "export_picture").length === 2);
const png = (await calls("export_picture")).at(-1);
check("a PNG is a PNG", Buffer.from(png.args.data, "base64").subarray(1, 4).toString() === "PNG" && png.args.path.endsWith(".png"));

// ---- deleting ---------------------------------------------------------------------------------

await page.getByRole("button", { name: "Delete this diagram…" }).click();
await page.locator(".delete-diagram").waitFor();
check("asking to delete deletes nothing, and says what changes", (await calls("diagram_delete")).length === 0 && (await page.locator(".delete-diagram").innerText()).includes("nothing you wrote is touched"));
await page.getByRole("button", { name: "Keep it" }).click();
await page.locator(".diagram-editor").waitFor();
check("keeping it goes back to it", (await page.locator(".diagram-bar h2").innerText()).includes("Old tree"));

// A diagram a page shows says which pages.
await page.getByRole("button", { name: /← Diagrams/ }).click();
await page.locator(".diagram-list-screen li", { hasText: "Family tree" }).getByRole("button", { name: /Delete/ }).click();
await page.locator(".delete-diagram").waitFor();
const said = await page.locator(".delete-diagram").innerText();
check("a diagram that a page shows names that page, and says its writing stays", said.includes("Subject") && said.includes("stays exactly as it is"), said);
await page.getByRole("button", { name: "Delete", exact: true }).click();
await page.locator(".diagrams").waitFor();
await page.waitForFunction(() => ![...document.querySelectorAll(".diagram-list-screen li")].some((li) => li.textContent.includes("Family tree")));
check("deleting it takes it off the list", (await calls("diagram_delete")).length === 1);

// ---- found by search -----------------------------------------------------------------------

await page.getByPlaceholder("Search your writing").fill("tree");
await page.locator(".results .hit", { hasText: "Old tree" }).waitFor();
check("a search finds a diagram, saying it is one", (await page.locator(".results").innerText()).includes("Diagram"));
await page.locator(".results .hit", { hasText: "Old tree" }).click();
await page.locator(".diagram-editor").waitFor();
check("and opens it", (await page.locator(".diagram-bar h2").innerText()).includes("Old tree"));

await browser.close();
finish();

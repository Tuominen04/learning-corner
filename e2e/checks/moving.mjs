// Moving pages, four ways: the move button and its question; dragging onto a page, onto its top
// or bottom edge, or onto the heading; Ctrl+X / Ctrl+V; and Alt+↑ / Alt+↓ — each against a mock
// engine whose tree really changes, so what the sidebar shows afterwards is what the engine was
// told.

import { check, finish, launch, URL } from "../support.mjs";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(() => {
  window.__calls = [];
  // Protein ─ What protein is
  //         └ In the body ─ How protein is used
  //                       └ Organs
  // Vitamins
  const pages = {
    protein: { id: "protein", title: "Protein", parent: null, body: "" },
    what: { id: "what", title: "What protein is", parent: "protein", body: "Protein is built from amino acids." },
    body: { id: "body", title: "In the body", parent: "protein", body: "" },
    how: { id: "how", title: "How protein is used", parent: "body", body: "Tissue repair." },
    organs: { id: "organs", title: "Organs", parent: "body", body: "" },
    vitamins: { id: "vitamins", title: "Vitamins", parent: null, body: "" },
  };
  // The order of each level, as the engine keeps it in `.order`.
  const order = { "": ["protein", "vitamins"], protein: ["what", "body"], body: ["how", "organs"], organs: [], vitamins: [], what: [], how: [] };
  const key = (parent) => parent ?? "";
  let revision = 1;
  const tree = (parent) =>
    (order[key(parent)] ?? []).map((id) => ({ id, title: pages[id].title, children: tree(id) }));
  const doc = (id) => ({ id, title: pages[id].title, parent: pages[id].parent, body: pages[id].body, revision: String(revision), modified: "2026-10-03T00:00:00Z" });
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 0,
    invoke: async (command, args) => {
      window.__calls.push({ command, args: args ?? {} });
      switch (command) {
        case "recent_libraries":
          return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", documents: 6, works: 0, writable: true, problems: [] };
        case "page_tree":
          return tree(null);
        case "document_read":
          return doc(args.document);
        case "document_write":
          pages[args.document].body = args.body;
          revision += 1;
          return doc(args.document);
        case "document_move": {
          // The engine's own refusal, so a guard that let one through would be seen.
          let up = args.parent;
          while (up) {
            if (up === args.document) throw { kind: "Invalid", message: "a page cannot be moved under itself" };
            up = pages[up].parent;
          }
          const from = order[key(pages[args.document].parent)];
          from.splice(from.indexOf(args.document), 1);
          const to = (order[key(args.parent)] ??= []);
          to.splice(args.position ?? to.length, 0, args.document);
          pages[args.document].parent = args.parent;
          return doc(args.document);
        }
        case "source_list":
        case "citation_format_many":
        case "citation_reference_list":
        case "document_backlinks":
          return [];
        default:
          return null;
      }
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
});

const calls = (name) => page.evaluate((n) => window.__calls.filter((c) => c.command === n), name);
const lastMove = async () => JSON.stringify((await calls("document_move")).at(-1)?.args);
const moves = async () => (await calls("document_move")).length;
const tree = () =>
  page.evaluate(() => {
    const lines = [];
    const walk = (ul, depth) => {
      for (const li of ul?.children ?? []) {
        lines.push(`${"  ".repeat(depth)}${li.querySelector(":scope > .page-row .name").textContent}`);
        walk(li.querySelector(":scope > ul"), depth + 1);
      }
    };
    walk(document.querySelector(".tree > ul"), 0);
    return lines.join("\n");
  });
/** The text of the first match, or "" when there is none — so a missing element fails a check
 * rather than stopping the run. */
const text = async (selector) => ((await page.locator(selector).count()) ? page.locator(selector).first().innerText() : "");
const row = (title) => page.locator(".page-row", { has: page.locator(".name", { hasText: new RegExp(`^${title}$`) }) });
/** Drag a row onto another, at its top edge, its middle, or its bottom edge. */
async function drag(from, to, where = "middle") {
  const box = await row(to).boundingBox();
  const y = where === "top" ? 2 : where === "bottom" ? box.height - 2 : box.height / 2;
  await row(from).dragTo(row(to), { targetPosition: { x: 40, y } });
}

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree .page-row");

const START = "Protein\n  What protein is\n  In the body\n    How protein is used\n    Organs\nVitamins";
check("the tree as the engine has it, in its order", (await tree()) === START, await tree());

// ---- the row -------------------------------------------------------------------------------

await row("What protein is").hover();
const buttons = await row("What protein is").locator("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label") || b.title || b.textContent));
check("a page's row: open, rename, a page under it, move, delete",
  JSON.stringify(buttons.slice(1)) === JSON.stringify(["Rename this page", "New page under What protein is", "Move this page", "Delete this page"]), JSON.stringify(buttons));
const xs = await row("What protein is").locator("button.pencil, button.add, button.move, button.delete").evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().left)));
check("the pencil, +, arrows and bin sit in that order, apart", xs.every((x, i) => i === 0 || x - xs[i - 1] >= 14), JSON.stringify(xs));
check("a page with pages under it reads heavier", (await row("In the body").getAttribute("class")).includes("has-children"));

// ---- the move button ------------------------------------------------------------------------

await row("What protein is").locator("button.move").click();
await page.waitForSelector(".move-picker");
const picker = page.locator(".move-picker");
check("asks where, saying where it is now", (await picker.locator("h2").innerText()) === "Move “What protein is”" && (await picker.innerText()).includes("It is under Protein."));
const places = await picker.locator(".places label").evaluateAll((ls) => ls.map((l) => [l.querySelector("strong").textContent, !l.querySelector("input").disabled]));
check("the top level and every page, in order, itself not open",
  JSON.stringify(places) === JSON.stringify([["The top level", true], ["Protein", true], ["What protein is", false], ["In the body", true], ["How protein is used", true], ["Organs", true], ["Vitamins", true]]), JSON.stringify(places));
check("Move waits for a choice", await picker.getByRole("button", { name: "Move", exact: true }).isDisabled());
await picker.locator(".places label", { hasText: "Organs" }).click();
await picker.getByRole("button", { name: "Move", exact: true }).click();
await page.waitForSelector(".folder-note.moved");
check("the engine is told: this page, under Organs, at the end", (await lastMove()) === JSON.stringify({ document: "what", parent: "organs", position: null }), await lastMove());
check("the tree shows it there", (await tree()) === "Protein\n  In the body\n    How protein is used\n    Organs\n      What protein is\nVitamins", await tree());
check("and says so, with the way back", (await text(".folder-note.moved")).startsWith("Moved “What protein is” under Protein › In the body › Organs. Undo"), await text(".folder-note.moved"));
await page.locator(".folder-note.moved").getByRole("button", { name: "Undo" }).click();
await page.waitForFunction(() => document.querySelector(".folder-note.moved")?.textContent.includes("under Protein."));
check("Undo puts it back exactly where it was, first under Protein", (await tree()) === START && (await lastMove()) === JSON.stringify({ document: "what", parent: "protein", position: 0 }), await tree());

await row("In the body").hover();
await row("In the body").locator("button.move").click();
await page.waitForSelector(".move-picker");
const bodyPlaces = await page.locator(".move-picker .places label").evaluateAll((ls) => ls.map((l) => [l.querySelector("strong").textContent, l.textContent.replace(l.querySelector("strong").textContent, "")]));
check("never under itself or a page under it, nor where it is now",
  JSON.stringify(bodyPlaces) === JSON.stringify([["The top level", ""], ["Protein", "where it is now"], ["What protein is", ""], ["In the body", "the page itself"], ["How protein is used", "under the page being moved"], ["Organs", "under the page being moved"], ["Vitamins", ""]]),
  JSON.stringify(bodyPlaces));
const before = await moves();
await page.locator(".move-picker").getByRole("button", { name: "Cancel" }).click();
check("Cancel moves nothing", (await moves()) === before && (await page.locator(".move-picker").count()) === 0);

// ---- dragging -------------------------------------------------------------------------------

await drag("How protein is used", "Vitamins");
await page.waitForFunction((n) => window.__calls.filter((c) => c.command === "document_move").length > n, before);
check("dropped on the middle of a page, it goes under it", (await lastMove()) === JSON.stringify({ document: "how", parent: "vitamins", position: null }), await lastMove());
await page.waitForFunction(() => document.querySelector(".folder-note.moved")?.textContent.includes("under Vitamins"));
check("and the tree follows", (await tree()).endsWith("Vitamins\n  How protein is used"), await tree());

let n = await moves();
await drag("Vitamins", "Protein", "top");
await page.waitForFunction((n) => window.__calls.filter((c) => c.command === "document_move").length > n, n);
check("dropped on a page's top edge, it goes before it, among its siblings", (await lastMove()) === JSON.stringify({ document: "vitamins", parent: null, position: 0 }), await lastMove());
check("first at the top level now", (await tree()).startsWith("Vitamins\n  How protein is used\nProtein"), await tree());
await page.waitForFunction(() => document.querySelector(".folder-note.moved")?.textContent.includes("among the pages beside it"));

n = await moves();
await drag("What protein is", "In the body", "bottom");
await page.waitForFunction((n) => window.__calls.filter((c) => c.command === "document_move").length > n, n);
check("dropped on a page's bottom edge, it goes after it", (await lastMove()) === JSON.stringify({ document: "what", parent: "protein", position: 1 }), await lastMove());
check("after In the body now", (await tree()).includes("Protein\n  In the body\n    Organs\n  What protein is"), await tree());

n = await moves();
await drag("Protein", "Organs");
await page.waitForTimeout(300);
check("a page dragged under a page under it is not moved", (await moves()) === n);

// The highlight answers before letting go.
const lit = await page.evaluate(async () => {
  const rowOf = (title) => [...document.querySelectorAll(".page-row")].find((r) => r.querySelector(".name").textContent === title);
  const data = new DataTransfer();
  const source = rowOf("Organs");
  source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
  await new Promise((r) => setTimeout(r, 50));
  const over = async (element, at) => {
    const box = element.getBoundingClientRect();
    element.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data, clientX: box.left + 30, clientY: box.top + box.height * at }));
    await new Promise((r) => setTimeout(r, 50));
  };
  await over(rowOf("Vitamins"), 0.5);
  const under = rowOf("Vitamins").classList.contains("drop-target");
  await over(rowOf("Vitamins"), 0.05);
  const beforeLine = rowOf("Vitamins").classList.contains("drop-before");
  await over(rowOf("In the body"), 0.5);
  const same = rowOf("In the body").classList.contains("drop-target");
  await over(document.querySelector(".tree-head"), 0.5);
  const heading = document.querySelector(".tree-head").classList.contains("drop-target");
  source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: data }));
  return { under, beforeLine, same, heading };
});
check("dragging: a page that would take it lights up, an edge shows a line, where it already is does not, the heading does",
  lit.under && lit.beforeLine && !lit.same && lit.heading, JSON.stringify(lit));

n = await moves();
await row("Organs").dragTo(page.locator(".tree-head"));
await page.waitForFunction((n) => window.__calls.filter((c) => c.command === "document_move").length > n, n);
check("dropped on the heading, it goes to the end of the top level", (await lastMove()) === JSON.stringify({ document: "organs", parent: null, position: null }), await lastMove());
await page.waitForFunction(() => document.querySelector(".folder-note.moved")?.textContent.includes("to the top level"));
check("and is said to have", (await text(".folder-note.moved")).startsWith("Moved “Organs” to the top level."));

// ---- the keyboard ---------------------------------------------------------------------------

await row("How protein is used").locator(".name").focus();
await page.keyboard.press("Control+x");
check("Ctrl+X picks it up, and says how to put it down", (await text(".holding")).startsWith("Moving “How protein is used”.") && (await row("How protein is used").getAttribute("class")).includes("held"));
await row("Vitamins").locator(".name").focus();
await page.keyboard.press("Control+v");
check("Ctrl+V on where it already is refuses, and says why", (await text(".holding")).includes("It cannot go there: where it is now."));
n = await moves();
await row("Protein").locator(".name").focus();
await page.keyboard.press("Control+v");
await page.waitForFunction((n) => window.__calls.filter((c) => c.command === "document_move").length > n, n);
check("Ctrl+V on another page puts it under that page", (await lastMove()) === JSON.stringify({ document: "how", parent: "protein", position: null }) && (await page.locator(".holding").count()) === 0, await lastMove());

await row("Organs").locator(".name").focus();
await page.keyboard.press("Control+c");
check("Ctrl+C picks up as well", (await text(".holding")).startsWith("Moving “Organs”."));
await page.keyboard.press("Escape");
check("and Esc puts it down where it was", (await page.locator(".holding").count()) === 0);

// Alt+↑ / Alt+↓: one place among its siblings.
n = await moves();
await row("In the body").locator(".name").focus();
await page.keyboard.press("Alt+ArrowDown");
await page.waitForFunction((n) => window.__calls.filter((c) => c.command === "document_move").length > n, n);
check("Alt+↓ moves it one place down among its siblings", (await lastMove()) === JSON.stringify({ document: "body", parent: "protein", position: 1 }), await lastMove());
check("and the tree follows", (await tree()).includes("Protein\n  What protein is\n  In the body"), await tree());
n = await moves();
await row("Vitamins").locator(".name").focus();
await page.keyboard.press("Alt+ArrowUp");
await page.waitForTimeout(300);
check("Alt+↑ at the top of its level does nothing", (await moves()) === n);

// Typing a new name: Ctrl+C there is copying text, nothing else.
await row("Vitamins").locator(".name").dblclick();
await page.waitForSelector(".tree .rename-input");
await page.keyboard.press("Control+c");
check("Ctrl+C while renaming is left to the text box", (await page.locator(".holding").count()) === 0);
await page.keyboard.press("Escape");

// ---- the open page --------------------------------------------------------------------------

await row("What protein is").locator(".name").click();
await page.waitForSelector(".prose .ProseMirror");
await page.locator(".prose .ProseMirror").click();
await page.keyboard.press("End");
await page.keyboard.type(" Typed just before moving.");
await row("What protein is").hover();
await row("What protein is").locator("button.move").click();
await page.locator(".move-picker .places label", { hasText: "Vitamins" }).click();
await page.locator(".move-picker").getByRole("button", { name: "Move", exact: true }).click();
await page.waitForFunction(() => document.querySelector(".folder-note.moved")?.textContent.includes("What protein is"));
const sequence = await page.evaluate(() => window.__calls.map((c) => c.command).filter((c) => c === "document_write" || c === "document_move"));
const written = (await calls("document_write")).at(-1)?.args?.body ?? "";
check("the open page's last words are saved before it moves", sequence.lastIndexOf("document_write") !== -1 && sequence.lastIndexOf("document_write") < sequence.lastIndexOf("document_move") && written.includes("Typed just before moving."), JSON.stringify({ sequence, written }));
await page.waitForTimeout(800);
check("and it stays open, still saving, with nothing said about a conflict", (await page.locator(".editor .state").innerText()) === "Saved" && (await page.locator(".editor .warning, .editor .error").count()) === 0);

if (process.argv[2]) {
  await row("In the body").hover();
  await page.screenshot({ path: `${process.argv[2]}-tree.png`, clip: { x: 0, y: 0, width: 330, height: 420 } });
}

await browser.close();
finish();

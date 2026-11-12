// Deleting pages, in a real browser with a stub engine behind it.
//
// What is being checked is mostly what must NOT happen: nothing deleted before the person has
// seen what goes, nothing deleted without an explicit answer about the pages under it, and the
// editor never left showing a page that no longer exists.

import { check, finish, launch, URL } from "../support.mjs";

const NUTRITION = "01J8ZQ6A1M3P5R7T9V1X3Z5B70";
const PROTEIN = "01J8ZQ6A1M3P5R7T9V1X3Z5B71";
const SCRATCH = "01J8ZQ6A1M3P5R7T9V1X3Z5B72";
const DOC_A = "01J8ZQ7B2N4Q6S8W0W2Y4A6C80";
const DOC_B = "01J8ZQ7B2N4Q6S8W0W2Y4A6C81";
const DOC_C = "01J8ZQ7B2N4Q6S8W0W2Y4A6C82";

const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript((ids) => {
  const { NUTRITION, PROTEIN, SCRATCH, DOC_A, DOC_B, DOC_C } = ids;
  const calls = [];
  window.__calls = calls;

  // Nutrition ─ Eating well
  //           └ Protein ─ What protein is
  //                     └ Types of protein
  // Scratch
  const pages = {
    [NUTRITION]: { title: "Nutrition", parent: null },
    [DOC_C]: { title: "Eating well", parent: NUTRITION },
    [PROTEIN]: { title: "Protein", parent: NUTRITION },
    [DOC_A]: { title: "What protein is", parent: PROTEIN },
    [DOC_B]: { title: "Types of protein", parent: PROTEIN },
    [SCRATCH]: { title: "Scratch", parent: null },
  };
  const order = Object.keys(pages);
  const children = (parent) => order.filter((id) => pages[id] && pages[id].parent === parent);
  const tree = (parent) => children(parent).map((id) => ({ id, title: pages[id].title, children: tree(id) }));
  const under = (id) => children(id).flatMap((k) => [k, ...under(k)]);

  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      calls.push({ command, args });
      switch (command) {
        case "plugin:dialog|open":
          return "/home/user/Learning";
        case "library_open":
        case "library_status":
          return { name: "Learning", documents: Object.keys(pages).length, works: 0, writable: true, problems: [] };
        case "page_tree":
          return tree(null);
        case "document_read": {
          const d = pages[args.document];
          if (!d) throw { kind: "NotFound", message: "no such page" };
          return { id: args.document, title: d.title, parent: d.parent, body: `${d.title}.`, revision: "1", modified: "2026-09-01T00:00:00Z" };
        }
        case "document_backlinks":
          // "Types of protein" is linked to by "What protein is".
          return args.document === DOC_B ? [{ id: DOC_A, title: "What protein is" }] : [];
        case "document_delete_plan":
          return { pages: under(args.document).map((id) => ({ id, title: pages[id].title })) };
        case "document_delete": {
          const parent = pages[args.document].parent;
          if (args.contents === "move-up") {
            // Into its place, in its order: the engine's MoveUp.
            const at = order.indexOf(args.document);
            const lifted = children(args.document);
            for (const id of lifted) {
              pages[id].parent = parent;
              order.splice(order.indexOf(id), 1);
            }
            order.splice(at + 1, 0, ...lifted);
          } else {
            for (const id of under(args.document)) delete pages[id];
          }
          delete pages[args.document];
          return null;
        }
        default:
          return null;
      }
    },
  };
}, { NUTRITION, PROTEIN, SCRATCH, DOC_A, DOC_B, DOC_C });

const deletes = () => page.evaluate(() => window.__calls.filter((c) => c.command === "document_delete"));
const row = (title) => page.locator(".page-row", { has: page.locator(".name", { hasText: new RegExp(`^${title}$`) }) });
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

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.waitForSelector(".tree");

// ---- a page with nothing under it, and what links to it ----------------------------------

await row("Types of protein").locator(".name").click();
await page.waitForSelector(".prose .ProseMirror");

await row("Types of protein").hover();
await row("Types of protein").locator("button.delete").click();
await page.waitForSelector(".delete-confirm");

check("asking to delete deletes nothing yet", (await deletes()).length === 0);
const said = await page.locator(".delete-confirm").innerText();
check("it names what links to the page", said.includes("What protein is"), said);
check("and says what becomes of its pictures", said.includes("pictures"));
check("and asks nothing about pages under it, having none", !said.includes("What should happen to them"), said);

await page.getByRole("button", { name: "Keep it" }).click();
check("keeping it deletes nothing", (await deletes()).length === 0);
check("and puts the page back on screen", (await page.locator(".editor h2").innerText()).includes("Types of protein"));

await row("Types of protein").hover();
await row("Types of protein").locator("button.delete").click();
await page.waitForSelector(".delete-confirm");
await page.getByRole("button", { name: "Delete", exact: true }).click();
await page.waitForFunction(() => !window.document.querySelector(".delete-confirm"));

check("deleting it removes it from the tree", (await row("Types of protein").count()) === 0);
check("and the editor does not go on showing it", (await page.locator(".prose .ProseMirror").count()) === 0, "the deleted page is still on screen");
check("with nothing under it, nothing was asked: either answer does the same", (await deletes()).at(-1)?.args?.contents === "delete");

// ---- a page with pages under it -----------------------------------------------------------

await row("What protein is").locator(".name").click();
await page.waitForSelector(".prose .ProseMirror");

await row("Nutrition").hover();
await row("Nutrition").locator("button.delete").click();
await page.waitForSelector(".delete-confirm");

const text = await page.locator(".delete-confirm").innerText();
check("it names every page under it, however deep", ["Eating well", "Protein", "What protein is"].every((t) => text.includes(t)), text);
check("with keeping them as the answer already chosen", await page.locator('.delete-confirm input[type="radio"]').first().isChecked());

await page.getByText("Delete them too").click();
check("deleting them too is a choice you make", await page.locator('.delete-confirm input[type="radio"]').nth(1).isChecked());
await page.getByRole("button", { name: "Keep it" }).click();
check("and changing your mind still deletes nothing", (await deletes()).filter((c) => c.args.document === NUTRITION).length === 0);

await row("Nutrition").hover();
await row("Nutrition").locator("button.delete").click();
await page.waitForSelector(".delete-confirm");
await page.getByRole("button", { name: "Delete", exact: true }).click();
await page.waitForFunction(() => !window.document.querySelector(".delete-confirm"));

const sent = (await deletes()).at(-1);
check("what was chosen is what was sent", sent?.args?.contents === "move-up", JSON.stringify(sent));
check("the pages under it move up into its place, each with its own pages", (await tree()) === "Eating well\nProtein\n  What protein is\nScratch", await tree());
check("and the open page stays open, because it still exists", (await page.locator(".editor h2").innerText()).includes("What protein is"));

await browser.close();
finish();

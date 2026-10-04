// Moving topics and documents, three ways: the move button and its question, dragging onto a
// topic or the heading, and Ctrl+X / Ctrl+V — each against a mock engine whose tree really
// changes, so what the sidebar shows afterwards is what the engine was told.

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
  const topics = {
    protein: { id: "protein", name: "Protein", parent: null },
    body: { id: "body", name: "In the body", parent: "protein" },
    organs: { id: "organs", name: "Organs", parent: "body" },
    vitamins: { id: "vitamins", name: "Vitamins", parent: null },
  };
  const docs = {
    what: { id: "what", title: "What protein is", topic: "protein", body: "Protein is built from amino acids." },
    how: { id: "how", title: "How protein is used", topic: "body", body: "Tissue repair." },
  };
  let revision = 1;
  const tree = (parent) =>
    Object.values(topics)
      .filter((t) => t.parent === parent)
      .map((t) => ({
        id: t.id,
        name: t.name,
        documents: Object.values(docs).filter((d) => d.topic === t.id).map((d) => ({ id: d.id, title: d.title })),
        children: tree(t.id),
      }));
  const doc = (id) => ({ ...docs[id], revision: String(revision), modified: "2026-10-03T00:00:00Z" });
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 0,
    invoke: async (command, args) => {
      window.__calls.push({ command, args: args ?? {} });
      switch (command) {
        case "recent_libraries":
          return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", topics: 4, documents: 2, writable: true, problems: [] };
        case "topic_tree":
          return tree(null);
        case "document_read":
          return doc(args.document);
        case "document_write":
          docs[args.document].body = args.body;
          revision += 1;
          return doc(args.document);
        case "document_move":
          docs[args.document].topic = args.topic;
          return doc(args.document);
        case "topic_move": {
          // The engine's own refusal, so a guard that let one through would be seen.
          let up = args.parent;
          while (up) {
            if (up === args.topic) throw { kind: "Invalid", message: "a topic cannot be moved inside itself" };
            up = topics[up].parent;
          }
          topics[args.topic].parent = args.parent;
          return null;
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
const tree = () =>
  page.evaluate(() => {
    const lines = [];
    const walk = (ul, depth) => {
      for (const li of ul.children) {
        if (li.classList.contains("branch")) {
          lines.push(`${"  ".repeat(depth)}${li.querySelector(":scope > .branch-head .name").textContent}`);
          walk(li.querySelector(":scope > ul"), depth + 1);
        } else if (li.classList.contains("doc-row")) {
          lines.push(`${"  ".repeat(depth)}- ${li.querySelector(".name").textContent}`);
        }
      }
    };
    walk(document.querySelector(".tree > ul"), 0);
    return lines.join("\n");
  });
/** The text of the first match, or "" when there is none — so a missing element fails a check
 * rather than stopping the run. */
const text = async (selector) => ((await page.locator(selector).count()) ? page.locator(selector).first().innerText() : "");
const head = (name) => page.locator(".branch-head", { has: page.locator(".name", { hasText: new RegExp(`^${name}$`) }) });
const row = (title) => page.locator(".doc-row", { hasText: title });

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree .branch");

const START = "Protein\n  - What protein is\n  In the body\n    - How protein is used\n    Organs\nVitamins";
check("the tree as the engine has it", (await tree()) === START, await tree());

// ---- the move button --------------------------------------------------------------------

await row("What protein is").hover();
const docButtons = await row("What protein is").locator("button").evaluateAll((bs) => bs.map((b) => b.title || b.textContent));
check("a document's row: rename, then move, then delete",
  JSON.stringify(docButtons.slice(1)) === JSON.stringify(["Rename this document", "Move this document", "Delete this document"]), JSON.stringify(docButtons));
check("the move arrows show on hover", (await row("What protein is").locator("button.move").evaluate((b) => getComputedStyle(b).opacity)) === "1");
const order = await row("What protein is").locator("button.pencil, button.move, button.delete").evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().left)));
check("and sit between the pencil and the bin, apart", order[0] < order[1] && order[1] < order[2] && order[1] - order[0] >= 18 && order[2] - order[1] >= 18, JSON.stringify(order));

await head("Protein").hover();
const topicButtons = await head("Protein").locator(".branch-actions button").evaluateAll((bs) => bs.map((b) => b.title));
check("a topic's row: new document, nested topic, move, delete",
  JSON.stringify(topicButtons) === JSON.stringify(["New document", "Nested topic", "Move this topic", "Delete this topic"]), JSON.stringify(topicButtons));

await row("What protein is").hover();
await row("What protein is").locator("button.move").click();
await page.waitForSelector(".move-picker");
const picker = page.locator(".move-picker");
check("asks where, saying where it is now", (await picker.locator("h2").innerText()) === "Move “What protein is”" && (await picker.innerText()).includes("It is in Protein."));
const places = await picker.locator(".places label").evaluateAll((ls) => ls.map((l) => [l.querySelector("strong").textContent, !l.querySelector("input").disabled]));
check("every topic, in order, where it is now not open",
  JSON.stringify(places) === JSON.stringify([["Protein", false], ["In the body", true], ["Organs", true], ["Vitamins", true]]), JSON.stringify(places));
check("Move waits for a choice", await picker.getByRole("button", { name: "Move", exact: true }).isDisabled());
await picker.locator(".places label", { hasText: "Organs" }).click();
await picker.getByRole("button", { name: "Move", exact: true }).click();
await page.waitForSelector(".folder-note.moved");
check("the engine is told: this document, into Organs", JSON.stringify((await calls("document_move")).at(-1)?.args) === JSON.stringify({ document: "what", topic: "organs" }));
check("the tree shows it there", (await tree()) === "Protein\n  In the body\n    - How protein is used\n    Organs\n      - What protein is\nVitamins", await tree());
check("and says so, with the way back", (await text(".folder-note.moved")).startsWith("Moved “What protein is” into Protein › In the body › Organs. Undo"),
  await page.locator(".folder-note.moved").innerText());
await page.locator(".folder-note.moved").getByRole("button", { name: "Undo" }).click();
await page.waitForFunction(() => document.querySelector(".folder-note.moved")?.textContent.includes("into Protein."));
check("Undo puts it back", (await tree()) === START && JSON.stringify((await calls("document_move")).at(-1)?.args) === JSON.stringify({ document: "what", topic: "protein" }), await tree());

// A topic: the top level is on offer; itself and what is inside it are not.
await head("In the body").hover();
await head("In the body").locator("button.move").click();
await page.waitForSelector(".move-picker");
const topicPlaces = await page.locator(".move-picker .places label").evaluateAll((ls) => ls.map((l) => [l.querySelector("strong").textContent, !l.querySelector("input").disabled, l.textContent.replace(l.querySelector("strong").textContent, "")]));
check("a topic is offered the top level first, never itself or what is inside it",
  JSON.stringify(topicPlaces) === JSON.stringify([["The top level", true, ""], ["Protein", false, "where it is now"], ["In the body", false, "the topic itself"], ["Organs", false, "inside the topic being moved"], ["Vitamins", true, ""]]),
  JSON.stringify(topicPlaces));
await page.locator(".move-picker").getByRole("button", { name: "Cancel" }).click();
check("Cancel moves nothing", (await calls("topic_move")).length === 0 && (await page.locator(".move-picker").count()) === 0);

// ---- dragging ---------------------------------------------------------------------------

await row("How protein is used").dragTo(head("Vitamins"));
await page.waitForFunction(() => window.__calls.filter((c) => c.command === "document_move").length >= 3);
check("a document dragged onto a topic goes into it", JSON.stringify((await calls("document_move")).at(-1)?.args) === JSON.stringify({ document: "how", topic: "vitamins" }), JSON.stringify(await calls("document_move")));
await page.waitForFunction(() => document.querySelector(".folder-note.moved")?.textContent.includes("into Vitamins"));
check("and the tree follows", (await tree()).endsWith("Vitamins\n  - How protein is used"), await tree());

// Dropped among a topic's documents counts as dropped on that topic.
await row("How protein is used").dragTo(row("What protein is"));
await page.waitForFunction(() => window.__calls.filter((c) => c.command === "document_move").length >= 4);
check("dropped on a document, it joins that document's topic", JSON.stringify((await calls("document_move")).at(-1)?.args) === JSON.stringify({ document: "how", topic: "protein" }));

// A topic dragged into itself, or into what is inside it, goes nowhere.
const before = (await calls("topic_move")).length;
await head("Protein").dragTo(head("Organs"));
await page.waitForTimeout(300);
check("a topic dragged into a topic inside it is not moved", (await calls("topic_move")).length === before, JSON.stringify(await calls("topic_move")));

// The highlight answers before letting go.
const lit = await page.evaluate(async () => {
  const source = [...document.querySelectorAll(".branch-head")].find((h) => h.querySelector(".name").textContent === "Organs");
  const into = (name) => [...document.querySelectorAll(".branch-head")].find((h) => h.querySelector(".name").textContent === name);
  const data = new DataTransfer();
  source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
  await new Promise((r) => setTimeout(r, 50));
  into("Vitamins").dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
  await new Promise((r) => setTimeout(r, 50));
  const good = into("Vitamins").classList.contains("drop-target");
  into("In the body").dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
  await new Promise((r) => setTimeout(r, 50));
  const same = into("In the body").classList.contains("drop-target");
  const top = document.querySelector(".tree-head");
  top.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
  await new Promise((r) => setTimeout(r, 50));
  const heading = top.classList.contains("drop-target");
  source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: data }));
  return { good, same, heading };
});
check("dragging, a topic that would take it lights up, where it already is does not, and the heading does for the top level",
  lit.good && !lit.same && lit.heading, JSON.stringify(lit));

await head("Organs").dragTo(page.locator(".tree-head"));
await page.waitForFunction(() => window.__calls.filter((c) => c.command === "topic_move").length >= 1);
check("a topic dragged onto the heading goes to the top level", JSON.stringify((await calls("topic_move")).at(-1)?.args) === JSON.stringify({ topic: "organs", parent: null }));
await page.waitForFunction(() => document.querySelector(".folder-note.moved")?.textContent.includes("to the top level"));
check("and is said to have", (await text(".folder-note.moved")).startsWith("Moved “Organs” to the top level."));

// ---- the keyboard -----------------------------------------------------------------------

await row("How protein is used").locator(".name").focus();
await page.keyboard.press("Control+x");
check("Ctrl+X picks it up, and says how to put it down", (await text(".holding")).startsWith("Moving “How protein is used”.") && (await row("How protein is used").getAttribute("class")).includes("held"));
await head("Protein").locator(".name").focus();
await page.keyboard.press("Control+v");
check("Ctrl+V on where it already is refuses, and says why", (await text(".holding")).includes("It cannot go there: where it is now."));
await page.waitForTimeout(200);
check("and the engine is not asked", (await calls("document_move")).length === 4, JSON.stringify(await calls("document_move")));
await head("Vitamins").locator(".name").focus();
await page.keyboard.press("Control+v");
await page.waitForFunction(() => window.__calls.filter((c) => c.command === "document_move").length >= 5);
check("Ctrl+V on another topic puts it there", JSON.stringify((await calls("document_move")).at(-1)?.args) === JSON.stringify({ document: "how", topic: "vitamins" }) && (await page.locator(".holding").count()) === 0);

await head("Organs").locator(".name").focus();
await page.keyboard.press("Control+c");
check("Ctrl+C picks up as well", (await text(".holding")).startsWith("Moving “Organs”."));
await page.keyboard.press("Escape");
check("and Esc puts it down where it was", (await page.locator(".holding").count()) === 0);

await head("Organs").locator(".name").focus();
await page.keyboard.press("Control+c");
await row("What protein is").locator(".name").focus();
await page.keyboard.press("Control+v");
await page.waitForFunction(() => window.__calls.filter((c) => c.command === "topic_move").length >= 2);
check("pasted on a document, a topic goes into that document's topic", JSON.stringify((await calls("topic_move")).at(-1)?.args) === JSON.stringify({ topic: "organs", parent: "protein" }));

// Typing a new name: Ctrl+C there is copying text, nothing else.
await head("Vitamins").locator(".name").dblclick();
await page.waitForSelector(".tree .rename-input");
await page.keyboard.press("Control+c");
check("Ctrl+C while renaming is left to the text box", (await page.locator(".holding").count()) === 0);
await page.keyboard.press("Escape");

// ---- the open document ------------------------------------------------------------------

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
const lastWrite = sequence.lastIndexOf("document_write");
const lastMove = sequence.lastIndexOf("document_move");
const written = (await calls("document_write")).at(-1)?.args?.body ?? "";
check("the open document's last words are saved before it moves", lastWrite !== -1 && lastWrite < lastMove && written.includes("Typed just before moving."), JSON.stringify({ sequence, written }));
await page.waitForTimeout(800);
check("and it stays open, still saving, with nothing said about a conflict", (await page.locator(".editor .state").innerText()) === "Saved" && (await page.locator(".editor .warning, .editor .error").count()) === 0);

await page.locator(".prose .ProseMirror").click();
await page.keyboard.press("End");
await page.keyboard.type(" Typed, then dragged.");
await row("What protein is").dragTo(head("Protein"));
await page.waitForFunction(() => document.querySelector(".folder-note.moved")?.textContent.includes("into Protein."));
const dragged = await page.evaluate(() => window.__calls.map((c) => c.command).filter((c) => c === "document_write" || c === "document_move"));
const draggedBody = (await calls("document_write")).at(-1)?.args?.body ?? "";
check("dragged straight after typing, the words are saved before the move too",
  dragged.lastIndexOf("document_write") < dragged.lastIndexOf("document_move") && draggedBody.includes("Typed, then dragged."), JSON.stringify({ dragged, draggedBody }));

if (process.argv[2]) {
  await row("What protein is").hover();
  await page.screenshot({ path: `${process.argv[2]}-tree.png`, clip: { x: 0, y: 0, width: 330, height: 420 } });
  await row("What protein is").locator("button.move").click();
  await page.screenshot({ path: `${process.argv[2]}-picker.png` });
}

await browser.close();
finish();

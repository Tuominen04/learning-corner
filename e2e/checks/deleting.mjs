// Deleting documents and topics, in a real browser with a stub engine behind it.
//
// What is being checked is mostly what must NOT happen: nothing deleted before the person has
// seen what goes, nothing deleted without an explicit answer about a topic's contents, and the
// editor never left showing a document that no longer exists.

import { check, finish, launch, URL } from "../support.mjs";

const NUTRITION = "01J8ZQ6A1M3P5R7T9V1X3Z5B70";
const PROTEIN = "01J8ZQ6A1M3P5R7T9V1X3Z5B71";
const EMPTY = "01J8ZQ6A1M3P5R7T9V1X3Z5B72";
const DOC_A = "01J8ZQ7B2N4Q6S8W0W2Y4A6C80";
const DOC_B = "01J8ZQ7B2N4Q6S8W0W2Y4A6C81";
const DOC_C = "01J8ZQ7B2N4Q6S8W0W2Y4A6C82";

const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript((ids) => {
  const { NUTRITION, PROTEIN, EMPTY, DOC_A, DOC_B, DOC_C } = ids;
  const calls = [];
  window.__calls = calls;

  // A small library the stub mutates the way the engine would.
  const docs = {
    [DOC_A]: { title: "What protein is", topic: PROTEIN },
    [DOC_B]: { title: "Types of protein", topic: PROTEIN },
    [DOC_C]: { title: "Eating well", topic: NUTRITION },
  };
  const topics = {
    [NUTRITION]: { name: "Nutrition", parent: null },
    [PROTEIN]: { name: "Protein", parent: NUTRITION },
    [EMPTY]: { name: "Scratch", parent: null },
  };

  const tree = (parent) =>
    Object.entries(topics)
      .filter(([, t]) => t.parent === parent)
      .map(([id, t]) => ({
        id,
        name: t.name,
        documents: Object.entries(docs)
          .filter(([, d]) => d.topic === id)
          .map(([docId, d]) => ({ id: docId, title: d.title })),
        children: tree(id),
      }));

  const under = (id) => {
    const kids = Object.entries(topics).filter(([, t]) => t.parent === id).map(([k]) => k);
    return [id, ...kids.flatMap(under)];
  };

  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      calls.push({ command, args });
      switch (command) {
        case "plugin:dialog|open":
          return "/home/user/Learning";
        case "library_open":
        case "library_status":
          return {
            name: "Learning",
            topics: Object.keys(topics).length,
            documents: Object.keys(docs).length,
            writable: true,
            problems: [],
          };
        case "topic_tree":
          return tree(null);
        case "document_read": {
          const d = docs[args.document];
          if (!d) throw { kind: "NotFound", message: "no such document" };
          return {
            id: args.document,
            title: d.title,
            topic: d.topic,
            body: `${d.title}.`,
            revision: "1",
            modified: "2026-09-01T00:00:00Z",
          };
        }
        case "document_backlinks":
          // "Types of protein" is linked to by "What protein is".
          return args.document === DOC_B ? [{ id: DOC_A, title: "What protein is" }] : [];
        case "document_delete":
          delete docs[args.document];
          return null;
        case "topic_delete_plan": {
          const all = under(args.topic);
          return {
            topics: all.length - 1,
            documents: Object.entries(docs)
              .filter(([, d]) => all.includes(d.topic))
              .map(([id, d]) => ({ id, title: d.title })),
          };
        }
        case "topic_delete": {
          const parent = topics[args.topic].parent;
          if (args.contents === "move-up") {
            for (const d of Object.values(docs)) if (d.topic === args.topic) d.topic = parent;
            for (const t of Object.values(topics)) if (t.parent === args.topic) t.parent = parent;
          } else {
            const all = under(args.topic);
            for (const [id, d] of Object.entries(docs)) if (all.includes(d.topic)) delete docs[id];
            for (const id of all) delete topics[id];
          }
          delete topics[args.topic];
          return null;
        }
        default:
          return null;
      }
    },
  };
}, { NUTRITION, PROTEIN, EMPTY, DOC_A, DOC_B, DOC_C });

const deletes = () =>
  page.evaluate(() =>
    window.__calls.filter((c) => c.command === "document_delete" || c.command === "topic_delete"),
  );

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.waitForSelector(".tree");

// ---- a document, and what links to it -------------------------------------------

await page.getByRole("button", { name: "Types of protein" }).first().click();
await page.waitForSelector(".prose .ProseMirror");

const row = page.locator('.doc-row:has-text("Types of protein")');
await row.hover();
await row.locator("button.delete").click();
await page.waitForSelector(".delete-confirm");

check("asking to delete deletes nothing yet", (await deletes()).length === 0);
check(
  "it names what links to the document",
  (await page.locator(".delete-confirm").innerText()).includes("What protein is"),
  await page.locator(".delete-confirm").innerText(),
);
check(
  "and says what becomes of its pictures",
  (await page.locator(".delete-confirm").innerText()).includes("pictures"),
);

await page.getByRole("button", { name: "Keep it" }).click();
check("keeping it deletes nothing", (await deletes()).length === 0);
check(
  "and puts the document back on screen",
  (await page.locator(".editor h2").innerText()).includes("Types of protein"),
);

await row.hover();
await row.locator("button.delete").click();
await page.waitForSelector(".delete-confirm");
await page.getByRole("button", { name: "Delete", exact: true }).click();
await page.waitForFunction(() => !window.document.querySelector(".delete-confirm"));

check(
  "deleting it removes it from the tree",
  (await page.locator('.doc-row:has-text("Types of protein")').count()) === 0,
);
check(
  "and the editor does not go on showing it",
  (await page.locator(".prose .ProseMirror").count()) === 0,
  "the deleted document is still on screen",
);

// ---- an empty topic -------------------------------------------------------------

const scratch = page.locator('.branch-head:has-text("Scratch")');
await scratch.hover();
await scratch.locator("button.delete").click();
await page.waitForSelector(".delete-confirm");
check(
  "an empty topic says so",
  (await page.locator(".delete-confirm").innerText()).includes("Nothing is in it"),
);
check(
  "and can be deleted without a question about contents it does not have",
  await page.getByRole("button", { name: "Delete", exact: true }).isEnabled(),
);
await page.getByRole("button", { name: "Delete", exact: true }).click();
await page.waitForFunction(() => !window.document.querySelector(".delete-confirm"));

// ---- a topic with writing in it -------------------------------------------------

await page.getByRole("button", { name: "What protein is" }).first().click();
await page.waitForSelector(".prose .ProseMirror");

const protein = page.locator('.branch-head:has-text("Protein")').last();
await protein.hover();
await protein.locator("button.delete").click();
await page.waitForSelector(".delete-confirm");

const text = await page.locator(".delete-confirm").innerText();
check("it names the documents inside", text.includes("What protein is"), text);
check("and offers to move them up into the parent by name", text.includes("Nutrition"), text);
check(
  "with keeping them as the answer already chosen",
  await page.locator('.delete-confirm input[type="radio"]').first().isChecked(),
);

await page.getByRole("button", { name: "Delete", exact: true }).click();
await page.waitForFunction(() => !window.document.querySelector(".delete-confirm"));

const sent = (await deletes()).at(-1);
check(
  "what was chosen is what was sent",
  sent?.args?.contents === "move-up",
  JSON.stringify(sent),
);
check(
  "the document survives, moved up",
  (await page.locator('.doc-row:has-text("What protein is")').count()) === 1,
);
check(
  "and stays open in the editor, because it still exists",
  (await page.locator(".editor h2").innerText()).includes("What protein is"),
);

// ---- a top-level topic, where there is nowhere to move documents up to ---------

const nutrition = page.locator('.branch-head:has-text("Nutrition")');
await nutrition.hover();
await nutrition.locator("button.delete").click();
await page.waitForSelector(".delete-confirm");

check(
  "keeping them is offered but not possible, and says why",
  (await page.locator(".choice.unavailable").innerText()).includes("top level"),
);
check(
  "nothing is chosen for you when the only answer deletes writing",
  await page.getByRole("button", { name: "Delete", exact: true }).isDisabled(),
);

await page.getByText("Delete them too").click();
check(
  "choosing it explicitly is what enables the button",
  await page.getByRole("button", { name: "Delete", exact: true }).isEnabled(),
);
await page.getByRole("button", { name: "Keep it" }).click();
check(
  "and changing your mind still deletes nothing",
  (await deletes()).filter((c) => c.args.topic === NUTRITION).length === 0,
);

await browser.close();

finish();

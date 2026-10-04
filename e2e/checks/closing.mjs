// Closing the window straight after typing: the words go to disk before the interface tells
// the shell it may close. The stub stands in for Tauri's event channel, so the shell's
// "save-before-close" can be sent the way the real one sends it.

import { check, finish, launch, URL } from "../support.mjs";

const ALPHA = "01J8ZQ7B2N4Q6S8W0W2Y4A6C80";

const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript((ALPHA) => {
  const calls = [];
  window.__calls = calls;
  const callbacks = {};
  window.__listeners = {};
  let next = 1;
  // What the real runtime provides for stopping a listener.
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  window.__TAURI_INTERNALS__ = {
    transformCallback: (callback) => {
      const id = next++;
      callbacks[id] = callback;
      return id;
    },
    invoke: async (command, args) => {
      calls.push({ command, args: args ?? {} });
      switch (command) {
        case "plugin:event|listen":
          window.__listeners[args.event] = callbacks[args.handler];
          return next++;
        case "recent_libraries":
          return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", topics: 1, documents: 1, writable: true, problems: [] };
        case "topic_tree":
          return [{ id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", name: "Protein", children: [], documents: [{ id: ALPHA, title: "Alpha" }] }];
        case "document_read":
          return { id: ALPHA, title: "Alpha", topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", body: "First document.", revision: "1", modified: "2026-09-01T00:00:00Z" };
        case "document_write":
          await new Promise((done) => setTimeout(done, 80));
          return { id: ALPHA, title: "Alpha", topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", body: args.body, revision: "2", modified: "2026-09-01T00:00:00Z" };
        case "document_backlinks":
          return [];
        default:
          return null;
      }
    },
  };
}, ALPHA);

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");
check(
  "the interface listens for the window closing",
  await page.evaluate(() => typeof window.__listeners["save-before-close"] === "function"),
);

await page.getByRole("button", { name: "Alpha" }).first().click();
await page.waitForSelector(".prose .ProseMirror");
await page.locator(".prose .ProseMirror").click();
await page.keyboard.press("Control+End");
await page.keyboard.type(" WORDS BEFORE CLOSING");

// The close button, at once — well inside the pause the editor waits for.
await page.evaluate(() =>
  window.__listeners["save-before-close"]({ event: "save-before-close", id: 1, payload: null }),
);
await page.waitForFunction(
  () => window.__calls.some((c) => c.command === "ready_to_close"),
  null,
  { timeout: 5000 },
).catch(() => {});

const order = await page.evaluate(() => window.__calls.map((c) => c.command));
const writes = await page.evaluate(() =>
  window.__calls.filter((c) => c.command === "document_write").map((c) => c.args.body),
);
check(
  "closing writes what was just typed",
  writes.some((body) => body.includes("WORDS BEFORE CLOSING")),
  JSON.stringify(writes),
);
check(
  "and only then tells the shell it may close",
  order.lastIndexOf("document_write") !== -1 &&
    order.indexOf("ready_to_close") > order.lastIndexOf("document_write"),
  JSON.stringify(order),
);

await browser.close();
finish();

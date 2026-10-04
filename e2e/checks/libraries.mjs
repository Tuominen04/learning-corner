// Starting, switching libraries, and the list of the ones opened before — in a real browser,
// with a stub shell behind it that keeps its recent list the way the real one does.
//
// The checks that matter most are about order: the last words typed must be on disk before
// the library they belong to is closed, and a save that lands late must not drag somebody back
// to a document they had left.

import { check, finish, launch, URL } from "../support.mjs";

const LEARNING = "/home/you/Learning";
const RUSSIAN = "/home/you/Documents/Russian";
const USB = "/run/media/you/USB/Old notes";

const ALPHA = "01J8ZQ7B2N4Q6S8W0W2Y4A6C80";
const BETA = "01J8ZQ7B2N4Q6S8W0W2Y4A6C81";
const VERBS = "01J8ZQ7B2N4Q6S8W0W2Y4A6C82";

const browser = await launch();

/** A fresh window over a stub shell that starts with `recent` as its list. */
async function start(recent, { failOpen = null } = {}) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => check("no page errors", false, e.message));
  await page.addInitScript(
    ({ recent, failOpen, ids }) => {
      const { ALPHA, BETA, VERBS } = ids;
      const calls = [];
      window.__calls = calls;
      window.__failWrites = false;
      let list = recent.map((r) => ({ ...r }));
      let open = null;

      const libraries = {
        "/home/you/Learning": {
          name: "Learning",
          tree: [
            {
              id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70",
              name: "Protein",
              children: [],
              documents: [
                { id: ALPHA, title: "Alpha" },
                { id: BETA, title: "Beta" },
              ],
            },
          ],
        },
        "/home/you/Documents/Russian": {
          name: "Russian",
          tree: [
            {
              id: "01J8ZQ6A1M3P5R7T9V1X3Z5B71",
              name: "Verbs",
              children: [],
              documents: [{ id: VERBS, title: "Verbs of motion" }],
            },
          ],
        },
      };
      const bodies = { [ALPHA]: "First document.", [BETA]: "Second document.", [VERBS]: "Идти." };
      const titles = { [ALPHA]: "Alpha", [BETA]: "Beta", [VERBS]: "Verbs of motion" };
      let revision = 1;

      const status = (path) => ({
        path,
        name: libraries[path].name,
        topics: 1,
        documents: libraries[path].tree[0].documents.length,
        writable: true,
        problems: [],
      });

      window.__TAURI_INTERNALS__ = {
        invoke: async (command, args) => {
          calls.push({ command, args: args ?? {} });
          switch (command) {
            case "recent_libraries":
              return list.map((r) => ({ ...r }));
            case "forget_library":
              list = list.filter((r) => r.path !== args.path);
              return null;
            case "library_open": {
              if (failOpen && args.path === failOpen.path) throw failOpen.error;
              if (!libraries[args.path]) {
                throw { kind: "LibraryError", message: `${args.path} is not a library: no library.toml` };
              }
              open = args.path;
              const was = list.find((r) => r.path === args.path);
              list = [
                { path: args.path, name: libraries[args.path].name, opened: new Date().toISOString(), found: true },
                ...list.filter((r) => r !== was),
              ];
              return status(args.path);
            }
            case "library_close":
              open = null;
              return null;
            case "library_status":
              if (!open) throw { kind: "LibraryNotOpen", message: "no library is open" };
              return status(open);
            case "topic_tree":
              if (!open) throw { kind: "LibraryNotOpen", message: "no library is open" };
              return libraries[open].tree;
            case "document_read":
              if (!open) throw { kind: "LibraryNotOpen", message: "no library is open" };
              return {
                id: args.document,
                title: titles[args.document],
                topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B70",
                body: bodies[args.document],
                revision: String(revision),
                modified: "2026-09-01T00:00:00Z",
              };
            case "document_write":
              // Slow enough that anything racing it has room to.
              await new Promise((done) => setTimeout(done, 80));
              if (!open) throw { kind: "LibraryNotOpen", message: "no library is open" };
              if (window.__failWrites) throw { kind: "Io", message: "the drive has gone" };
              bodies[args.document] = args.body;
              revision += 1;
              return {
                id: args.document,
                title: titles[args.document],
                topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B70",
                body: args.body,
                revision: String(revision),
                modified: "2026-09-01T00:00:00Z",
              };
            case "document_backlinks":
              return [];
            default:
              return null;
          }
        },
      };
    },
    { recent, failOpen, ids: { ALPHA, BETA, VERBS } },
  );
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}

const calls = (page, command) =>
  page.evaluate((command) => window.__calls.filter((c) => c.command === command), command);
const order = (page) => page.evaluate(() => window.__calls.map((c) => c.command));

const entry = (path, name, found = true, opened = new Date().toISOString()) => ({ path, name, opened, found });

// ---- the very first start ---------------------------------------------------------

{
  const page = await start([]);
  await page.waitForSelector("text=Create a library…");
  check("with nothing opened before, it starts at the start screen", true);
  check("and opens nothing by itself", (await calls(page, "library_open")).length === 0);
  check(
    "and shows no list to go back to",
    (await page.locator(".recent").count()) === 0,
  );
  await page.close();
}

// ---- starting again ---------------------------------------------------------------

{
  const page = await start([entry(LEARNING, "Learning"), entry(RUSSIAN, "Russian")]);
  await page.waitForSelector(".tree");
  const opened = await calls(page, "library_open");
  check(
    "it opens the library that was open last",
    opened.length >= 1 && opened.every((c) => c.args.path === LEARNING),
    JSON.stringify(opened),
  );
  check(
    "and shows it",
    (await page.locator(".library-name .name").innerText()) === "Learning",
  );
  check(
    "with its tree",
    (await page.getByRole("button", { name: "Alpha" }).count()) > 0,
  );

  // ---- the last words typed, on disk before the library closes -------------------

  await page.getByRole("button", { name: "Alpha" }).first().click();
  await page.waitForSelector(".prose .ProseMirror");
  await page.locator(".prose .ProseMirror").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" LAST WORDS");
  // Inside the pause the editor waits for before it writes.
  await page.getByRole("button", { name: "Switch library" }).click();
  await page.waitForSelector(".picker .recent");

  const sequence = await order(page);
  const wrote = sequence.lastIndexOf("document_write");
  const closed = sequence.indexOf("library_close");
  const writes = await calls(page, "document_write");
  check(
    "switching library writes what was just typed",
    writes.some((c) => c.args.body.includes("LAST WORDS")),
    JSON.stringify(writes.map((c) => c.args.body)),
  );
  check(
    "before it closes the library, not after",
    wrote !== -1 && closed !== -1 && wrote < closed,
    JSON.stringify(sequence),
  );

  // ---- the start screen, as somebody comes back to it --------------------------

  const listed = await page.locator(".recent-library strong").allInnerTexts();
  check(
    "the start screen lists the libraries opened before, the one just left first",
    JSON.stringify(listed) === JSON.stringify(["Learning", "Russian"]),
    JSON.stringify(listed),
  );
  check(
    "with where each one is",
    (await page.locator(".recent-library").first().innerText()).includes(LEARNING),
  );
  check(
    "and when it was last opened",
    (await page.locator(".recent-library").first().innerText()).includes("Opened today"),
    await page.locator(".recent-library").first().innerText(),
  );
  const opensBefore = (await calls(page, "library_open")).length;
  await page.waitForTimeout(300);
  check(
    "coming back to it does not open the last library again by itself",
    (await calls(page, "library_open")).length === opensBefore,
  );

  // ---- another library, with nothing of the last one left behind ---------------

  await page.locator(".recent-library", { hasText: "Russian" }).click();
  await page.waitForSelector(".tree");
  check(
    "one click opens another",
    (await page.locator(".library-name .name").innerText()) === "Russian",
  );
  check(
    "showing its own tree",
    (await page.getByRole("button", { name: "Verbs of motion" }).count()) > 0 &&
      (await page.getByRole("button", { name: "Alpha" }).count()) === 0,
  );
  check(
    "and not the document that was open in the last one",
    (await page.locator(".prose .ProseMirror").count()) === 0,
  );

  // ---- forgetting one ---------------------------------------------------------

  await page.getByRole("button", { name: "Switch library" }).click();
  await page.waitForSelector(".picker .recent");
  await page.getByRole("button", { name: "Take “Learning” off this list" }).click();
  await page.waitForFunction(
    () => ![...document.querySelectorAll(".recent-library strong")].some((e) => e.textContent === "Learning"),
  );
  const forgot = await calls(page, "forget_library");
  check(
    "forgetting takes it off the list",
    forgot.length === 1 && forgot[0].args.path === LEARNING,
    JSON.stringify(forgot),
  );
  check(
    "and asks nothing of the library itself",
    (await order(page)).every((c) => !c.startsWith("topic_delete") && c !== "document_delete"),
  );
  await page.close();
}

// ---- moving between documents keeps what was typed ------------------------------

{
  const page = await start([entry(LEARNING, "Learning")]);
  await page.waitForSelector(".tree");
  await page.getByRole("button", { name: "Alpha" }).first().click();
  await page.waitForSelector(".prose .ProseMirror");
  await page.locator(".prose .ProseMirror").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" TYPED THEN LEFT");
  await page.getByRole("button", { name: "Beta" }).first().click();
  await page.waitForFunction(
    () => window.__calls.some((c) => c.command === "document_write" && c.args.body.includes("TYPED THEN LEFT")),
    null,
    { timeout: 3000 },
  ).catch(() => {});
  const writes = await calls(page, "document_write");
  check(
    "clicking another document straight after typing still saves the typing",
    writes.some((c) => c.args.document === ALPHA && c.args.body.includes("TYPED THEN LEFT")),
    JSON.stringify(writes.map((c) => c.args.body)),
  );
  await page.waitForTimeout(400);
  check(
    "and the save landing late does not bring the document that was left back",
    (await page.locator(".editor h2").innerText()).includes("Beta"),
    await page.locator(".editor h2").innerText(),
  );
  await page.close();
}

// ---- a save that fails keeps the library open ------------------------------------

{
  const page = await start([entry(LEARNING, "Learning")]);
  await page.waitForSelector(".tree");
  await page.getByRole("button", { name: "Alpha" }).first().click();
  await page.waitForSelector(".prose .ProseMirror");
  await page.locator(".prose .ProseMirror").click();
  await page.keyboard.press("Control+End");
  await page.evaluate(() => {
    window.__failWrites = true;
  });
  await page.keyboard.type(" CANNOT BE WRITTEN");
  await page.getByRole("button", { name: "Switch library" }).click();
  // Either the refusal appears, or the start screen does — which is the failure being looked for.
  await page.waitForSelector("main > p.error, .picker", { timeout: 5000 });
  check(
    "when the last words cannot be written, the library is not closed",
    (await calls(page, "library_close")).length === 0,
  );
  if ((await page.locator("main > p.error").count()) === 0) {
    await browser.close();
    check("the library stays open to say so", false, "it closed, so there is nothing left to check");
    finish();
  }
  check(
    "and says so, with the words still on screen",
    (await page.locator("main > p.error").innerText()).includes("could not be saved") &&
      (await page.locator(".prose").innerText()).includes("CANNOT BE WRITTEN"),
    await page.locator("main > p.error").innerText(),
  );
  check(
    "and the reason beside them",
    (await page.locator(".editor").innerText()).includes("the drive has gone"),
  );
  await page.getByRole("button", { name: "Switch library" }).click();
  await page.waitForSelector(".picker");
  check(
    "asked again, it closes: the words were shown, and cannot be written",
    (await calls(page, "library_close")).length === 1,
  );
  await page.close();
}

// ---- when the last library is not there ------------------------------------------

{
  const page = await start([entry(USB, "Old notes", false), entry(LEARNING, "Learning")]);
  await page.waitForSelector(".picker .recent");
  check(
    "a library whose folder has gone is not tried",
    (await calls(page, "library_open")).length === 0,
  );
  const notice = await page.locator(".notice").innerText().catch(() => "");
  check(
    "and the start screen says where it was looked for, and what to do",
    notice.includes(USB) && notice.includes("plug the drive in"),
    notice,
  );
  check(
    "it is still listed, marked as not found",
    (await page.locator(".recent li.missing").innerText()).includes("Not found"),
  );
  await page.locator(".recent-library", { hasText: "Learning" }).click();
  await page.waitForSelector(".tree");
  check("and the others still open", (await page.locator(".library-name .name").innerText()) === "Learning");
  await page.close();
}

// ---- when the last library will not open --------------------------------------------

{
  const page = await start([entry(LEARNING, "Learning")], {
    failOpen: {
      path: LEARNING,
      error: { kind: "FormatTooNew", message: "written by a newer version of the application" },
    },
  });
  await page.waitForSelector(".picker .recent");
  const notice = await page.locator(".notice").innerText().catch(() => "");
  check(
    "a library that refuses to open lands on the start screen with the reason",
    notice.includes("could not be opened") && notice.includes("newer version"),
    notice,
  );
  await page.close();
}

await browser.close();

finish();

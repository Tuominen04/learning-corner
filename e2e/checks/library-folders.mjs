// Making a library in a folder of its own, and renaming one — in a real browser, with a stub
// shell that answers the way the real one does: a new library's folder is made inside the one
// chosen, and a rename says what became of the folder.

import { check, finish, launch, URL } from "../support.mjs";

const CORNER = "/home/you/learning-corner";

const browser = await launch();

/**
 * A window over a stub shell. `shared` makes a rename answer as though the library's folder
 * held other things too; `recent` is the start screen's list to begin with.
 */
async function start({ recent = [], shared = false } = {}) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => check("no page errors", false, e.message));
  await page.addInitScript(
    ({ recent, shared, CORNER }) => {
      const calls = [];
      window.__calls = calls;
      let list = recent.map((r) => ({ ...r }));
      let library = null; // { path, name }

      const slug = (name) =>
        name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
      const status = () => ({
        path: library.path,
        name: library.name,
        topics: 1,
        documents: 1,
        writable: true,
        problems: [],
      });

      window.__TAURI_INTERNALS__ = {
        invoke: async (command, args) => {
          calls.push({ command, args: args ?? {} });
          switch (command) {
            case "plugin:dialog|open":
              return CORNER;
            case "recent_libraries":
              return list.map((r) => ({ ...r }));
            case "library_create": {
              // What the engine does: a folder named after the library, inside the one chosen.
              library = { path: `${args.location}/${slug(args.name)}`, name: args.name };
              list = [
                { path: library.path, name: library.name, opened: new Date().toISOString(), found: true },
                ...list.filter((r) => r.path !== library.path),
              ];
              return status();
            }
            case "library_open": {
              const known = list.find((r) => r.path === args.path);
              library = { path: args.path, name: known?.name ?? "Learning" };
              return status();
            }
            case "library_close":
              library = null;
              return null;
            case "library_status":
              return status();
            case "library_rename": {
              const from = library.path;
              library.name = args.name;
              if (!shared) library.path = `${from.slice(0, from.lastIndexOf("/"))}/${slug(args.name)}`;
              list = list.map((r) => (r.path === from ? { ...r, path: library.path, name: args.name } : r));
              return { status: status(), folder: shared ? "shared" : "follows" };
            }
            case "document_read":
              return {
                id: args.document,
                title: "Alpha",
                topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B70",
                body: "First document.",
                revision: "1",
                modified: "2026-09-01T00:00:00Z",
              };
            case "document_backlinks":
              return [];
            case "topic_tree":
              return [
                {
                  id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70",
                  name: "Protein",
                  children: [],
                  documents: [{ id: "01J8ZQ7B2N4Q6S8W0W2Y4A6C80", title: "Alpha" }],
                },
              ];
            default:
              return null;
          }
        },
      };
    },
    { recent, shared, CORNER },
  );
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}

const calls = (page, command) =>
  page.evaluate((command) => window.__calls.filter((c) => c.command === command), command);
const heading = (page) => page.locator(".library-name .name").innerText();

async function rename(page, name) {
  await page.locator(".library-name .name").dblclick();
  await page.locator(".library-name .rename-input").fill(name);
  await page.locator(".library-name .rename-input").press("Enter");
  await page
    .waitForFunction(
      (name) => document.querySelector(".library-name .name")?.textContent === name,
      name,
      { timeout: 3000 },
    )
    .catch(() => {});
}

// ---- making a library ------------------------------------------------------------------

{
  const page = await start();
  await page.waitForSelector("text=Create a library…");
  check(
    "the start screen says a folder is made for the library",
    (await page.locator(".field .hint").innerText()).includes("folder named after it"),
  );

  await page.locator(".field input").fill("I testing forders");
  await page.getByRole("button", { name: "Create a library…" }).click();
  await page.waitForSelector(".tree");

  const dialog = (await calls(page, "plugin:dialog|open"))[0];
  check(
    "the folder dialog asks where to put it, not which folder is the library",
    dialog?.args?.options?.title === "Choose where to put the new library",
    JSON.stringify(dialog?.args),
  );
  const created = (await calls(page, "library_create"))[0];
  check(
    "the chosen folder is where the library goes",
    created?.args?.location === CORNER && created?.args?.name === "I testing forders",
    JSON.stringify(created?.args),
  );
  check(
    "and the library is shown in the folder made for it",
    (await page.locator(".library-name").getAttribute("title")) ===
      `${CORNER}/i-testing-forders`,
    await page.locator(".library-name").getAttribute("title"),
  );

  // ---- renaming it, when the folder is its own --------------------------------------

  await rename(page, "Nutrition");
  check("renaming it renames it", (await heading(page)) === "Nutrition");
  check(
    "and the folder shown is where the folder went",
    (await page.locator(".library-name").getAttribute("title")) === `${CORNER}/nutrition`,
    await page.locator(".library-name").getAttribute("title"),
  );
  check(
    "with nothing to explain when the folder followed",
    (await page.locator(".folder-note").count()) === 0,
  );

  await page.getByRole("button", { name: "Switch library" }).click();
  await page.waitForSelector(".picker .recent");
  const where = await page.locator(".recent-library .where").first().innerText();
  const listed = await page.locator(".recent-library strong").first().innerText();
  check(
    "the start screen lists it by its new name, in its new folder",
    listed === "Nutrition" && where === `${CORNER}/nutrition`,
    `${listed} at ${where}`,
  );

  // ---- the open dialog asks its own question ------------------------------------------

  await page.getByRole("button", { name: "Open an existing one…" }).click();
  await page.waitForSelector(".tree");
  const asked = (await calls(page, "plugin:dialog|open")).at(-1);
  check(
    "opening asks which folder is the library",
    asked?.args?.options?.title === "Choose the library's folder",
    JSON.stringify(asked?.args),
  );
  await page.close();
}

// ---- renaming a library whose folder is not its alone ----------------------------------

{
  const page = await start({
    shared: true,
    recent: [{ path: CORNER, name: "I testing forders", opened: new Date().toISOString(), found: true }],
  });
  await page.waitForSelector(".tree");
  await rename(page, "Nutrition");

  check("the name changes all the same", (await heading(page)) === "Nutrition");
  const note = await page.locator(".folder-note").innerText().catch(() => "");
  check(
    "and it says why the folder kept its name, naming the folder",
    note.includes("learning-corner") && note.includes("other things"),
    note,
  );
  check(
    "which is not an error",
    (await page.locator("main > p.error").count()) === 0,
  );
  check(
    "the folder shown is the one it was in",
    (await page.locator(".library-name").getAttribute("title")) === CORNER,
  );

  await page.locator(".library-name .name").dblclick();
  await page.locator(".library-name .rename-input").press("Escape");
  check(
    "changing your mind about a rename leaves the note where it was",
    (await page.locator(".folder-note").count()) === 1,
  );
  await page.getByRole("button", { name: "Alpha" }).first().click();
  await page.waitForSelector(".prose .ProseMirror");
  check(
    "moving on to a document clears it, rather than leaving it above the writing",
    (await page.locator(".folder-note").count()) === 0,
  );
  await rename(page, "Nutrition again");
  check(
    "and another rename says it again, since it is true again",
    (await page.locator(".folder-note").count()) === 1,
  );
  await page.close();
}

await browser.close();

finish();

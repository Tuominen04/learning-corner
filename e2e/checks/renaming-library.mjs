// Renaming the library itself, in a real browser with a stub shell behind it that renames the
// way the real one does: the name in the library, and the name on the start screen's list.

import { check, finish, launch, URL } from "../support.mjs";

const LEARNING = "/home/you/Learning";

const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript((LEARNING) => {
  const calls = [];
  window.__calls = calls;
  let name = "Learning";
  let list = [{ path: LEARNING, name, opened: new Date().toISOString(), found: true }];
  let open = false;
  const status = () => ({ path: LEARNING, name, topics: 1, documents: 1, writable: true, problems: [] });

  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      calls.push({ command, args: args ?? {} });
      switch (command) {
        case "recent_libraries":
          return list.map((r) => ({ ...r }));
        case "library_open":
          open = true;
          return status();
        case "library_close":
          open = false;
          return null;
        case "library_status":
          return status();
        case "library_rename":
          if (!open) throw { kind: "LibraryNotOpen", message: "no library is open" };
          // Standing in for a library written by a newer version, which may not be renamed.
          if (args.name === "Refused") {
            throw { kind: "FormatTooNew", message: "this library was written by a newer version" };
          }
          name = args.name;
          list = list.map((r) => (r.path === LEARNING ? { ...r, name } : r));
          // The folder already has a name the library's would give it, so it stays put.
          return { status: status(), folder: "follows" };
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
}, LEARNING);

const renames = () =>
  page.evaluate(() => window.__calls.filter((c) => c.command === "library_rename"));
const heading = () => page.locator(".library-name .name").innerText();
const input = page.locator(".library-name .rename-input");

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");

check(
  "the folder is there on hover, for telling two libraries of one name apart",
  (await page.locator(".library-name").getAttribute("title")) === LEARNING,
);

// ---- double-click ------------------------------------------------------------------

await page.locator(".library-name .name").dblclick();
check("double-clicking the name opens it for renaming", (await input.count()) === 1);
check("with the name as it is, ready to type over", (await input.inputValue()) === "Learning");
await input.fill("Nutrition");
await input.press("Enter");
await page
  .waitForFunction(() => document.querySelector(".library-name .name")?.textContent === "Nutrition", null, {
    timeout: 3000,
  })
  .catch(() => {});

const sent = await renames();
check(
  "Enter renames it",
  sent.length === 1 && sent[0].args.name === "Nutrition",
  JSON.stringify(sent),
);
check("and the sidebar says so", (await heading()) === "Nutrition");

// ---- the pencil, and F2 ------------------------------------------------------------

await page.locator(".library-head").hover();
await page.locator(".library-name .pencil").click();
check("the pencil opens it too", (await input.count()) === 1);
await input.press("Escape");
check("Escape changes nothing", (await renames()).length === 1 && (await heading()) === "Nutrition");

await page.locator(".library-name .name").focus();
await page.keyboard.press("F2");
check("so does F2", (await input.count()) === 1);
await input.fill("   ");
await input.press("Enter");
check(
  "an empty name is taken as never mind, not sent",
  (await renames()).length === 1 && (await heading()) === "Nutrition",
);

// ---- the same name, asked for again --------------------------------------------------

check(
  "one of each is counted in the singular",
  (await page.locator(".library .counts").innerText()) === "1 topic · 1 document",
  await page.locator(".library .counts").innerText(),
);

await page.locator(".library-name .name").dblclick();
await page.locator("aside .tree").click({ position: { x: 5, y: 5 } });
check(
  "clicking away from an unchanged name changes nothing",
  (await renames()).length === 1,
  JSON.stringify(await renames()),
);

await page.locator(".library-name .name").dblclick();
await input.press("Enter");
await page.waitForTimeout(200);
const again = (await renames()).at(-1);
check(
  "but Enter on it asks for the name again, which is what puts an old folder right",
  (await renames()).length === 2 && again?.args?.name === "Nutrition",
  JSON.stringify(await renames()),
);

// ---- a library that may not be renamed -----------------------------------------------

await page.locator(".library-name .name").dblclick();
await input.fill("Refused");
await input.press("Enter");
await page.waitForSelector("main > p.error");
check(
  "a refusal is shown",
  (await page.locator("main > p.error").innerText()).includes("newer version"),
);
check("and the name stays what it was", (await heading()) === "Nutrition");

// ---- the start screen hears about it --------------------------------------------------

await page.getByRole("button", { name: "Switch library" }).click();
await page.waitForSelector(".picker .recent");
const listedName = await page.locator(".recent-library strong").first().innerText();
const listedWhere = await page.locator(".recent-library .where").first().innerText();
check(
  "the start screen lists it by its new name, at the same folder",
  listedName === "Nutrition" && listedWhere === LEARNING,
  `${listedName} at ${listedWhere}`,
);

await browser.close();

finish();

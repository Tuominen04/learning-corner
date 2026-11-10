// Opening a library made by an earlier version: it is converted only when the person says so,
// after being told what happens and that a copy is kept beside it (ADR 0009).

import { check, finish, launch, URL } from "../support.mjs";

const browser = await launch();

async function start({ reopensLast }) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => check("no page errors", false, e.message));
  await page.addInitScript((reopensLast) => {
    window.__calls = [];
    let converted = false;
    const status = { path: "/home/you/learning", name: "Learning", documents: 3, works: 0, writable: true, problems: [] };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: async (command, args) => {
        window.__calls.push({ command, args: args ?? {} });
        switch (command) {
          case "recent_libraries":
            return reopensLast ? [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }] : [];
          case "plugin:dialog|open":
            return "/home/you/learning";
          case "library_open":
            if (!converted) throw { kind: "MigrationRequired", message: "written by an older version (format 1); this build reads format 2" };
            return status;
          case "library_migrate":
            converted = true;
            return { status, copy: "/home/you/learning-format-1" };
          case "library_status":
            return status;
          case "page_tree":
            return [{ id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", title: "Protein", children: [{ id: "01J8ZQ7B2N4Q6S8W0W2Y4A6C80", title: "What protein is", children: [] }] }];
          default:
            return null;
        }
      },
    };
  }, reopensLast);
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}

const migrations = (page) => page.evaluate(() => window.__calls.filter((c) => c.command === "library_migrate"));

// ---- chosen by hand -------------------------------------------------------------------------

const page = await start({ reopensLast: false });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.locator(".convert-library").waitFor();
const asked = await page.locator(".convert-library").innerText();
check("a format 1 library asks before anything happens", (await migrations(page)).length === 0, asked);
check("and says what converting does", asked.includes("Each topic becomes a page") && asked.includes("Nothing you wrote changes"), asked);
check("and that a copy is kept beside it first", asked.includes("-format-1"), asked);

await page.getByRole("button", { name: "Not now" }).click();
check("Not now converts nothing and goes back", (await migrations(page)).length === 0 && (await page.locator(".convert-library").count()) === 0);

await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.getByRole("button", { name: "Convert and open" }).click();
await page.locator(".tree").waitFor();
check("Convert and open converts that library", (await migrations(page)).at(-1)?.args?.path === "/home/you/learning");
check("and opens it, topics as pages", (await page.locator(".page-row .name").allInnerTexts()).join("|") === "Protein|What protein is");
check("saying where the copy of the library as it was is", (await page.locator(".folder-note").first().innerText()).includes("/home/you/learning-format-1"), await page.locator(".folder-note").first().innerText());

// ---- the last library, opening again at startup ---------------------------------------------

const again = await start({ reopensLast: true });
await again.locator(".convert-library").waitFor();
check("at startup, the last library asks too, rather than failing to open", (await again.locator(".convert-library h2").innerText()).includes("Learning"), await again.locator(".convert-library").innerText());
check("and nothing is converted unasked", (await migrations(again)).length === 0);

await browser.close();
finish();

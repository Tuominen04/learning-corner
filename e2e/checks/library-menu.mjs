// The library menu at the top left: what you do to the library as a whole, behind one button.
// Closed until asked for, shut again by Escape, a click elsewhere, or choosing something — and
// a library open for reading only offers no backing up.

import { check, finish, launch, URL } from "../support.mjs";

const browser = await launch();

async function open(writable) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => check("no page errors", false, e.message));
  await page.addInitScript((writable) => {
    window.__TAURI_INTERNALS__ = {
      invoke: async (command) => {
        switch (command) {
          case "recent_libraries":
            return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
          case "library_open":
          case "library_status":
            return { path: "/home/you/learning", name: "Learning", topics: 0, documents: 0, works: 0, writable, problems: [] };
          case "topic_tree":
            return [];
          default:
            return null;
        }
      },
    };
  }, writable);
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".tree");
  return page;
}

const page = await open(true);
const toggle = page.getByRole("button", { name: "Library menu" });
const items = () => page.locator(".menu-list button").allInnerTexts();

check("the menu is closed to begin with", (await page.locator(".menu-list").count()) === 0);
const box = await toggle.boundingBox();
check("its button is at the top left of the sidebar", box !== null && box.x < 40 && box.y < 40, JSON.stringify(box));

await toggle.click();
check("it holds the library's actions", JSON.stringify(await items()) === JSON.stringify(["Back up…", "Bring back…", "Switch library"]), JSON.stringify(await items()));
check("and says it is open", (await toggle.getAttribute("aria-expanded")) === "true");

await page.keyboard.press("Escape");
check("Escape closes it", (await page.locator(".menu-list").count()) === 0);

await toggle.click();
await page.mouse.click(700, 500);
check("a click elsewhere closes it", (await page.locator(".menu-list").count()) === 0);

await toggle.click();
await page.getByRole("button", { name: "Back up…" }).click();
check("choosing an action closes it", (await page.locator(".menu-list").count()) === 0);
check("and does the action", (await page.locator(".backup-panel").count()) === 1);

const reading = await open(false);
await reading.getByRole("button", { name: "Library menu" }).click();
const offered = await reading.locator(".menu-list button").allInnerTexts();
check("a library open for reading only offers just Switch library", JSON.stringify(offered) === JSON.stringify(["Switch library"]), JSON.stringify(offered));

await browser.close();
finish();

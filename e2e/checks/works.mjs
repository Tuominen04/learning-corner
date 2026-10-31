// Works: making one, adding a translation and writing it row by row, joining a row, the two
// layouts, a pane hidden for practice, and a misalignment said plainly. The stub keeps a work's
// rows the way the engine does, enough for the interface to be driven through it.

import { check, finish, launch, URL } from "../support.mjs";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(() => {
  window.__calls = [];
  const status = { path: "/home/you/kielet", name: "Kielet", topics: 0, documents: 0, works: 0, writable: true, problems: [] };
  let work = null;
  let revision = 1;
  const misalignments = () => {
    const n = work.editions.find((e) => e.kind === "original").rows.length;
    return work.editions.filter((e) => e.rows.length !== n).map((e) => ({ edition: e.id, rows: e.rows.length, original_rows: n }));
  };
  const answer = () => {
    revision += 1;
    work.revision = String(revision);
    work.misalignments = misalignments();
    return structuredClone(work);
  };
  const edition = (id) => work.editions.find((e) => e.id === id);
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 0,
    invoke: async (command, args) => {
      window.__calls.push({ command, args: args ?? {} });
      switch (command) {
        case "recent_libraries":
          return [{ path: status.path, name: "Kielet", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return status;
        case "topic_tree":
        case "source_list":
          return [];
        case "work_list":
          return work ? [{ id: work.id, title: work.title, languages: work.editions.map((e) => e.language), misaligned: misalignments().length > 0 }] : [];
        case "work_create":
          work = {
            id: "01J9WORK0000000000000000AA", title: args.title, unit: args.unit, created: "2026-10-31T10:00:00Z",
            sources: [], notes: [], repeats: [], misalignments: [], revision: "1",
            editions: [{ id: "01J9ED00000000000000000001", kind: "original", language: args.language, scheme: null, label: null, source: null, missing: false,
              rows: args.text.split("\n").filter((l) => l.trim()).map((l) => [l]) }],
          };
          return answer();
        case "work_read":
          return structuredClone(work);
        case "work_add_edition": {
          const n = work.editions[0].rows.length;
          work.editions.push({ id: "01J9ED00000000000000000002", kind: args.edition.kind, language: args.edition.language, scheme: args.edition.scheme,
            label: args.edition.label, source: null, missing: false,
            rows: args.text.trim() ? args.text.split("\n").filter((l) => l.trim()).map((l) => [l]) : Array.from({ length: n }, () => []) });
          return answer();
        }
        case "work_write_row":
          if (args.revision !== work.revision) throw { kind: "Conflict", message: "changed" };
          edition(args.edition).rows[args.row - 1] = args.text.split("\n").filter((l) => l.trim());
          return answer();
        case "work_join": {
          const rows = edition(args.edition).rows;
          const [joined] = rows.splice(args.row - 1, 1);
          rows[args.row - 2].push(...joined);
          return answer();
        }
        case "work_move_edition": {
          const from = work.editions.findIndex((e) => e.id === args.edition);
          const [moved] = work.editions.splice(from, 1);
          work.editions.splice(args.position - 1, 0, moved);
          return answer();
        }
        case "work_insert_row":
          for (const e of work.editions) e.rows.splice(args.row - 1, 0, []);
          return answer();
        default:
          return null;
      }
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
});

const calls = (name) => page.evaluate((n) => window.__calls.filter((c) => c.command === n), name);

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");

await page.getByRole("button", { name: "Works", exact: true }).click();
await page.locator(".works").waitFor();
check("an empty library says there are no works yet", (await page.locator(".works").innerText()).includes("No works yet"));

// A new work, divided by line.
await page.getByRole("button", { name: "New work" }).click();
const radio = await page.getByRole("radio", { name: /By line/ }).boundingBox();
const label = await page.getByText("By line", { exact: true }).boundingBox();
check("each way to divide sits beside its radio, not across the form", radio !== null && label !== null && radio.width < 30 && label.x - radio.x < 60, JSON.stringify({ radio, label }));
const box = await page.getByLabel("The original text").evaluate((t) => ({ resize: getComputedStyle(t).resize, width: t.getBoundingClientRect().width, form: t.closest(".new-work").getBoundingClientRect().width }));
check("the text box grows downwards only, inside the form", box.resize === "vertical" && box.width < box.form, JSON.stringify(box));
await page.getByLabel("Title").fill("Я вас любил");
await page.getByLabel("The original text").fill("Я вас любил: любовь ещё, быть может,\nВ душе моей угасла не совсем;\nНо пусть она вас больше не тревожит;");
await page.getByRole("button", { name: "Create" }).click();
await page.locator(".work-view").waitFor();
const created = (await calls("work_create")).at(-1)?.args;
check("it is made in Russian, by line, from what was pasted", created?.language === "ru" && created?.unit === "line" && created?.text.startsWith("Я вас"), JSON.stringify(created));
check("its three rows are shown", (await page.locator(".work-grid .work-cell").count()) === 3);

// A translation, empty, to be written row by row.
await page.getByRole("button", { name: "Add translation" }).click();
await page.locator(".edition-form").waitFor();
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.locator(".pane-head", { hasText: "Finnish translation" }).waitFor();
check("an empty translation has an empty row for every row", (await page.locator(".work-cell .empty-row").count()) === 3);

await page.getByRole("button", { name: "Finnish translation, row 2" }).click();
const editor = page.getByRole("textbox", { name: "Finnish translation, row 2" });
await editor.fill("ei sielussani ole täysin sammunut;");
await editor.press("Enter");
await page.locator(".work-cell", { hasText: "ei sielussani" }).waitFor();
const written = (await calls("work_write_row")).at(-1)?.args;
check("a row is written to its edition, row and revision", written?.row === 2 && written?.edition === "01J9ED00000000000000000002" && written?.revision === "3", JSON.stringify(written));
check("and shows in its place", (await page.getByRole("button", { name: "Finnish translation, row 2" }).innerText()).includes("ei sielussani"));

// The row's tools, and joining a row of one edition to the row above.
await page.getByRole("button", { name: "Finnish translation, row 3" }).click();
check("the selected row offers its tools", await page.getByRole("toolbar", { name: "Row 3" }).isVisible());
await page.getByRole("button", { name: "Join to the row above" }).click();
await page.locator(".misaligned").waitFor();
check("a join that leaves the translation a row short says so", (await page.locator(".misaligned").innerText()).includes("1 row fewer than the original"));
check("the unaligned pane is marked", (await page.locator(".pane-head.unaligned").count()) === 1);

// The row bar goes away with Esc, and with a click outside the rows.
await page.getByRole("button", { name: "Original (Russian), row 1" }).click();
await page.getByRole("textbox", { name: "Original (Russian), row 1" }).press("Escape");
check("Esc closes the row's tools", (await page.locator(".row-tools").count()) === 0);
await page.getByRole("button", { name: "Original (Russian), row 2" }).click();
await page.getByRole("textbox", { name: "Original (Russian), row 2" }).press("Enter");
check("Enter saves and keeps the row's tools", (await page.locator(".row-tools").count()) === 1);
await page.locator(".work-head h2").click({ position: { x: 2, y: 2 } });
check("a click outside the rows closes them", (await page.locator(".row-tools").count()) === 0);

// The panes in another order.
await page.getByRole("button", { name: "Move Finnish translation left" }).click();
await page.waitForFunction(() => document.querySelector(".pane-head strong")?.textContent?.includes("Finnish"));
const moved = (await calls("work_move_edition")).at(-1)?.args;
check("a pane moves a place to the left", moved?.position === 1, JSON.stringify(moved));
check("the first pane cannot move further left", await page.getByRole("button", { name: "Move Finnish translation left" }).isDisabled());

// Stacked rows, and a pane hidden for practice.
await page.getByRole("button", { name: "Stacked" }).click();
check("stacked shows a block per row", (await page.locator(".stacked-row").count()) === 3);
await page.getByRole("button", { name: "Side by side" }).click();
await page.locator(".pane-head", { hasText: "Original (Russian)" }).getByRole("button", { name: "Hide" }).click();
check("a hidden pane's text is blurred", (await page.locator(".work-cell.practising").count()) === 3);
await page.getByRole("button", { name: "Original (Russian), row 1" }).click();
check("clicking a hidden row reveals just that row", (await page.locator(".work-cell.practising").count()) === 2);

// Back to the list, which names the work's languages and that it is out of line.
await page.getByRole("button", { name: "← Works" }).click();
await page.locator(".work-list").waitFor();
const item = await page.locator(".work-item").innerText();
check("the list names the languages, in pane order, and the misalignment", item.includes("Finnish · Russian") && item.includes("not lined up"), item);

await browser.close();
finish();

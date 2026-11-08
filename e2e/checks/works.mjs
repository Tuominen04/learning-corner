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
          work.editions.push({ id: `01J9ED${String(work.editions.length + 1).padStart(20, "0")}`, kind: args.edition.kind, language: args.edition.language, scheme: args.edition.scheme,
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
        case "library_remembered":
          return { backup: null, hidden_panes: window.__hidden ?? {} };
        case "remember_hidden_panes":
          window.__hidden = { ...(window.__hidden ?? {}), [args.work]: args.editions };
          return null;
        case "work_split": {
          const rows = edition(args.edition).rows;
          const rest = rows[args.row - 1].splice(args.line - 1);
          rows.splice(args.row, 0, rest);
          return answer();
        }
        case "work_update_edition": {
          Object.assign(edition(args.edition), { language: args.language, label: args.label, scheme: args.scheme, source: args.source });
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

// A translation's language can be put right afterwards, from the same question as adding it.
await page.locator(".pane-head", { hasText: "Finnish translation" }).getByRole("button", { name: "…" }).click();
const details = page.locator(".edition-form");
check("its details ask what it is translated into", (await details.innerText()).includes("Translated into"));
check("starting from the language it has", (await details.getByRole("combobox", { name: "Language" }).inputValue()) === "fi");
await details.getByRole("combobox", { name: "Language" }).selectOption("en");
await details.getByRole("button", { name: "Save" }).click();
await page.locator(".pane-head", { hasText: "English translation" }).waitFor();
const changed = (await calls("work_update_edition")).at(-1)?.args;
check("the new language is what is saved", changed?.language === "en", JSON.stringify(changed));
// And back, so the rest reads as before.
await page.locator(".pane-head", { hasText: "English translation" }).getByRole("button", { name: "…" }).click();
await details.getByRole("combobox", { name: "Language" }).selectOption("fi");
await details.getByRole("button", { name: "Save" }).click();
await page.locator(".pane-head", { hasText: "Finnish translation" }).waitFor();

// A pronunciation reads in italics, set apart from the meaning.
await page.getByRole("button", { name: "Add pronunciation" }).click();
await page.locator(".edition-form").waitFor();
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.locator(".pane-head", { hasText: "Pronunciation" }).waitFor();
const style = await page.locator(".work-cell.pronunciation").first().evaluate((c) => getComputedStyle(c).fontStyle);
check("a pronunciation is in italics", style === "italic", style);

// Stacked rows, and a pane hidden for practice.
await page.getByRole("button", { name: "Stacked" }).click();
check("stacked shows a block per row", (await page.locator(".stacked-row").count()) === 3);
await page.getByRole("button", { name: "Side by side" }).click();
await page.locator(".pane-head", { hasText: "Original (Russian)" }).getByRole("button", { name: "Hide" }).click();
check("a hidden pane's rows are there to click", (await page.locator(".work-cell.practising").count()) === 3);
check("and none of its text is drawn", (await page.locator(".work-cell.practising").allInnerTexts()).every((t) => t.trim() === ""));
await page.getByRole("button", { name: "Original (Russian), row 1" }).click();
check("clicking a hidden row reveals just that row", (await page.locator(".work-cell.practising").count()) === 2);

// Back to the list, which names the work's languages and that it is out of line.
await page.getByRole("button", { name: "← Works" }).click();
await page.locator(".work-list").waitFor();
const item = await page.locator(".work-item").innerText();
check("the list names the languages, in pane order, and the misalignment", item.includes("Finnish · Russian") && item.includes("not lined up"), item);

// A row of three lines splits before whichever line is chosen, not only its last.
await page.locator(".work-item").click();
await page.locator(".work-view").waitFor();
await page.locator(".pane-head", { hasText: "Finnish translation" }).waitFor({ timeout: 3000 }).catch(() => {});
check("opened again, a work is shown as it is now, every edition in it", (await page.locator(".pane-head").count()) === 3, String(await page.locator(".pane-head").count()));
await page.getByRole("button", { name: "Finnish translation, row 1" }).click();
await page.getByRole("textbox", { name: "Finnish translation, row 1" }).fill("yksi\nkaksi\nkolme");
await page.getByRole("textbox", { name: "Finnish translation, row 1" }).press("Enter");
await page.locator(".work-cell", { hasText: "kolme" }).waitFor();
await page.getByRole("button", { name: "Finnish translation, row 1" }).click();
const splitters = page.getByRole("group", { name: "Split before line" }).getByRole("button");
check("a three-line row offers to split before line 2 or 3", JSON.stringify(await splitters.allInnerTexts()) === JSON.stringify(["2", "3"]), JSON.stringify(await splitters.allInnerTexts()));
check("each says which line it starts the new row from", (await page.getByRole("button", { name: "Split before line 2" }).getAttribute("title"))?.includes("kaksi"));
await page.getByRole("button", { name: "Split before line 2" }).click();
await page.waitForFunction(() => document.querySelectorAll(".work-cell").length > 0 && [...document.querySelectorAll(".work-cell")].some((c) => c.getAttribute("aria-label") === "Finnish translation, row 2" && c.textContent.includes("kaksi")));
const splitArgs = (await calls("work_split")).at(-1)?.args;
check("the split is asked for before line 2", splitArgs?.row === 1 && splitArgs?.line === 2, JSON.stringify(splitArgs));
check("and the rest of the row moves down as one row", (await page.getByRole("button", { name: "Finnish translation, row 2" }).innerText()).includes("kolme"));

// The panes showing are remembered: hide one, leave, come back, and it is still hidden.
await page.getByRole("checkbox", { name: "Pronunciation" }).uncheck();
const hiddenSent = (await calls("remember_hidden_panes")).at(-1)?.args;
check("hiding a pane is remembered for this work", hiddenSent?.work === "01J9WORK0000000000000000AA" && hiddenSent?.editions.length === 1, JSON.stringify(hiddenSent));
await page.getByRole("button", { name: "← Works" }).click();
await page.locator(".work-item").click();
await page.locator(".pane-head").first().waitFor();
await page.waitForFunction(() => document.querySelectorAll(".pane-head").length === 2, null, { timeout: 3000 }).catch(() => {});
check("and opened again, it is still hidden", (await page.locator(".pane-head").count()) === 2 && !(await page.getByRole("checkbox", { name: "Pronunciation" }).isChecked()));
await page.getByRole("checkbox", { name: "Pronunciation" }).check();
check("showing it again forgets it", JSON.stringify((await calls("remember_hidden_panes")).at(-1)?.args?.editions) === "[]");

await browser.close();
finish();

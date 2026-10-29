// Back up and bring back: a plan is shown before anything is written, the drive's own changes
// are not replaced without a yes, and a file changed in both places is applied only once it
// has an answer — which is what the shell is sent.

import { check, finish, launch, URL } from "../support.mjs";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(() => {
  window.__calls = [];
  const status = { path: "/home/you/learning", name: "Learning", topics: 1, documents: 1, writable: true, problems: [] };
  const side = { size: 2048, modified: "2026-10-20T10:00:00Z" };
  const plan = (direction, entries) => ({
    direction, library_name: "Learning", library_path: status.path, drive_path: "/run/media/you/USB/learning",
    known_drive: true, entries, unchanged: 7,
    drive_changes: entries.filter((e) => e.drive_change).length,
    asks: entries.filter((e) => e.action === "ask").length,
  });
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 0,
    invoke: async (command, args) => {
      window.__calls.push({ command, args: args ?? {} });
      switch (command) {
        case "recent_libraries":
          return [{ path: status.path, name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return status;
        case "topic_tree":
          return [{ id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", name: "Protein", children: [], documents: [] }];
        case "plugin:dialog|open":
          return "/run/media/you/USB/learning";
        case "backup_plan":
          return plan("backup", [
            { path: "topics/protein/what.md", outcome: "changed-in-library", action: "copy-to-drive", library: side, drive: side, drive_change: false },
            { path: "topics/protein/drive.md", outcome: "changed-on-drive", action: "copy-to-drive", library: side, drive: side, drive_change: true },
          ]);
        case "restore_plan":
          return plan("restore", [
            { path: "topics/protein/drive.md", outcome: "changed-on-drive", action: "copy-to-library", library: side, drive: side, drive_change: true },
            { path: "topics/protein/both.md", outcome: "changed-in-both", action: "ask", library: side, drive: side, drive_change: true },
          ]);
        case "backup_apply":
        case "restore_apply":
          return { copied: ["topics/protein/drive.md"], removed: [], kept: [".conflicts/2026-10-29T10-00-00Z/topics/protein/drive.md"], status };
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

// Back up: the plan first, and the drive's change held back until it is agreed to.
await page.getByRole("button", { name: "Back up…" }).click();
const panel = page.locator(".backup-panel");
await panel.getByRole("button", { name: "Choose a folder…" }).click();
await panel.locator("[role=status]").waitFor();
check("the plan is summarised", (await panel.locator("[role=status]").innerText()).includes("2 files to copy to the drive, nothing to remove."));
check("nothing is applied by planning", (await calls("backup_apply")).length === 0);
const backUp = panel.getByRole("button", { name: "Back up", exact: true });
check("the drive's own change is warned about", (await panel.locator(".drive-changes").innerText()).includes("1 change of its own"));
check("and backing up waits for a yes", await backUp.isDisabled());
await panel.getByText("Replace them").click();
check("which enables it", await backUp.isEnabled());
await backUp.click();
await panel.getByText("Backed up:").waitFor();
check("the shell is told to overwrite", (await calls("backup_apply")).at(-1)?.args?.overwrite === true);
check("and where the replaced version was kept is shown", (await panel.innerText()).includes(".conflicts/"));
await panel.getByRole("button", { name: "Done" }).click();

// Bring back: a file changed in both places needs an answer before anything is applied.
await page.getByRole("button", { name: "Bring back…" }).click();
await panel.getByRole("button", { name: "Choose a folder…" }).click();
await panel.locator("[role=status]").waitFor();
const bringBack = panel.getByRole("button", { name: "Bring back from a drive" });
check("bringing back waits for every answer", await bringBack.isDisabled());
check("and says how many are waiting", (await panel.innerText()).includes("1 file needs an answer first."));
check("keeping both is offered where both sides have the file", await panel.getByText("Keep both").isVisible());
await panel.getByText("Take the drive's").click();
check("an answer enables it", await bringBack.isEnabled());
await bringBack.click();
await panel.getByText("Brought back:").waitFor();
const sent = (await calls("restore_apply")).at(-1)?.args?.answers;
check("the answer is what is sent", JSON.stringify(sent) === JSON.stringify({ "topics/protein/both.md": "take-drive" }), JSON.stringify(sent));
check("the drive is named by the plan, not the interface", (await calls("restore_plan")).at(-1)?.args?.destination === null);

// Cancelling forgets the plan in the shell.
await panel.getByRole("button", { name: "Done" }).click();
await page.getByRole("button", { name: "Back up…" }).click();
await panel.getByRole("button", { name: "Choose a folder…" }).click();
await panel.locator("[role=status]").waitFor();
await panel.getByRole("button", { name: "Cancel" }).click();
check("cancel forgets the plan", (await calls("backup_cancel")).length === 1);
check("and closes the panel", (await page.locator(".backup-panel").count()) === 0);

await browser.close();
finish();

// The Export panel: what the save dialog is asked, what the shell is told to write, and that
// the newest words are on disk before the export reads them.

import { check, finish, launch, URL } from "../support.mjs";

const DOC = "01J8ZQ7B2N4Q6S8W0W2Y4A6C80";

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(({ DOC }) => {
  window.__calls = [];
  window.__nextPath = null;
  let body = "Protein is built from amino acids.";
  let revision = 1;
  const doc = () => ({ id: DOC, title: "What protein is", topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", body,
    revision: String(revision), modified: "2026-10-02T00:00:00Z" });
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 0,
    invoke: async (command, args) => {
      window.__calls.push({ command, args: args ?? {} });
      switch (command) {
        case "recent_libraries":
          return [{ path: "/home/you/learning", name: "Learning", opened: new Date().toISOString(), found: true }];
        case "library_open":
        case "library_status":
          return { path: "/home/you/learning", name: "Learning", topics: 1, documents: 1, writable: true, problems: [] };
        case "topic_tree":
          return [{ id: "01J8ZQ6A1M3P5R7T9V1X3Z5B70", name: "Protein", children: [], documents: [{ id: DOC, title: "What protein is" }] }];
        case "document_read":
          return doc();
        case "document_write":
          body = args.body;
          revision += 1;
          return doc();
        case "source_list":
        case "citation_format_many":
        case "citation_reference_list":
        case "document_backlinks":
          return [];
        case "plugin:dialog|save":
          return window.__nextPath;
        case "document_export":
          if (args.path.includes("fail")) throw { kind: "Io", message: "the disk is full" };
          return null;
        default:
          return null;
      }
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
}, { DOC });

const calls = (name) => page.evaluate((n) => window.__calls.filter((c) => c.command === n), name);
const setPath = (path) => page.evaluate((p) => { window.__nextPath = p; }, path);

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tree");
await page.getByRole("button", { name: "What protein is" }).first().click();
await page.waitForSelector(".prose .ProseMirror");

await page.getByRole("button", { name: "Export" }).click();
await page.waitForSelector(".export-panel");
const panel = page.locator(".export-panel");
const text = await panel.innerText();
check("the panel offers a PDF, a web page, Word, OpenDocument and plain text",
  ["PDF", ".pdf", "Web page", ".html", "Word document", ".docx", "OpenDocument", ".odt", "Plain text", ".txt"].every((t) => text.includes(t)), text);
const offered = await panel.locator(".choice strong").allInnerTexts();
check("in that order", JSON.stringify(offered.map((t) => t.split(" ")[0])) === JSON.stringify(["PDF", "Web", "Word", "OpenDocument", "Plain"]), JSON.stringify(offered));
check("a PDF is chosen to begin with", await panel.getByRole("radio").first().isChecked() && (await panel.locator(".choice").first().innerText()).startsWith("PDF"));

// Plain text, saved where the dialog says.
await panel.getByText("Plain text").click();
await setPath("/home/you/exports/What protein is.txt");
await panel.getByRole("button", { name: "Save as…" }).click();
await page.waitForSelector(".export-panel [role=status]");
const asked = (await calls("plugin:dialog|save")).at(-1)?.args?.options;
check("the dialog suggests the title, with .txt", asked?.defaultPath === "What protein is.txt", JSON.stringify(asked));
check("and offers only plain text files", JSON.stringify(asked?.filters) === JSON.stringify([{ name: "Plain text", extensions: ["txt"] }]), JSON.stringify(asked?.filters));
let exported = await calls("document_export");
check("the shell is told what to write and where", JSON.stringify(exported.at(-1)?.args) === JSON.stringify({ document: DOC, format: "text", path: "/home/you/exports/What protein is.txt" }), JSON.stringify(exported));
check("and the panel says where it went", (await panel.locator("[role=status]").innerText()).includes("What protein is.txt") && (await panel.locator("[role=status]").innerText()).includes("in exports"));

// A Word document, named and filtered as one.
await panel.getByText("Word document").click();
await setPath("/home/you/exports/What protein is.docx");
await panel.getByRole("button", { name: "Save as…" }).click();
await page.waitForFunction(() => window.__calls.filter((c) => c.command === "document_export").length >= 2);
const askedWord = (await calls("plugin:dialog|save")).at(-1)?.args?.options;
check("Word: the dialog suggests .docx and offers only Word files",
  askedWord?.defaultPath === "What protein is.docx" && JSON.stringify(askedWord?.filters) === JSON.stringify([{ name: "Word document", extensions: ["docx"] }]),
  JSON.stringify(askedWord));
check("and the shell is told docx", (await calls("document_export")).at(-1)?.args?.format === "docx");

// Dismissing the dialog exports nothing.
await setPath(null);
const before = (await calls("document_export")).length;
await panel.getByRole("button", { name: "Save as…" }).click();
await page.waitForTimeout(300);
check("closing the dialog exports nothing", (await calls("document_export")).length === before);

// Words typed a moment ago reach the disk before the export reads it.
await panel.getByTitle("Close").click();
await page.locator(".prose .ProseMirror").click();
await page.keyboard.press("End");
await page.keyboard.type(" Eggs are complete.");
await page.getByRole("button", { name: "Export" }).click();
await setPath("/home/you/exports/What protein is.pdf");
await page.locator(".export-panel").getByRole("button", { name: "Save as…" }).click();
await page.waitForSelector(".export-panel [role=status]");
const order = await page.evaluate(() => window.__calls.map((c) => c.command).filter((c) => c === "document_write" || c === "document_export"));
const lastWrite = order.lastIndexOf("document_write");
const lastExport = order.lastIndexOf("document_export");
const written = (await calls("document_write")).at(-1)?.args?.body ?? "";
check("the newest words are saved before the export", lastWrite !== -1 && lastWrite < lastExport && written.includes("Eggs are complete."), JSON.stringify({ order, written }));
exported = await calls("document_export");
check("as a PDF, by default", exported.at(-1)?.args?.format === "pdf");
const askedPdf = (await calls("plugin:dialog|save")).at(-1)?.args?.options;
check("PDF: the dialog suggests .pdf and offers only PDF files",
  askedPdf?.defaultPath === "What protein is.pdf" && JSON.stringify(askedPdf?.filters) === JSON.stringify([{ name: "PDF", extensions: ["pdf"] }]),
  JSON.stringify(askedPdf));

// A failure is shown, not swallowed.
await setPath("/home/you/exports/fail.pdf");
await page.locator(".export-panel").getByRole("button", { name: "Save as…" }).click();
await page.waitForSelector(".export-panel .error");
check("a failure says what went wrong", (await page.locator(".export-panel .error").innerText()).includes("the disk is full"));

if (process.argv[2]) await page.locator(".editor").screenshot({ path: process.argv[2] });
await browser.close();
finish();

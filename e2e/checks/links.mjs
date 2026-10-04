// Links and backlinks in a real browser, with a stub engine behind it.
//
// The node view is the reason this exists: a link on disk is an identifier, and what has to
// appear on screen is the title of the document it points at. Nothing short of a real editor
// with a real React tree draws that.

import { check, finish, launch, URL } from "../support.mjs";

const HERE = "01J8ZQ7B2N4Q6S8W0W2Y4A6C8E";
const THERE = "01J8ZQ7B2N4Q6S8W0W2Y4A6C8F";
const NESTED = "01J8ZQ7B2N4Q6S8W0W2Y4A6C8G";
const GONE = "01J8ZQ9C3P5R7T9V1X3Z5B7D9F";

const BODY = [
  "Protein is built from amino acids.",
  "",
  `See [[${THERE}]] for the kinds.`,
  "",
  `And [[${GONE}]], which is not there any more.`,
].join("\n");

const browser = await launch();
const page = await browser.newPage();

page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(
  ({ body, here, there, nested }) => {
    const written = [];
    window.__written = written;
    let revision = "1";

    const TITLES = {
      [here]: "What protein is",
      [there]: "Types of protein",
      [nested]: "How protein is used",
    };

    const doc = (id) => ({
      id,
      title: TITLES[id] ?? "Untitled",
      topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B7D",
      body: id === here ? (written.length > 0 ? written[written.length - 1] : body) : "",
      revision,
      modified: "2026-09-01T00:00:00Z",
    });

    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        switch (command) {
          case "plugin:dialog|open":
            return "/home/user/Learning";
          case "library_open":
          case "library_create":
          case "library_status":
            return { name: "Learning", topics: 2, documents: 3, writable: true, problems: [] };
          case "topic_tree":
            return [
              {
                id: "01J8ZQ6A1M3P5R7T9V1X3Z5B7D",
                name: "Protein",
                documents: [
                  { id: here, title: TITLES[here] },
                  { id: there, title: TITLES[there] },
                ],
                children: [
                  {
                    id: "01J8ZQ6A1M3P5R7T9V1X3Z5B7E",
                    name: "In the body",
                    documents: [{ id: nested, title: TITLES[nested] }],
                    children: [],
                  },
                ],
              },
            ];
          case "document_read":
            return doc(args.document);
          case "document_write":
            written.push(args.body);
            revision = String(Number(revision) + 1);
            return doc(args.document);
          case "document_backlinks":
            // Only the document being read from is linked to by another.
            return args.document === there
              ? [{ id: here, title: TITLES[here] }]
              : [];
          default:
            return null;
        }
      },
    };
  },
  { body: BODY, here: HERE, there: THERE, nested: NESTED },
);

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.getByRole("button", { name: "What protein is" }).first().click();
await page.waitForSelector(".prose .ProseMirror");

// ---- a link reads as a title -----------------------------------------------------

check(
  "a link is drawn as the title of what it points at",
  (await page.locator(".prose button.doc-link-open").innerText()) === "Types of protein",
  await page.locator(".prose .doc-link").first().innerText(),
);

check(
  "and not as the identifier that is on disk",
  !(await page.locator(".prose").innerText()).includes(THERE),
);

check(
  "a link to a document that is gone says so",
  (await page.locator(".prose .doc-link.missing").innerText()).includes("missing document"),
);

// ---- following one ---------------------------------------------------------------

await page.locator(".prose button.doc-link-open").click();
await page.waitForFunction(
  () => window.document.querySelector(".editor h2")?.innerText.includes("Types of protein"),
  null,
  { timeout: 5000 },
);
check("clicking a link opens that document", true);

// ---- and the backlink is waiting there -------------------------------------------

await page.waitForSelector(".backlinks");
check(
  "the document it came from is listed under Linked from",
  (await page.locator(".backlinks li button").allTextContents()).join("|") ===
    "What protein is",
);

await page.locator(".backlinks li button").click();
await page.waitForFunction(
  () => window.document.querySelector(".editor h2")?.innerText.includes("What protein is"),
  null,
  { timeout: 5000 },
);
check("and a backlink is a way back", true);

check(
  "a document nothing links to shows no panel at all",
  (await page.locator(".backlinks").count()) === 0,
  "an empty heading is a promise the page is not keeping",
);

// ---- making a link ---------------------------------------------------------------

await page.getByRole("button", { name: "Link", exact: true }).click();
check("the link picker opens", (await page.getByText("Link to a document").count()) === 1);

const offered = await page.locator(".cite-option strong").allTextContents();
check(
  "it offers the other documents, however deep",
  offered.sort().join("|") === "How protein is used|Types of protein",
  JSON.stringify(offered),
);

check(
  "and not the one being written",
  !offered.includes("What protein is"),
);

check(
  "each one says where it lives",
  (await page.locator(".cite-option .source-meta").allTextContents()).includes(
    "Protein › In the body",
  ),
);

// Close it, put the cursor at the end, and do it for real. The picker stays open until it is
// cancelled or something is chosen — the same as the citation picker beside it.
await page.getByRole("button", { name: "×" }).click();
await page.locator(".prose .ProseMirror").click();
await page.keyboard.press("Control+End");
await page.getByRole("button", { name: "Link", exact: true }).click();
await page.locator(".cite-option", { hasText: "How protein is used" }).click();

await page.waitForFunction(
  (id) => window.__written.some((b) => b.includes(`[[${id}]]`)),
  NESTED,
  { timeout: 5000 },
);
check("choosing one writes the identifier into the file", true);

check(
  "and it is drawn as a title straight away",
  (await page.locator(".prose button.doc-link-open").allTextContents()).includes(
    "How protein is used",
  ),
);

const saved = await page.evaluate(() => window.__written[window.__written.length - 1]);
check(
  "the rest of the document is untouched",
  saved.startsWith(BODY),
  JSON.stringify(saved),
);

await browser.close();

finish();

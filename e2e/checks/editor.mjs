// The editor screen in a real browser, with a stub engine behind it.
//
// This is the pass that catches what jsdom and vitest cannot — a node view that
// renders nothing, a style that collapses, a toolbar button wired to the wrong command. The
// documents below go in as text on disk and have to come back out as the same text.

import { check, finish, launch, URL } from "../support.mjs";

// One PNG, small and real, so an `img` either draws it or visibly does not.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=";

const BODY = [
  "# What protein is",
  "",
  "Protein is built from amino acids.[^cite:01J8ZQ8D4Q6S8W0W2Y4A6C8E0G@44]",
  "",
  "## In the body",
  "",
  "![Amino acid diagram](diagram.png)",
  "",
  "As shown ![here](inline.png) the bond forms.",
  "",
  "![Deleted by hand](gone.png)",
  "",
  "###### The deepest heading",
  "",
  "####### Not a heading",
  "",
  "See [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]].",
].join("\n");

const browser = await launch();
const page = await browser.newPage();

page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(
  ({ body, png }) => {
    const written = [];
    window.__written = written;
    const attached = [];
    window.__attached = attached;

    let revision = "1";
    const doc = () => ({
      id: "01J8ZQ7B2N4Q6S8W0W2Y4A6C8E",
      title: "What protein is",
      topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B7D",
      body: written.length > 0 ? written[written.length - 1] : body,
      revision,
      created: "2026-09-01T00:00:00Z",
      modified: "2026-09-01T00:00:00Z",
    });

    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        const status = {
          name: "Learning",
          topics: 1,
          documents: 1,
          writable: true,
          problems: [],
        };
        switch (command) {
          // The file dialog is a plugin command, and it goes through the same bridge. The
          // library picker asks for a folder; the picture picker asks for a file.
          case "plugin:dialog|open":
            return args?.options?.directory
              ? "/home/user/Learning"
              : "/home/user/Downloads/Muscle Repair.png";
          case "library_open":
          case "library_create":
          case "library_status":
            return status;
          case "topic_tree":
            return [
              {
                id: "01J8ZQ6A1M3P5R7T9V1X3Z5B7D",
                name: "Protein",
                children: [],
                documents: [{ id: doc().id, title: doc().title }],
              },
            ];
          case "document_read":
            return doc();
          case "document_write":
            written.push(args.body);
            revision = String(Number(revision) + 1);
            return doc();
          case "citation_format_many":
            return args.requests.map(() => "(Nieminen, 2021, p. 44)");
          case "citation_reference_list":
            return ["Nieminen, A. M. (2021). *Ravinto ja terveys*. Otava."];
          case "document_image":
            // `gone.png` is the picture somebody deleted from the folder by hand.
            return args.name === "gone.png" ? null : `data:image/png;base64,${png}`;
          case "document_attach_image":
            attached.push(args);
            return "picked.png";
          default:
            return null;
        }
      },
    };
  },
  { body: BODY, png: PNG },
);

await page.goto(URL, { waitUntil: "networkidle" });

// Through the library picker, the way the application actually starts.
await page.getByRole("button", { name: "Open an existing one…" }).click();

// Open the document.
await page.getByRole("button", { name: "What protein is" }).first().click();
await page.waitForSelector(".prose .ProseMirror");

// ---- what the editor drew ------------------------------------------------------

const h1 = await page.locator(".prose h1").allTextContents();
check("a first-level heading is drawn", h1.includes("What protein is"), JSON.stringify(h1));

const h2 = await page.locator(".prose h2").allTextContents();
check("a sub-heading is drawn", h2.includes("In the body"), JSON.stringify(h2));

const h6 = await page.locator(".prose h6").allTextContents();
check("the deepest heading is drawn", h6.includes("The deepest heading"), JSON.stringify(h6));

check(
  "seven hashes stay prose",
  (await page.locator(".prose p", { hasText: "####### Not a heading" }).count()) === 1,
);

const sizes = await page.evaluate(() =>
  ["h1", "h2", "h3", "p"].map((tag) => {
    const el = window.document.querySelector(`.prose ${tag}`);
    return el ? parseFloat(getComputedStyle(el).fontSize) : null;
  }),
);
check(
  "a heading is visibly larger than the prose",
  sizes[0] > sizes[1] && sizes[1] > sizes[3],
  JSON.stringify(sizes),
);

// `.picture img`, not `.prose img`: ProseMirror puts its own zero-size separator image after
// every inline atom, so the loose selector counts three that are not pictures at all.
const drawn = await page.evaluate(() =>
  [...window.document.querySelectorAll(".prose .picture img")].map((i) => ({
    alt: i.getAttribute("alt"),
    src: (i.getAttribute("src") ?? "").slice(0, 22),
  })),
);
check(
  "both pictures are drawn, and from the bytes the engine gave",
  drawn.length === 2 && drawn.every((i) => i.src === "data:image/png;base64,"),
  JSON.stringify(drawn),
);

const box = await page.locator('.prose img[alt="Amino acid diagram"]').boundingBox();
check("a picture has a size on the page", box !== null && box.width > 0 && box.height > 0);

check(
  "a picture that is gone says so",
  (await page.locator(".picture-missing").innerText()).includes("gone.png"),
);

check(
  "a picture mid-sentence stays in the sentence",
  await page.evaluate(() => {
    const p = [...window.document.querySelectorAll(".prose p")].find((n) =>
      n.textContent.includes("the bond forms"),
    );
    return !!p && !!p.querySelector("img") && p.textContent.startsWith("As shown");
  }),
);

// ---- what it would write back --------------------------------------------------

await page.locator(".prose .ProseMirror").click();
await page.keyboard.press("Control+End");
await page.keyboard.type(" Typed.");
await page.waitForFunction(() => window.__written.length > 0, null, { timeout: 5000 });

const saved = await page.evaluate(() => window.__written[window.__written.length - 1]);
check(
  "everything but the typing comes back byte for byte",
  saved === BODY.replace("See [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]].", "See [[01J8ZQ9C3P5R7T9V1X3Z5B7D9F]]. Typed."),
  JSON.stringify(saved),
);

// ---- the toolbar ---------------------------------------------------------------

await page.locator(".prose p", { hasText: "####### Not a heading" }).click();
await page.getByRole("button", { name: "H3", exact: true }).click();
await page.waitForFunction(
  () => window.__written.some((b) => b.includes("### ####### Not a heading")),
  null,
  { timeout: 5000 },
);
check("the toolbar writes a heading into the file", true);

check(
  "the toolbar says which heading the cursor is in",
  (await page.getByRole("button", { name: "H3", exact: true }).getAttribute("aria-pressed")) ===
    "true",
);

// ---- adding a picture ----------------------------------------------------------

await page.getByRole("button", { name: "Picture" }).click();
check("the picture panel opens", (await page.getByText("Add a picture").count()) === 1);
check(
  "it says the copy is kept in the library",
  (await page.getByText("copied into your library").count()) === 1,
);

await page.getByRole("button", { name: "Choose a picture…" }).click();
check(
  "the file that was picked is named back",
  (await page.getByText("Muscle Repair.png").count()) === 1,
);
check(
  "copy or move is asked, and copy is the answer offered",
  (await page.getByText("Do you want to copy or move the file?").count()) === 1 &&
    (await page.locator(".cite-picker .choice input").first().isChecked()),
);
check(
  "the folder it would be taken out of is named",
  (await page.getByText("Takes it out of Downloads").count()) === 1,
);

await page.getByRole("button", { name: "Insert picture" }).click();
await page.waitForFunction(
  () => window.__written.some((b) => b.includes("![Muscle Repair](picked.png)")),
  null,
  { timeout: 5000 },
);
check("the picture is written into the file, under the engine's name", true);

const sent = await page.evaluate(() => window.__attached[0]);
check(
  "the engine is told which document, which file, and what to do with it",
  sent.document === "01J8ZQ7B2N4Q6S8W0W2Y4A6C8E" &&
    sent.path === "/home/user/Downloads/Muscle Repair.png" &&
    sent.keep === "copy",
  JSON.stringify(sent),
);
check(
  "and it is on screen straight away, not after the next save",
  (await page.locator('.prose .picture img[alt="Muscle Repair"]').count()) === 1,
);

await browser.close();

finish();

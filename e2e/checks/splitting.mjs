// Splitting a document, in a real browser with a stub engine behind it.
//
// The check that matters is the one nothing else can make: that the offsets the editor sends
// pick out the words the person highlighted. The stub does the split the way the engine does
// — by slicing the body it was given — so a wrong offset shows up as the wrong text moving,
// which is exactly how it would show up to a user.

import { check, finish, launch, URL } from "../support.mjs";

const HERE = "01J8ZQ7B2N4Q6S8W0W2Y4A6C8E";
const CITE = "01J8ZQ8D4Q6S8W0W2Y4A6C8E0G";

const BODY = [
  "# What protein is",
  "",
  "Protein is built from amino acids.",
  "",
  "## Types of protein",
  "",
  `Complete proteins contain all nine.[^cite:${CITE}]`,
  "",
  // `@page:44` is refused as a locator, so this one stays **literal text** in the editor —
  // which is what lets a selection boundary land inside it, and what left `3R4QFEM]` in a
  // real library.
  `Wikipedia says so.[^cite:${CITE}@page:44] Indeed.`,
  "",
  "And that is the end.",
].join("\n");

const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", (e) => check("no page errors", false, e.message));

await page.addInitScript(
  ({ body, here }) => {
    const calls = [];
    window.__calls = calls;
    let current = body;
    let revision = "1";

    const doc = (id, text) => ({
      id,
      title: id === here ? "What protein is" : "Taken",
      topic: "01J8ZQ6A1M3P5R7T9V1X3Z5B7D",
      body: text,
      revision,
      modified: "2026-09-01T00:00:00Z",
    });

    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        calls.push({ command, args });
        switch (command) {
          case "plugin:dialog|open":
            return "/home/user/Learning";
          case "library_open":
          case "library_create":
          case "library_status":
            return { name: "Learning", topics: 1, documents: 1, writable: true, problems: [] };
          case "topic_tree":
            return [
              {
                id: "01J8ZQ6A1M3P5R7T9V1X3Z5B7D",
                name: "Protein",
                documents: [{ id: here, title: "What protein is" }],
                children: [],
              },
            ];
          case "document_read":
            return doc(args.document, current);
          case "document_write":
            current = args.body;
            revision = String(Number(revision) + 1);
            return doc(args.document, current);
          case "document_backlinks":
            return [];
          case "citation_format_many":
            return args.requests.map(() => "(Nieminen, 2021)");
          case "citation_reference_list":
            return ["Nieminen, A. M. (2021). *Ravinto ja terveys*. Otava."];
          case "document_split": {
            // The engine's own arithmetic: take the range out, put a link in its place.
            const taken = current.slice(args.start, args.end).trim();
            const newId = "01J8ZQ7B2N4Q6S8W0W2Y4A6C8Z";
            current =
              current.slice(0, args.start) + `[[${newId}]]` + current.slice(args.end);
            revision = String(Number(revision) + 1);
            window.__taken = taken;
            return { original: doc(here, current), taken: doc(newId, taken) };
          }
          default:
            return null;
        }
      },
    };
  },
  { body: BODY, here: HERE },
);

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open an existing one…" }).click();
await page.getByRole("button", { name: "What protein is" }).first().click();
await page.waitForSelector(".prose .ProseMirror");

const splitButton = page.getByRole("button", { name: "Split", exact: true });

// ---- it says when it cannot be used ----------------------------------------------

check("with nothing selected the button is off", await splitButton.isDisabled());

// ---- select from the sub-heading to the end of the citation ----------------------

// Select the "Types of protein" heading and the paragraph under it, with the keyboard, the
// way a person would. Driving the editor rather than the DOM matters: a range set with
// `getSelection` never reaches ProseMirror's state, so the positions under test would be the
// ones left over from the click.
await page.locator('.prose h2:has-text("Types of protein")').click({ position: { x: 2, y: 8 } });
await page.keyboard.press("Home");
const paragraph = page.locator('.prose p:has-text("Complete proteins")');
const box = await paragraph.boundingBox();
await paragraph.click({
  modifiers: ["Shift"],
  position: { x: box.width - 2, y: box.height - 4 },
});

await page.waitForFunction(
  () => {
    const b = window.document.querySelector('button.tool[title^="Take the selected"]');
    window.__probe = {
      found: b !== null,
      disabled: b?.disabled,
      selected: String(window.getSelection() ?? ""),
    };
    return b !== null && !b.disabled;
  },
  null,
  { timeout: 5000 },
).catch(async () => {
  console.log("PROBE>>>", JSON.stringify(await page.evaluate(() => window.__probe)));
  throw new Error("the Split button never turned on");
});
check("with something selected it turns on", await splitButton.isEnabled());

await splitButton.click();
await page.waitForSelector(".split-preview");

check(
  "the title is suggested from the heading that was selected",
  (await page.locator(".cite-picker input").inputValue()) === "Types of protein",
  await page.locator(".cite-picker input").inputValue(),
);

const preview = await page.locator(".split-preview p").innerText();
check(
  "and what will move is shown",
  preview.includes("Types of protein") && preview.includes("Complete proteins"),
  preview,
);
check(
  "without dragging in the paragraph after it",
  !preview.includes("And that is the end"),
  preview,
);

// ---- do it -----------------------------------------------------------------------

await page.getByRole("button", { name: "Split", exact: true }).nth(1).click();
await page.waitForFunction(() => window.__taken !== undefined, null, { timeout: 5000 });

const taken = await page.evaluate(() => window.__taken);
check(
  "exactly the highlighted text moves",
  taken === `## Types of protein\n\nComplete proteins contain all nine.[^cite:${CITE}]`,
  JSON.stringify(taken),
);

// ---- and what is left behind -------------------------------------------------------

const left = await page.evaluate(() => {
  const writes = window.__calls.filter((c) => c.command === "document_write");
  return writes.length === 0 ? null : writes[writes.length - 1].args.body;
});
check(
  "the document was flushed to disk before it was measured",
  left === BODY,
  left === null
    ? "nothing was written at all, so the offsets were measured against a file the engine never saw"
    : "the split was computed against text the engine did not have",
);

const shown = await page.locator(".prose").innerText();
check(
  "the editor now shows the link instead of the text",
  !shown.includes("Complete proteins") && shown.includes("What protein is"),
  shown,
);
check(
  "and the text after the split is still there",
  shown.includes("And that is the end"),
  shown,
);
/**
 * Nothing anywhere may hold half a marker.
 *
 * Take every well-formed construct out and there should be no bracket left — this document
 * has none of its own. A whole citation also ends in an identifier and a `]`, so looking for
 * that shape directly finds the good ones too; what says something went wrong is a bracket
 * that belongs to nothing.
 */
async function noHalfMarkers(where) {
  const texts = await page.evaluate(() =>
    window.__calls
      .filter((c) => c.command === "document_write")
      .map((c) => c.args.body)
      .concat(window.__taken === undefined ? [] : [window.__taken]),
  );
  const debris = texts
    .map((t) => t.replace(/\[\^cite:[^\]\n]*\]|\[\[[^\]\n]*\]\]|!\[[^\]\n]*\]\([^)\n]*\)/g, ""))
    .filter((t) => /[[\]]/.test(t));
  check(`nothing was cut in half ${where}`, debris.length === 0, JSON.stringify(debris));
}

await noHalfMarkers("by the first split");

// ---- the revision carried forward ---------------------------------------------------

await page.locator(".prose .ProseMirror").click();
await page.keyboard.press("Control+End");
await page.keyboard.type(" Still typing.");
await page.waitForFunction(
  () => window.__calls.some((c) => c.command === "document_write" && c.args.body.includes("Still typing.")),
  null,
  { timeout: 5000 },
);
// Read the message only when there is one: a locator that matches nothing waits for it.
const conflict = page.locator(".editor .warning, .editor .error");
check(
  "typing after a split still saves, rather than being refused as a conflict",
  (await conflict.count()) === 0,
  (await conflict.count()) === 0 ? "" : await conflict.first().innerText(),
);

// ---- a selection that ends inside a marker the editor never drew ------------------

// The reported defect. `[^cite:…@page:44]` is literal text in the editor, so a boundary can
// land in the middle of it — and half an identifier is a file carrying nothing.
await page.locator('.prose p:has-text("Wikipedia says so")').click({ position: { x: 4, y: 8 } });
await page.keyboard.press("Home");
for (let i = 0; i < 30; i += 1) await page.keyboard.press("Shift+ArrowRight");

await splitButton.click();
await page.waitForSelector(".split-preview");

check(
  "it says the selection will be stretched",
  (await page.locator(".cite-picker .warning").count()) === 1,
  await page.locator(".cite-picker").innerText(),
);

// No heading was selected this time, so there is nothing to suggest and the button stays off
// until the document is named — which is the right way round.
check(
  "with nothing to suggest, it will not split until you name it",
  await page.getByRole("button", { name: "Split", exact: true }).nth(1).isDisabled(),
);
await page.locator(".cite-picker input").fill("Wikipedia");

await page.getByRole("button", { name: "Split", exact: true }).nth(1).click();
await page.waitForFunction(
  () => window.__taken !== undefined && window.__taken.includes("Wikipedia says so"),
  null,
  { timeout: 5000 },
);

const second = await page.evaluate(() => window.__taken);
check(
  "and the whole citation goes with it",
  second.includes(`[^cite:${CITE}@page:44]`),
  JSON.stringify(second),
);
await noHalfMarkers("by the second split");

await browser.close();

finish();

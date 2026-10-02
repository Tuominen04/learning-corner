import { describe, expect, it } from "vitest";

import { EXPORT_FORMATS, exportName } from "./export";

describe("the file an export suggests", () => {
  it("is the document's title with the format's extension", () => {
    expect(exportName("What protein is", "html")).toBe("What protein is.html");
    expect(exportName("What protein is", "text")).toBe("What protein is.txt");
  });

  it("keeps a title in Finnish or Russian as it is", () => {
    expect(exportName("Proteiinin tarve ja ääkköset", "text")).toBe("Proteiinin tarve ja ääkköset.txt");
    expect(exportName("Белок в питании", "html")).toBe("Белок в питании.html");
  });

  it("changes only what a file name cannot hold", () => {
    expect(exportName("Protein: A review", "html")).toBe("Protein - A review.html");
    expect(exportName("Is protein essential?", "html")).toBe("Is protein essential.html");
    expect(exportName("Plant and/or animal", "text")).toBe("Plant and-or animal.txt");
    expect(exportName('"Quoted" <title> | *starred*', "text")).toBe("Quoted title starred.txt");
    expect(exportName("Tab\there", "text")).toBe("Tab-here.txt");
  });

  it("is never hidden, and never nameless", () => {
    // A leading dot hides a file on Linux and macOS.
    expect(exportName("...notes", "text")).toBe("notes.txt");
    expect(exportName("   ", "html")).toBe("Document.html");
    expect(exportName("..", "html")).toBe("Document.html");
  });
});

describe("the formats offered", () => {
  it("offers a PDF first, then a web page, then the two to edit in, then plain text", () => {
    expect(EXPORT_FORMATS.map((f) => [f.value, f.extension])).toEqual([
      ["pdf", "pdf"],
      ["html", "html"],
      ["docx", "docx"],
      ["odt", "odt"],
      ["text", "txt"],
    ]);
  });

  it("suggests the right extension for an office file or a PDF", () => {
    expect(exportName("What protein is", "docx")).toBe("What protein is.docx");
    expect(exportName("What protein is", "odt")).toBe("What protein is.odt");
    expect(exportName("Белок в питании", "pdf")).toBe("Белок в питании.pdf");
  });
});

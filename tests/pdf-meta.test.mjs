import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { applyMetadata, buildMetadata, hasTextLayer } from "../src/pdf-meta.mjs";
import { readFrontmatter, readOverrides } from "../src/overrides.mjs";

const CV = `---
name: Jane Doe
headline: Technical Writer
email: jane@example.com
phone: 000-000
location: Nowhere
website: https://example.com | Portfolio
---

Summary.

## Skills

### Docs

writing, editing

### Tools

Git, writing
`;

test("buildMetadata derives fields and de-duplicated skill keywords", () => {
  assert.deepEqual(buildMetadata(CV), {
    title: "Jane Doe - Technical Writer",
    author: "Jane Doe",
    subject: "Technical Writer",
    keywords: "writing, editing, Git",
    creator: "CV Live Preview",
    producer: "CV Live Preview",
  });
});

test("frontmatter keywords beat skills, overrides beat both", () => {
  const withKw = CV.replace("---\n\nSummary", "keywords: [docs, api]\n---\n\nSummary");
  assert.equal(buildMetadata(withKw).keywords, "docs, api");
  assert.equal(buildMetadata(withKw, { pdfKeywords: "a, b", pdfTitle: "T" }).keywords, "a, b");
  assert.equal(buildMetadata(withKw, { pdfTitle: "T" }).title, "T");
});

test("roundtrip through pdf-lib", async () => {
  const doc = await PDFDocument.create();
  doc.addPage().drawText("Hello", { font: await doc.embedFont(StandardFonts.Helvetica) });
  const md = buildMetadata(CV);
  const out = await PDFDocument.load(await applyMetadata(await doc.save(), md), { updateMetadata: false });
  assert.equal(out.getTitle(), md.title);
  assert.equal(out.getAuthor(), "Jane Doe");
  assert.equal(out.getSubject(), "Technical Writer");
  assert.equal(out.getKeywords(), "writing, editing, Git");
  assert.equal(out.getCreator(), "CV Live Preview");
  assert.equal(out.getProducer(), "CV Live Preview");
  assert.equal(out.getPageCount(), 1);
});

test("hasTextLayer sees fonts and rejects font-less PDFs", async () => {
  const withText = await PDFDocument.create();
  withText.addPage().drawText("Hi", { font: await withText.embedFont(StandardFonts.Helvetica) });
  assert.equal(hasTextLayer(await withText.save({ useObjectStreams: false })), true);
  const blank = await PDFDocument.create();
  blank.addPage();
  assert.equal(hasTextLayer(await blank.save({ useObjectStreams: false })), false);
});

test("overrides read from frontmatter and never throw", () => {
  const src = `---\nname: Jane\ncv-export-folder: "Exports"\ncv-filename: {name} {variant}\ncv-pdf-keywords: a, b\n---\n`;
  assert.deepEqual(readOverrides(src), { exportFolder: "Exports", filenameTemplate: "{name} {variant}", pdfKeywords: "a, b" });
  assert.deepEqual(readOverrides("no frontmatter"), {});
  assert.equal(readFrontmatter("---\nbroken line\nvariant: Backend\n---").variant, "Backend");
});

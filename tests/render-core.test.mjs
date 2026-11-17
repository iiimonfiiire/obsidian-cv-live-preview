import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCv, renderHtml } from "../src/render-core.mjs";

const FRONT = `---
name: Test Person
headline: Technical Writer
email: test@example.com
phone: 000-000
location: Nowhere
website: https://example.com/?a=1 | Portfolio
type: cv
status: draft
base-master: "[[Some Master]]"
---
`;

const FULL = `${FRONT}
Summary line with a docs-as-code mention.

## Experience

### Acme · Writer · 01/2020 – Present

- Wrote the docs.

## Projects

### Side project · 2023

- Built a thing.

## Technical

- Git, Python

## Open source and community

- Filed bugs.

## Skills

### Docs

writing, editing

## Education

### BSc · Physics · Some University · 2005

## Languages

- English | Native

## Fun fact

I build guitar pedals.
`;

const css = "body { color: #000; }";
const fontUrl = (f) => `font://${f}`;
const html = (src) => renderHtml(src, { css, fontUrl });
const between = (s, open, close) => s.slice(s.indexOf(open), s.indexOf(close));

test("parseCv reads frontmatter, summary, and every ## section", () => {
  const { meta, summary, sections } = parseCv(FULL);
  assert.equal(meta.name, "Test Person");
  assert.equal(meta.website, "https://example.com/?a=1 | Portfolio");
  assert.equal(summary, "Summary line with a docs-as-code mention.");
  assert.deepEqual(Object.keys(sections), [
    "Experience",
    "Projects",
    "Technical",
    "Open source and community",
    "Skills",
    "Education",
    "Languages",
    "Fun fact",
  ]);
});

test("parseCv keeps extra frontmatter properties without affecting rendering", () => {
  const { meta } = parseCv(FULL);
  assert.equal(meta.type, "cv");
  assert.equal(meta["base-master"], '"[[Some Master]]"');
});

test("parseCv does not split on ### item headings", () => {
  const { sections } = parseCv(FULL);
  assert.match(sections.Experience, /^### Acme/);
  assert.equal(Object.keys(sections).includes("Acme · Writer · 01/2020 – Present"), false);
});

test("parseCv throws without frontmatter", () => {
  assert.throws(() => parseCv("## Experience\n"), /missing frontmatter/);
});

test("a note with no sections gives an empty section map", () => {
  const { summary, sections } = parseCv(`${FRONT}\nJust a summary.\n`);
  assert.equal(summary, "Just a summary.");
  assert.deepEqual(sections, {});
});

test("renderHtml puts Experience and Projects in main", () => {
  const out = html(FULL);
  const main = between(out, "<main>", "</main>");
  assert.match(main, /<h2>Experience<\/h2>/);
  assert.match(main, /<h2>Projects<\/h2>/);
  assert.doesNotMatch(main, /<h2>Technical<\/h2>/);
});

test("renderHtml puts the sidebar sections in aside, in order", () => {
  const aside = between(html(FULL), "<aside>", "</aside>");
  const order = ["Technical", "Open source and community", "Skills", "Education", "Languages", "Fun fact"].map(
    (t) => aside.indexOf(`<h2>${t}</h2>`),
  );
  assert.ok(order.every((i) => i >= 0), "every sidebar section renders");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "sections keep the expected order");
});

test("optional sections are omitted when absent", () => {
  const out = html(`${FRONT}\nSummary.\n\n## Skills\n\n### Docs\n\nwriting\n`);
  for (const t of ["Technical", "Open source and community", "Fun fact", "Experience"]) {
    assert.doesNotMatch(out, new RegExp(`<h2>${t}</h2>`));
  }
  assert.match(out, /<h2>Skills<\/h2>/);
});

test("unknown sections are ignored", () => {
  const out = html(`${FULL}\n## Hobbies\n\nChess.\n`);
  assert.doesNotMatch(out, /Hobbies/);
});

test("renderHtml renders Markdown inside the free-text sections", () => {
  const out = html(FULL);
  assert.match(out, /<li>Git, Python<\/li>/);
  assert.match(out, /<p>I build guitar pedals\.<\/p>/);
});

test("renderHtml rewrites font placeholders through fontUrl", () => {
  const out = renderHtml(FULL, { css: "src: url(FONTDIR/Figtree-400.ttf);", fontUrl });
  assert.match(out, /font:\/\/Figtree-400\.ttf/);
  assert.doesNotMatch(out, /FONTDIR/);
});

test("skill keywords are separated by plain commas", () => {
  const out = html(`${FRONT}\nSummary.\n\n## Skills\n\n### Docs\n\nwriting, editing, docs-as-code\n`);
  assert.match(out, /<p class="kw">Writing, editing, <span class="nb">docs-as-code<\/span><\/p>/);
  assert.doesNotMatch(out, /·/);
});

test("Markdown links in item headings render as links", () => {
  const out = html(
    `${FRONT}\nSummary.\n\n## Experience\n\n### [Acme](https://acme.example/x) · [Writer](https://acme.example/w) · 2020\n\n- Did it.\n\n## Projects\n\n### [Side project](https://example.com/p) · 2023\n\n- Built it.\n`,
  );
  assert.match(out, /<span class="company"><a href="https:\/\/acme\.example\/x">Acme<\/a><\/span>/);
  assert.match(out, /<span class="position"><a href="https:\/\/acme\.example\/w">Writer<\/a><\/span>/);
  assert.match(out, /<span class="company"><a href="https:\/\/example\.com\/p">Side project<\/a><\/span>/);
  assert.doesNotMatch(out, /\]\(https/);
});

test("heading links are underlined in the stylesheet", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../src/themes/modern.css", import.meta.url), "utf8");
  assert.match(css, /\.item-head a\s*\{[^}]*text-decoration:\s*underline/);
});

test("long position titles span the full width so they do not wrap under the date", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../src/themes/modern.css", import.meta.url), "utf8");
  assert.match(css, /\.position\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
});

test("hyphenated words are kept unbroken", () => {
  assert.match(html(FULL), /<span class="nb">docs-as-code<\/span>/);
});

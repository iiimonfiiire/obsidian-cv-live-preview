import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_THEME, THEMES, THEME_IDS, getTheme, isThemeId } from "../src/themes.mjs";
import { parseLink, renderHtml } from "../src/render-core.mjs";
import { fitPages, pageEndPx } from "../src/pagination.mjs";
import { readOverrides, setFrontmatterKey } from "../src/overrides.mjs";
import { lintCv } from "../src/lint.mjs";

const CV = `---
name: Jane Doe
headline: Technical Writer
email: jane@example.com
phone: 000-000
location: Nowhere
linkedin: https://www.linkedin.com/in/jane
github: https://github.com/jane
website: https://example.com | Portfolio
---

Summary.

## Experience

### Acme · Writer · 01/2020 – Present

- Wrote docs.

## Education

### BSc · Physics · Some University · 2005
`;

const render = (id, src = CV) => {
  const theme = getTheme(id);
  return renderHtml(src, { css: "", fontUrl: (f) => f, theme });
};

test("registry has three themes and a valid default", () => {
  assert.deepEqual(THEME_IDS, ["classic", "a", "b"]);
  assert.ok(isThemeId(DEFAULT_THEME));
  assert.equal(getTheme("nope").id, DEFAULT_THEME);
  assert.equal(getTheme("", "classic").id, "classic");
  assert.equal(getTheme(" B ").id, "b");
});

test("every theme stylesheet exists", async () => {
  for (const t of THEMES) {
    const css = await readFile(new URL(`../src/themes/${t.cssFile}`, import.meta.url), "utf8");
    assert.ok(css.length > 100, t.id);
  }
});

test("layout variants set a body class", () => {
  assert.match(render("a"), /<body>/);
  assert.match(render("b"), /<body class="layout-single">/);
});

test("classic keeps the original one-page markup", () => {
  const out = render("classic");
  assert.match(out, /<div class="page">/);
  assert.match(out, /<div class="id">/);
  assert.match(out, /<div class="rule"><\/div>/);
  assert.match(out, /<span>Nowhere<\/span>/);
  assert.match(out, /<span class="sep"> • <\/span>/);
  assert.match(out, /<article class="edu">/);
  assert.match(out, /linkedin\.com\/in\/jane/);
});

test("modern markup has no location, a rule, and link icons", () => {
  const out = render("a");
  assert.doesNotMatch(out, /Nowhere/);
  assert.doesNotMatch(out, /class="page"/);
  assert.match(out, /<hr class="rule">/);
  assert.match(out, /href="https:\/\/github\.com\/jane"/);
});

test("parseLink handles bare urls and labels", () => {
  assert.deepEqual(parseLink("https://example.com | Portfolio"), { url: "https://example.com", label: "Portfolio" });
  assert.equal(parseLink("https://www.linkedin.com/in/jane/").label, "linkedin.com/in/jane");
  assert.equal(parseLink(""), null);
  assert.equal(parseLink(undefined), null);
});

test("cv-theme is read as an override", () => {
  assert.equal(readOverrides("---\nname: x\ncv-theme: classic\n---\n").theme, "classic");
  assert.equal(readOverrides("---\nname: x\n---\n").theme, undefined);
});

test("setFrontmatterKey edits one line and keeps the rest byte for byte", () => {
  const src = "---\nname: Jane\nwebsite: https://a.example | A\n---\nBody\n";
  const added = setFrontmatterKey(src, "cv-theme", "b");
  assert.equal(added, "---\nname: Jane\nwebsite: https://a.example | A\ncv-theme: b\n---\nBody\n");
  assert.equal(setFrontmatterKey(added, "cv-theme", "a"), added.replace("cv-theme: b", "cv-theme: a"));
  assert.equal(setFrontmatterKey(added, "cv-theme", ""), src);
  assert.equal(setFrontmatterKey("no frontmatter", "cv-theme", "a"), "no frontmatter");
  const crlf = "---\r\nname: Jane\r\n---\r\nBody";
  assert.equal(setFrontmatterKey(crlf, "cv-theme", "a"), "---\r\nname: Jane\r\ncv-theme: a\r\n---\r\nBody");
});

test("a one-page theme keeps the original fit wording", () => {
  const classic = getTheme("classic");
  const fit = fitPages({ contentBottomPx: 900, minBottomMarginPt: 30, geometry: classic.geometry, maxPages: 1, linePt: classic.linePt });
  assert.equal(fit.pages, 1);
  assert.equal(fit.level, "ok");
  assert.match(fit.text, /^Fits one page, \d+pt bottom margin$/);
  const over = fitPages({ contentBottomPx: 1200, minBottomMarginPt: 30, geometry: classic.geometry, maxPages: 1, linePt: classic.linePt });
  assert.equal(over.level, "over");
  assert.match(over.text, /^Overflows the page by \d+pt \(about \d+ lines?\)$/);
  assert.equal(over.guides.length, 1);
});

test("a two-page theme counts pages and flags a third", () => {
  const a = getTheme("a");
  const args = { minBottomMarginPt: 30, geometry: a.geometry, maxPages: 2, linePt: a.linePt };
  assert.equal(fitPages({ ...args, contentBottomPx: 800 }).pages, 1);
  const two = fitPages({ ...args, contentBottomPx: pageEndPx(1, a.geometry) + 300 });
  assert.equal(two.pages, 2);
  assert.equal(two.level, "ok");
  assert.equal(two.guides.length, 2);
  const three = fitPages({ ...args, contentBottomPx: pageEndPx(2, a.geometry) + 40 });
  assert.equal(three.level, "over");
  assert.match(three.text, /^Runs to 3 pages/);
});

test("lint: location optional, link and theme checks", () => {
  const base = "---\nname: A\nheadline: B\nemail: a@b.co\nphone: 1\nwebsite: https://x.co | X\n";
  const body = "---\n\nSummary.\n\n## Experience\n\n### Acme · Writer · 2020\n\n- Did.\n";
  assert.equal(lintCv(base + body).filter((i) => i.level === "error").length, 0);
  assert.ok(lintCv(`${base}linkedin: example\n${body}`).some((i) => /linkedin should be a URL/.test(i.message)));
  assert.ok(lintCv(`${base}cv-theme: zzz\n${body}`).some((i) => /cv-theme "zzz"/.test(i.message)));
  assert.equal(lintCv(`${base}cv-theme: classic\n${body}`).length, 0);
});

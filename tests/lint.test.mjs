import { test } from "node:test";
import assert from "node:assert/strict";
import { countLevels, lintCv } from "../src/lint.mjs";

const GOOD = `---
name: Jane Doe
headline: Technical Writer
email: jane@example.com
phone: 000-000
location: Nowhere
website: https://example.com | Portfolio
---

Summary text.

## Experience

### Acme · Writer · 01/2020 – Present

- Wrote docs.

## Skills

### Docs

writing, editing

## Education

### BSc · Physics · Some University · 2005

## Languages

- English | Native
`;

const find = (issues, re) => issues.find((i) => re.test(i.message));

test("a valid CV has no issues", () => {
  assert.deepEqual(lintCv(GOOD), []);
});

test("missing frontmatter does not throw", () => {
  const issues = lintCv("## Experience\n\n### A · B · 2020\n- x\n");
  assert.equal(issues[0].level, "error");
  assert.match(issues[0].message, /frontmatter/i);
  assert.doesNotThrow(() => lintCv(""));
  assert.doesNotThrow(() => lintCv(null));
  assert.doesNotThrow(() => lintCv("---\n"));
});

test("missing and empty required keys use real line numbers", () => {
  const src = GOOD.replace("email: jane@example.com\n", "").replace("phone: 000-000", "phone:");
  const issues = lintCv(src);
  assert.ok(find(issues, /Missing frontmatter key "email"/));
  assert.equal(find(issues, /"phone" is empty/).line, 4);
});

test("website must be url | label", () => {
  const issues = lintCv(GOOD.replace("https://example.com | Portfolio", "https://example.com"));
  const w = find(issues, /website/);
  assert.equal(w.level, "error");
  assert.equal(w.line, 7);
});

test("unknown section and empty section", () => {
  const issues = lintCv(`${GOOD}\n## Hobbies\n\nstuff\n\n## Projects\n`);
  assert.ok(find(issues, /Unknown section "Hobbies"/));
  assert.ok(find(issues, /Section "Projects" is empty/));
});

test("missing Experience is flagged", () => {
  assert.ok(find(lintCv(GOOD.replace(/## Experience[\s\S]*## Skills/, "## Skills")), /Missing section "Experience"/));
});

test("experience heading separators and period", () => {
  const sep = find(lintCv(GOOD.replace("### Acme · Writer · 01/2020 – Present", "### Acme Writer 2020")), /Company · Position/);
  assert.equal(sep.line, 14);
  assert.ok(find(lintCv(GOOD.replace("01/2020 – Present", "Jan 2020 to now")), /Period "Jan 2020 to now"/));
});

test("education needs three parts", () => {
  const issues = lintCv(GOOD.replace("BSc · Physics · Some University · 2005", "BSc · 2005"));
  assert.equal(find(issues, /Degree · Area · School/).level, "error");
});

test("skills group with no keyword line", () => {
  assert.equal(find(lintCv(GOOD.replace("writing, editing", "")), /no keyword line/).level, "error");
});

test("languages format", () => {
  const issues = lintCv(GOOD.replace("- English | Native", "- English\nFrench"));
  assert.equal(issues.filter((i) => /Languages lines/.test(i.message)).length, 2);
});

test("tabs warn and counts add up", () => {
  const issues = lintCv(GOOD.replace("- Wrote docs.", "-\tWrote docs."));
  assert.ok(find(issues, /Tab character/));
  assert.deepEqual(countLevels(issues), { errors: 0, warnings: 1 });
});

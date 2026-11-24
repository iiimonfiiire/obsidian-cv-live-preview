import { test } from "node:test";
import assert from "node:assert/strict";
import { detectCv, exportBlocker, looksLikeCv, setupMessage } from "../src/cv-detect.mjs";

const fm = (...lines) => `---\n${lines.join("\n")}\n---\n\nBody.\n`;

test("a complete CV is ok", () => {
  const d = detectCv(fm("name: A B", "headline: Writer"));
  assert.deepEqual(d, { ok: true, hasFrontmatter: true, missing: [] });
  assert.equal(setupMessage(d), null);
  assert.equal(exportBlocker(d), null);
  assert.ok(looksLikeCv(fm("name: A B", "headline: Writer")));
});

test("missing name", () => {
  const d = detectCv(fm("headline: Writer"));
  assert.deepEqual(d.missing, ["name"]);
  assert.equal(setupMessage(d), 'Missing "name" in frontmatter.');
  assert.equal(exportBlocker(d), 'Cannot export: missing "name" in frontmatter.');
});

test("missing headline", () => {
  const d = detectCv(fm("name: A B", "email: a@example.com"));
  assert.deepEqual(d.missing, ["headline"]);
  assert.equal(setupMessage(d), 'Missing "headline" in frontmatter.');
  assert.equal(looksLikeCv(fm("name: A B")), false);
});

test("missing both", () => {
  const d = detectCv(fm("email: a@example.com"));
  assert.deepEqual(d, { ok: false, hasFrontmatter: true, missing: ["name", "headline"] });
  assert.equal(setupMessage(d), 'Missing "name" and "headline" in frontmatter.');
});

test("no frontmatter", () => {
  for (const text of ["# Notes\n\nname: A\nheadline: B\n", "---\nname: A\nheadline: B\n"]) {
    const d = detectCv(text);
    assert.equal(d.hasFrontmatter, false);
    assert.deepEqual(d.missing, ["name", "headline"]);
    assert.equal(setupMessage(d), "Add name and headline to the frontmatter, or start from a sample.");
    assert.match(exportBlocker(d), /no frontmatter/);
  }
});

test("empty file and non-string input", () => {
  for (const text of ["", undefined, null]) {
    const d = detectCv(text);
    assert.equal(d.ok, false);
    assert.equal(d.hasFrontmatter, false);
  }
});

test("empty frontmatter block", () => {
  const d = detectCv("---\n---\nBody\n");
  assert.deepEqual(d, { ok: false, hasFrontmatter: true, missing: ["name", "headline"] });
});

test("Windows line endings", () => {
  const text = "---\r\nname: A B\r\nheadline: Writer\r\n---\r\n\r\nBody.\r\n";
  assert.equal(detectCv(text).ok, true);
  assert.deepEqual(detectCv("---\r\nname: A B\r\n---\r\n").missing, ["headline"]);
});

test("a byte order mark before the frontmatter is ignored", () => {
  assert.equal(detectCv("﻿---\nname: A\nheadline: B\n---\n").ok, true);
});

test("quoted values count; empty values count as missing", () => {
  assert.equal(detectCv(fm('name: "A B"', "headline: 'Writer'")).ok, true);
  assert.deepEqual(detectCv(fm("name:", "headline: Writer")).missing, ["name"]);
  assert.deepEqual(detectCv(fm('name: ""', "headline: ''")).missing, ["name", "headline"]);
});

test("indented keys count, like the renderer and linter read them", () => {
  assert.equal(detectCv(fm("  name: A B", "\theadline: Writer")).ok, true);
});

test("keys are case-sensitive and must be exact", () => {
  assert.deepEqual(detectCv(fm("Name: A B", "headline-short: W")).missing, ["name", "headline"]);
});

test("a key mentioned in the body does not count", () => {
  assert.deepEqual(detectCv("---\ntitle: x\n---\n\nname: A\nheadline: B\n").missing, ["name", "headline"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { coverage, extractTerms, normalizeToken, tokenize } from "../src/keywords.mjs";

const POSTING = `We need a technical writer with API documentation experience.
You will write technical documentation for REST APIs. Experience with CI/CD,
Node.js and C++ is a plus. Strong technical documentation skills required.`;

const CV = `---
name: Jane Doe
headline: Technical Writer
---

Writer of API documentation.

## Experience

### Acme · Writer · 2020

- Wrote technical documentation and ran CI/CD pipelines.
- Documented REST APIs in Node.js.

## Skills

### Tools

Git, Docker
`;

test("tokenizer keeps tech tokens whole", () => {
  const raw = tokenize("Uses CI/CD, Node.js and C++ (also C#).").map((t) => t.raw);
  assert.deepEqual(raw, ["Uses", "CI/CD", "Node.js", "and", "C++", "also", "C#"]);
});

test("stemming is light and leaves tech tokens alone", () => {
  assert.equal(normalizeToken("APIs"), "api");
  assert.equal(normalizeToken("Testing"), "test");
  assert.equal(normalizeToken("Running"), "run");
  assert.equal(normalizeToken("Node.js"), "node.js");
  assert.equal(normalizeToken("process"), "process");
  assert.equal(normalizeToken("string"), "string");
  assert.equal(normalizeToken("libraries"), "library");
});

test("extracts ranked terms, phrases and no stopwords", () => {
  const terms = extractTerms(POSTING);
  const keys = terms.map((t) => t.key);
  assert.ok(keys.includes("technical documentation"));
  assert.ok(keys.includes("ci/cd"));
  assert.ok(keys.includes("node.js"));
  assert.ok(keys.includes("c++"));
  assert.ok(!keys.includes("with"));
  assert.ok(!keys.includes("experience"));
  assert.ok(keys.slice(0, 3).includes("technical documentation"));
  assert.equal(terms.find((t) => t.key === "technical")?.count, 1);
});

test("coverage reports matches, sections, and missing terms", () => {
  const r = coverage(CV, POSTING);
  const by = (k) => r.terms.find((t) => t.key === k);
  assert.equal(by("technical documentation").matched, true);
  assert.deepEqual(by("ci/cd").sections, [{ name: "Experience", count: 1 }]);
  assert.equal(by("c++").matched, false);
  assert.equal(r.percent, Math.round((r.matched / r.total) * 100));
});

test("plural and -ing forms match", () => {
  const r = coverage("## Skills\n\n### A\n\nbuilding pipelines, tests", "pipeline testing build");
  assert.ok(r.terms.length >= 3);
  assert.ok(r.terms.every((t) => t.matched), JSON.stringify(r.terms));
});

test("pinned terms are always checked", () => {
  const r = coverage(CV, POSTING, { pins: ["Docker", "Kubernetes", "node.js"] });
  const by = (k) => r.terms.find((t) => t.key === k);
  assert.equal(by("docker").pinned, true);
  assert.equal(by("docker").matched, true);
  assert.equal(by(normalizeToken("Kubernetes")).matched, false);
  assert.equal(r.terms.filter((t) => t.key === "node.js").length, 1);
  assert.equal(by("node.js").pinned, true);
});

test("handles empty input and CVs without frontmatter", () => {
  assert.deepEqual(coverage("", "").terms, []);
  assert.equal(coverage("no frontmatter here", "frontmatter").percent, 100);
});

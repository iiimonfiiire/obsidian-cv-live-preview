import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, renderFilename, sanitizeFilename } from "../src/filename.mjs";

const ctx = { name: "Jane Doe", headline: "Technical Writer", title: "CV Jane", variant: "", date: new Date(2026, 2, 5) };

test("default template keeps the v0.1 name", () => {
  assert.equal(renderFilename("{name} - {headline}", ctx), "Jane Doe - Technical Writer");
});

test("sanitizes illegal characters and collapses whitespace", () => {
  assert.equal(sanitizeFilename('a/b:c*d?"e<f>g|h'), "abcdefgh");
  assert.equal(renderFilename("{name}   {headline}", { ...ctx, headline: "Docs / API:  Lead" }), "Jane Doe Docs API Lead");
});

test("empty variant leaves no dangling separators", () => {
  assert.equal(renderFilename("{name} - {headline} - {variant}", ctx), "Jane Doe - Technical Writer");
  assert.equal(renderFilename("{variant} - {name}", ctx), "Jane Doe");
  assert.equal(renderFilename("{name} - {variant} - {headline}", ctx), "Jane Doe - Technical Writer");
  assert.equal(renderFilename("{name} - {variant}", { ...ctx, variant: "Backend" }), "Jane Doe - Backend");
});

test("date tokens", () => {
  assert.equal(renderFilename("{name} {date}", ctx), "Jane Doe 2026-03-05");
  assert.equal(renderFilename("{name}_{date:YYYY.MM}", ctx), "Jane Doe_2026.03");
  assert.equal(formatDate(ctx.date, "DD/MM/YYYY"), "05/03/2026");
});

test("title token and fallback", () => {
  assert.equal(renderFilename("{title}", ctx), "CV Jane");
  assert.equal(renderFilename("{variant}", ctx), "CV");
  assert.equal(renderFilename("", ctx), "CV");
  assert.equal(renderFilename("///", ctx, "Resume"), "Resume");
});

test("trailing dots are trimmed and length is capped", () => {
  assert.equal(renderFilename("{name}.", ctx), "Jane Doe");
  assert.ok(renderFilename("{name}", { ...ctx, name: "x".repeat(400) }).length <= 150);
});

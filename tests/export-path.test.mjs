import { test } from "node:test";
import assert from "node:assert/strict";
import { joinPath, resolveCollision, resolveTarget } from "../src/export-path.mjs";
import { applyOverrides } from "../src/overrides.mjs";

const base = { vaultBase: "/vault", noteDir: "CVs", filename: "Jane.pdf" };

test("next-to-note uses the note folder", () => {
  const t = resolveTarget({ ...base, mode: "next-to-note", exportFolder: "/ignored" });
  assert.deepEqual(t, { dir: "/vault/CVs", path: "/vault/CVs/Jane.pdf", ask: false });
});

test("note in vault root", () => {
  assert.equal(resolveTarget({ ...base, noteDir: "", mode: "next-to-note" }).path, "/vault/Jane.pdf");
});

test("folder mode: absolute and vault-relative", () => {
  assert.equal(resolveTarget({ ...base, mode: "folder", exportFolder: "/tmp/out/" }).path, "/tmp/out/Jane.pdf");
  assert.equal(resolveTarget({ ...base, mode: "folder", exportFolder: "Exports/pdf" }).path, "/vault/Exports/pdf/Jane.pdf");
});

test("folder mode with no folder falls back to the note folder", () => {
  assert.equal(resolveTarget({ ...base, mode: "folder", exportFolder: " " }).path, "/vault/CVs/Jane.pdf");
});

test("ask mode prefills the folder and flags ask", () => {
  const t = resolveTarget({ ...base, mode: "ask", exportFolder: "/tmp/out" });
  assert.equal(t.ask, true);
  assert.equal(t.path, "/tmp/out/Jane.pdf");
});

test("windows paths keep backslashes", () => {
  assert.equal(joinPath("C:\\Users\\x\\vault", "CVs", "a.pdf"), "C:\\Users\\x\\vault\\CVs\\a.pdf");
  const t = resolveTarget({ ...base, vaultBase: "C:\\vault", mode: "folder", exportFolder: "D:\\out" });
  assert.equal(t.path, "D:\\out\\Jane.pdf");
});

test("collision: overwrite keeps the path, counter finds a free name", () => {
  const taken = new Set(["/o/a.pdf", "/o/a (2).pdf"]);
  const exists = (p) => taken.has(p);
  assert.equal(resolveCollision("/o/a.pdf", exists, "overwrite"), "/o/a.pdf");
  assert.equal(resolveCollision("/o/a.pdf", exists, "counter"), "/o/a (3).pdf");
  assert.equal(resolveCollision("/o/b.pdf", exists, "counter"), "/o/b.pdf");
});

test("a per-note export folder implies folder mode", () => {
  const settings = { exportMode: "next-to-note", exportFolder: "", filenameTemplate: "{name}" };
  const merged = applyOverrides(settings, { exportFolder: "Out", filenameTemplate: "{title}" });
  assert.deepEqual(merged, { exportMode: "folder", exportFolder: "Out", filenameTemplate: "{title}" });
});

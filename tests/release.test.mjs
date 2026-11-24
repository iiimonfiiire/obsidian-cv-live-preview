import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));

test("versions.json maps the manifest version to its minAppVersion", () => {
  const manifest = read("manifest.json");
  assert.equal(read("versions.json")[manifest.version], manifest.minAppVersion);
});

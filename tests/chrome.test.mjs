import { test } from "node:test";
import assert from "node:assert/strict";
import { chromeCandidates, findChrome } from "../src/chrome.mjs";

test("candidates per platform", () => {
  assert.ok(chromeCandidates("darwin").some((p) => p.includes("Google Chrome.app")));
  assert.ok(chromeCandidates("linux").includes("/usr/bin/chromium"));
  const win = chromeCandidates("win32", { PROGRAMFILES: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\x\\AppData\\Local" });
  assert.ok(win.includes("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"));
  assert.ok(win.some((p) => p.endsWith("msedge.exe")));
  assert.equal(chromeCandidates("win32", {}).length, 0);
});

test("configured path wins when it exists", () => {
  const r = findChrome({ configured: "/x/chrome", platform: "linux", exists: () => true });
  assert.deepEqual(r, { path: "/x/chrome", source: "configured" });
});

test("falls back to auto-detect when the configured path is missing", () => {
  const exists = (p) => p === "/usr/bin/chromium";
  assert.deepEqual(findChrome({ configured: "/nope", platform: "linux", exists }), { path: "/usr/bin/chromium", source: "auto" });
});

test("CHROME_BIN is honored before well-known paths", () => {
  const r = findChrome({ configured: "", platform: "linux", env: { CHROME_BIN: "/opt/c" }, exists: () => true });
  assert.deepEqual(r, { path: "/opt/c", source: "env" });
});

test("returns null when nothing exists", () => {
  assert.equal(findChrome({ configured: "/nope", platform: "darwin", exists: () => false }), null);
});

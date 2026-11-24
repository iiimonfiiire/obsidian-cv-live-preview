import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FONT_FACES, fontFaceCss } from "../src/fonts.mjs";

const root = new URL("..", import.meta.url).pathname;
const FAMILIES = ["Figtree", "Barlow Condensed", "JetBrains Mono"];

test("every font face has a committed WOFF2 file", () => {
  for (const f of FONT_FACES) assert.ok(existsSync(join(root, "assets/fonts", f.file)), f.file);
});

test("font licenses ship next to the fonts", () => {
  const files = readdirSync(join(root, "assets/fonts"));
  for (const name of ["OFL-Figtree.txt", "OFL-Barlow.txt", "OFL-JetBrainsMono.txt"]) assert.ok(files.includes(name), name);
});

test("fontFaceCss inlines each family as a data URI", () => {
  const css = fontFaceCss();
  for (const family of FAMILIES) assert.match(css, new RegExp(`@font-face \\{ font-family: "${family}"; font-weight: \\d+; src: url\\("data:font/woff2;base64,[A-Za-z0-9+/=]{100,}"\\)`));
  assert.doesNotMatch(css, /FONTDIR|file:\/\/|\.ttf/);
});

test("theme stylesheets carry no font-face rules or FONTDIR placeholders", () => {
  for (const f of ["classic.css", "modern.css"]) {
    const css = readFileSync(join(root, "src/themes", f), "utf8");
    assert.doesNotMatch(css, /FONTDIR|@font-face/);
  }
});

test("the built bundle inlines the fonts and has no FONTDIR placeholders", () => {
  const out = join(tmpdir(), `cv-bundle-${process.pid}`);
  execFileSync(process.execPath, ["build.mjs"], { cwd: root, stdio: "ignore", env: { ...process.env, CV_BUILD_OUT: out } });
  const js = readFileSync(join(out, "main.js"), "utf8");
  assert.doesNotMatch(js, /FONTDIR/);
  assert.doesNotMatch(js, /fonts\/\$\{/);
  for (const family of FAMILIES) assert.match(js, new RegExp(`font-family: \\\\?"${family}\\\\?"; font-weight: \\d+; src: url\\(\\\\?"data:font/woff2;base64,`), family);
  assert.ok((js.match(/data:font\/woff2;base64,/g) ?? []).length >= FONT_FACES.length);
  assert.deepEqual(readdirSync(out).sort(), ["main.js", "manifest.json", "styles.css"]);
});

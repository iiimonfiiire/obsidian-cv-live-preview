// Bundled fonts (SIL OFL, Latin subsets in assets/fonts). fontFaceCss() returns
// @font-face rules with the files inlined as data URIs. build.mjs replaces this
// module in the bundle with the precomputed string; Node callers read the files.
import { readFileSync } from "node:fs";

export const FONT_FACES = [
  { family: "Figtree", weight: 400, file: "Figtree-400.woff2" },
  { family: "Figtree", weight: 500, file: "Figtree-500.woff2" },
  { family: "Figtree", weight: 600, file: "Figtree-600.woff2" },
  { family: "Figtree", weight: 700, file: "Figtree-700.woff2" },
  { family: "Figtree", weight: 800, file: "Figtree-800.woff2" },
  { family: "Barlow Condensed", weight: 600, file: "BarlowCondensed-600.woff2" },
  { family: "Barlow Condensed", weight: 700, file: "BarlowCondensed-700.woff2" },
  { family: "JetBrains Mono", weight: 400, file: "JetBrainsMono-400.woff2" },
  { family: "JetBrains Mono", weight: 500, file: "JetBrainsMono-500.woff2" },
];

export function buildFontFaceCss(readFile) {
  return FONT_FACES.map(
    (f) =>
      `@font-face { font-family: "${f.family}"; font-weight: ${f.weight}; src: url("data:font/woff2;base64,${readFile(f.file).toString("base64")}") format("woff2"); }`,
  ).join("\n");
}

let cached;
export function fontFaceCss() {
  cached ??= buildFontFaceCss((file) => readFileSync(new URL(`../assets/fonts/${file}`, import.meta.url)));
  return cached;
}

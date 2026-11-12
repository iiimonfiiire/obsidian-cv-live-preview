// Downloads the three font families the Carcharias design uses (same TTF
// files the react-pdf renderer registers) into spike/fonts/ (gitignored).
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const listPath = process.argv[2];
if (!listPath) throw new Error("usage: fetch-fonts.mjs <path to webfontlist.json>");
const list = JSON.parse(readFileSync(listPath, "utf8"));
const items = Array.isArray(list) ? list : list.items;
const want = {
  Figtree: ["400", "500", "600", "700", "800"],
  "Barlow Condensed": ["400", "500", "600", "700", "800"],
  "JetBrains Mono": ["400", "500"],
};
const out = join(here, "../fonts");
mkdirSync(out, { recursive: true });
for (const [family, weights] of Object.entries(want)) {
  const item = items.find((i) => i.family === family);
  for (const w of weights) {
    const file = join(out, `${family.replace(/ /g, "")}-${w}.ttf`);
    if (existsSync(file)) continue;
    const res = await fetch(item.files[w]);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log("fetched", file);
  }
}

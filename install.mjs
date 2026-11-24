// Copies dist/ into <vault>/.obsidian/plugins/cv-live-preview/.
// usage: node install.mjs <path to vault>
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vault = process.argv[2];
if (!vault || !existsSync(join(vault, ".obsidian"))) throw new Error("usage: install.mjs <path to vault>");
const target = join(vault, ".obsidian/plugins/cv-live-preview");
mkdirSync(target, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) copyFileSync(join(here, "dist", f), join(target, f));
console.log("installed to", target);

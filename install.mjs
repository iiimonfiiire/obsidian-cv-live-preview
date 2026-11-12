// Copies dist/ into <vault>/.obsidian/plugins/cv-live-preview/.
// usage: node install.mjs <path to vault>
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vault = process.argv[2];
if (!vault || !existsSync(join(vault, ".obsidian"))) throw new Error("usage: install.mjs <path to vault>");
const target = join(vault, ".obsidian/plugins/cv-live-preview");
mkdirSync(target, { recursive: true });
cpSync(join(here, "dist"), target, { recursive: true });
console.log("installed to", target);

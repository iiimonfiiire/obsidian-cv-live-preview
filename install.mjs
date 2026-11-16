// Copies dist/ into <vault>/.obsidian/plugins/cv-live-preview/.
// usage: node install.mjs <path to vault>
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vault = process.argv[2];
if (!vault || !existsSync(join(vault, ".obsidian"))) throw new Error("usage: install.mjs <path to vault>");
const target = join(vault, ".obsidian/plugins/cv-live-preview");
mkdirSync(target, { recursive: true });
// File by file: cpSync on a directory fails with EEXIST when the target exists.
const copyTree = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    if (statSync(join(from, e.name)).isDirectory()) copyTree(join(from, e.name), join(to, e.name));
    else copyFileSync(join(from, e.name), join(to, e.name));
  }
};
copyTree(join(here, "dist"), target);
console.log("installed to", target);

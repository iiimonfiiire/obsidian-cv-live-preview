// Bundles the plugin into dist/ (main.js, manifest.json, styles.css, fonts/).
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(here, "src/main.js")],
  outfile: join(dist, "main.js"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2020",
  external: ["obsidian", "electron", "@electron/remote"],
  loader: { ".css": "text" },
  logLevel: "info",
});

cpSync(join(here, "manifest.json"), join(dist, "manifest.json"));
cpSync(join(here, "styles.css"), join(dist, "styles.css"));
const fonts = join(here, "fonts");
if (!existsSync(fonts)) throw new Error("fonts missing: run npm run fonts -- <webfontlist.json> first");
cpSync(fonts, join(dist, "fonts"), { recursive: true, dereference: true });
console.log("built", dist);

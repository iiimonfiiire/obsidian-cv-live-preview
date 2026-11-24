// Bundles the plugin into dist/ (main.js, manifest.json, styles.css).
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fontFaceCss } from "./src/fonts.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dist = process.env.CV_BUILD_OUT ?? join(here, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Swaps src/fonts.mjs for a module holding the @font-face CSS with the fonts inlined.
const inlineFonts = {
  name: "inline-fonts",
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]fonts\.mjs$/ }, () => ({
      contents: `export const fontFaceCss = () => ${JSON.stringify(fontFaceCss())};`,
      loader: "js",
    }));
  },
};

await build({
  entryPoints: [join(here, "src/main.js")],
  outfile: join(dist, "main.js"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2020",
  external: ["obsidian", "electron", "@electron/remote"],
  loader: { ".css": "text" },
  plugins: [inlineFonts],
  logLevel: "info",
});

cpSync(join(here, "manifest.json"), join(dist, "manifest.json"));
cpSync(join(here, "styles.css"), join(dist, "styles.css"));
console.log("built", dist);

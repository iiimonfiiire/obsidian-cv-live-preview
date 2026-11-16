// Markdown CV -> HTML -> PDF via headless Chrome.
// usage: node render.mjs <cv.md> <out.pdf> [--html-only] [--watch] [--no-metadata]
import { readFileSync, writeFileSync, existsSync, watch } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHtml } from "../src/render-core.mjs";
import { findChrome } from "../src/chrome.mjs";
import { readOverrides } from "../src/overrides.mjs";
import { applyMetadata, buildMetadata } from "../src/pdf-meta.mjs";

const here = dirname(fileURLToPath(import.meta.url));

async function build(mdPath, pdfPath, { htmlOnly, metadata }) {
  const src = readFileSync(mdPath, "utf8");
  const css = readFileSync(join(here, "../src/carcharias.css"), "utf8");
  const html = renderHtml(src, {
    css,
    fontUrl: (f) => `file://${join(here, "../fonts", f)}`,
  });
  const htmlPath = resolve(pdfPath.replace(/\.pdf$/, ".html"));
  writeFileSync(htmlPath, html);
  if (htmlOnly) return;
  const chrome = findChrome({ platform: process.platform, env: process.env, exists: existsSync });
  if (!chrome) throw new Error("no Chrome, Chromium, Edge, or Brave found; set CHROME_BIN");
  execFileSync(
    chrome.path,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      "--allow-file-access-from-files",
      `--print-to-pdf=${resolve(pdfPath)}`,
      `file://${htmlPath}`,
    ],
    { stdio: "ignore" },
  );
  if (metadata) {
    const out = resolve(pdfPath);
    writeFileSync(out, await applyMetadata(readFileSync(out), buildMetadata(src, readOverrides(src))));
  }
}

const [, , mdPath, pdfPath, ...flags] = process.argv;
if (!mdPath || !pdfPath) {
  console.error("usage: render.mjs <cv.md> <out.pdf> [--html-only] [--watch] [--no-metadata]");
  process.exit(1);
}
const options = { htmlOnly: flags.includes("--html-only"), metadata: !flags.includes("--no-metadata") };

const run = async () => {
  try {
    await build(mdPath, pdfPath, options);
    console.log(new Date().toLocaleTimeString(), "rendered", pdfPath);
  } catch (e) {
    console.error("render failed:", e.message);
  }
};

await run();
if (flags.includes("--watch")) {
  let timer;
  watch(mdPath, () => {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
  console.log("watching", mdPath, "(Ctrl+C to stop)");
}

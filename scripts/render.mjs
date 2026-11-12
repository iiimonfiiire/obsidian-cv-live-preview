// Markdown CV -> HTML -> PDF via headless Chrome.
// usage: node render.mjs <cv.md> <out.pdf> [--html-only] [--watch]
import { readFileSync, writeFileSync, watch } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHtml } from "../src/render-core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function build(mdPath, pdfPath, htmlOnly) {
  const css = readFileSync(join(here, "../src/carcharias.css"), "utf8");
  const html = renderHtml(readFileSync(mdPath, "utf8"), {
    css,
    fontUrl: (f) => `file://${join(here, "../fonts", f)}`,
  });
  const htmlPath = resolve(pdfPath.replace(/\.pdf$/, ".html"));
  writeFileSync(htmlPath, html);
  if (htmlOnly) return;
  execFileSync(
    CHROME,
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
}

const [, , mdPath, pdfPath, ...flags] = process.argv;
if (!mdPath || !pdfPath) {
  console.error("usage: render.mjs <cv.md> <out.pdf> [--html-only] [--watch]");
  process.exit(1);
}
const htmlOnly = flags.includes("--html-only");

const run = () => {
  try {
    build(mdPath, pdfPath, htmlOnly);
    console.log(new Date().toLocaleTimeString(), "rendered", pdfPath);
  } catch (e) {
    console.error("render failed:", e.message);
  }
};

run();
if (flags.includes("--watch")) {
  let timer;
  watch(mdPath, () => {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
  console.log("watching", mdPath, "(Ctrl+C to stop)");
}

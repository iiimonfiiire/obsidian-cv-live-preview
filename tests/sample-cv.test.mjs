import { test } from "node:test";
import assert from "node:assert/strict";
import { countLevels, lintCv } from "../src/lint.mjs";
import { looksLikeCv } from "../src/cv-detect.mjs";
import { renderHtml } from "../src/render-core.mjs";
import { THEME_IDS, getTheme } from "../src/themes.mjs";
import { SAMPLE_CV, sampleCvPath } from "../src/sample-cv.mjs";

test("the sample passes the linter with no errors", () => {
  const errors = lintCv(SAMPLE_CV).filter((i) => i.level === "error");
  assert.deepEqual(errors, []);
  assert.equal(countLevels(lintCv(SAMPLE_CV)).errors, 0);
});

test("the sample counts as a CV", () => {
  assert.ok(looksLikeCv(SAMPLE_CV));
});

test("the sample renders in every theme", () => {
  for (const id of THEME_IDS) {
    const out = renderHtml(SAMPLE_CV, { css: "", theme: getTheme(id) });
    assert.match(out, /Daniel Carcharias/, id);
    assert.match(out, /Experience/, id);
  }
});

test("the sample keeps its escaped less-than sign", () => {
  assert.match(SAMPLE_CV, /from 1 day to \\<1 hour/);
});

test("sampleCvPath picks the first free name and never an existing one", () => {
  const taken = new Set();
  assert.equal(sampleCvPath("/", (p) => taken.has(p)), "Sample CV.md");
  taken.add("Sample CV.md");
  assert.equal(sampleCvPath("", (p) => taken.has(p)), "Sample CV 2.md");
  taken.add("Sample CV 2.md");
  assert.equal(sampleCvPath("", (p) => taken.has(p)), "Sample CV 3.md");
  assert.equal(sampleCvPath("Notes/CVs", () => false), "Notes/CVs/Sample CV.md");
  assert.equal(sampleCvPath("Notes/CVs/", (p) => p === "Notes/CVs/Sample CV.md"), "Notes/CVs/Sample CV 2.md");
});

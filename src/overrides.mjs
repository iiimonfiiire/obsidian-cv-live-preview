// Per-note frontmatter overrides. Reads `key: value` lines like parseCv does,
// but never throws.
export function readFrontmatter(src) {
  const m = String(src).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const meta = {};
  if (!m) return meta;
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const v = line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    meta[line.slice(0, i).trim()] = v;
  }
  return meta;
}

const MAP = {
  "cv-export-folder": "exportFolder",
  "cv-filename": "filenameTemplate",
  "cv-pdf-title": "pdfTitle",
  "cv-pdf-author": "pdfAuthor",
  "cv-pdf-subject": "pdfSubject",
  "cv-pdf-keywords": "pdfKeywords",
};

export function readOverrides(src) {
  const meta = readFrontmatter(src);
  const out = {};
  for (const [key, field] of Object.entries(MAP)) if (meta[key]) out[field] = meta[key];
  return out;
}

// A per-note export folder implies folder mode.
export function applyOverrides(settings, overrides) {
  const merged = { ...settings };
  if (overrides.exportFolder) {
    merged.exportFolder = overrides.exportFolder;
    merged.exportMode = "folder";
  }
  if (overrides.filenameTemplate) merged.filenameTemplate = overrides.filenameTemplate;
  return merged;
}

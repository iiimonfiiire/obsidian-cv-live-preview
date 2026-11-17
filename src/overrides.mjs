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
  "cv-theme": "theme",
};

export function readOverrides(src) {
  const meta = readFrontmatter(src);
  const out = {};
  for (const [key, field] of Object.entries(MAP)) if (meta[key]) out[field] = meta[key];
  return out;
}

// Set or remove one frontmatter line without touching the rest of the note.
// value null/"" removes the key. Returns the text unchanged when there is no frontmatter.
export function setFrontmatterKey(src, key, value) {
  const text = String(src);
  const m = text.match(/^---(\r?\n)([\s\S]*?)(\r?\n)---/);
  if (!m) return text;
  const eol = m[1];
  const lines = m[2].split(/\r?\n/);
  const at = lines.findIndex((l) => l.slice(0, Math.max(l.indexOf(":"), 0)).trim() === key);
  if (value === null || value === undefined || value === "") {
    if (at >= 0) lines.splice(at, 1);
  } else if (at >= 0) {
    lines[at] = `${key}: ${value}`;
  } else {
    lines.push(`${key}: ${value}`);
  }
  return `---${eol}${lines.join(eol)}${m[3]}---${text.slice(m[0].length)}`;
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

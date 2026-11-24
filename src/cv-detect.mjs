// Decides whether a note is a CV the plugin can preview, and says what is missing.
// Matches how the renderer and linter read frontmatter: `key: value` lines,
// keys trimmed (an indented `name:` counts), quoted values unquoted, CRLF accepted.
// A key with an empty value ("name:" or name: "") counts as missing.
export const CV_FIELDS = ["name", "headline"];

export function detectCv(text) {
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/);
  const end = lines[0]?.trim() === "---" ? lines.findIndex((l, i) => i > 0 && l.trim() === "---") : -1;
  if (end < 0) return { ok: false, hasFrontmatter: false, missing: [...CV_FIELDS] };
  const present = new Set();
  for (const line of lines.slice(1, end)) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const value = line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, "$2").trim();
    if (value) present.add(line.slice(0, i).trim());
  }
  const missing = CV_FIELDS.filter((f) => !present.has(f));
  return { ok: !missing.length, hasFrontmatter: true, missing };
}

export const looksLikeCv = (text) => detectCv(text).ok;

const quoted = (fields) => fields.map((f) => `"${f}"`).join(" and ");

// One line for the preview pane; null when the note is fine.
export function setupMessage(det) {
  if (det.ok) return null;
  if (!det.hasFrontmatter) return "Add name and headline to the frontmatter, or start from a sample.";
  return `Missing ${quoted(det.missing)} in frontmatter.`;
}

// One line for the export notice; null when the note is fine.
export function exportBlocker(det) {
  if (det.ok) return null;
  if (!det.hasFrontmatter) return "Cannot export: the note has no frontmatter with name and headline.";
  return `Cannot export: missing ${quoted(det.missing)} in frontmatter.`;
}

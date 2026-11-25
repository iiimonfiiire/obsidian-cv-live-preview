// Format linter for the CV Markdown. Pure, never throws, 1-based line numbers.
import { PERIOD } from "./render-core.mjs";
import { THEME_IDS, isThemeId } from "./themes.mjs";

// location is optional: only the classic theme prints it.
export const REQUIRED_KEYS = ["name", "headline", "email", "phone", "website"];
export const KNOWN_SECTIONS = [
  "Experience",
  "Projects",
  "Technical",
  "Open source and community",
  "Skills",
  "Education",
  "Languages",
  "Fun fact",
];

const PARTS_NEEDED = { Experience: 2, Projects: 1, Education: 3 };
const SHAPE = {
  Experience: "Company · Position · period",
  Projects: "Project · period",
  Education: "Degree · Area · School · period",
};

function lintFrontmatter(lines, out) {
  if (lines[0]?.trim() !== "---") {
    out.push({ level: "error", line: 1, message: "Missing frontmatter (the note must start with ---)." });
    return 0;
  }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end < 0) {
    out.push({ level: "error", line: 1, message: "Frontmatter is not closed with ---." });
    return 0;
  }
  const seen = {};
  for (let i = 1; i < end; i++) {
    const c = lines[i].indexOf(":");
    if (c > 0) seen[lines[i].slice(0, c).trim()] = { line: i + 1, value: lines[i].slice(c + 1).trim() };
  }
  for (const key of REQUIRED_KEYS) {
    if (!seen[key]) out.push({ level: "error", line: 1, message: `Missing frontmatter key "${key}".` });
    else if (!seen[key].value) out.push({ level: "error", line: seen[key].line, message: `Frontmatter key "${key}" is empty.` });
  }
  const web = seen.website?.value;
  if (web && !/^\S+\s*\|\s*\S.*$/.test(web)) {
    out.push({ level: "error", line: seen.website.line, message: "website must be `url | label`." });
  } else if (web && !/^https?:\/\//.test(web)) {
    out.push({ level: "warn", line: seen.website.line, message: "website URL should start with http:// or https://." });
  }
  for (const key of ["linkedin", "github", "obsidian"]) {
    const v = seen[key]?.value;
    if (v && !/^https?:\/\/\S+/.test(v.split("|")[0].trim())) {
      out.push({ level: "warn", line: seen[key].line, message: `${key} should be a URL starting with http:// or https://.` });
    }
  }
  const theme = seen["cv-theme"]?.value.replace(/^(["'])(.*)\1$/, "$2");
  if (theme && !isThemeId(theme)) {
    out.push({ level: "warn", line: seen["cv-theme"].line, message: `cv-theme "${theme}" is not one of ${THEME_IDS.join(", ")}.` });
  }
  const mail = seen.email?.value;
  if (mail && !/^\S+@\S+\.\S+$/.test(mail)) {
    out.push({ level: "warn", line: seen.email.line, message: "email does not look like an address." });
  }
  return end + 1;
}

function lintItems(name, sec, out) {
  const need = PARTS_NEEDED[name];
  for (const h of sec.items) {
    const parts = h.text.split(" · ").map((p) => p.trim());
    const last = parts[parts.length - 1];
    const hasPeriod = parts.length > 1 && PERIOD.test(last);
    if (parts.length > 1 && !hasPeriod) {
      out.push({ level: "warn", line: h.line, message: `Period "${last}" does not match MM/YYYY – MM/YYYY, YYYY, or Present.` });
    } else if (parts.length === 1 && name !== "Experience") {
      out.push({ level: "warn", line: h.line, message: "No period (expected a trailing ` · YYYY` or `MM/YYYY – Present`)." });
    }
    const body = hasPeriod ? parts.slice(0, -1) : parts;
    if (body.length < need) {
      out.push({
        level: name === "Education" ? "error" : "warn",
        line: h.line,
        message: `Heading should read "${SHAPE[name]}" with " · " separators.`,
      });
    }
    if (name !== "Education" && !h.body.some((l) => l.trim())) {
      out.push({ level: "warn", line: h.line, message: `"${h.text}" has no content.` });
    }
  }
}

function lintSkills(sec, out) {
  if (!sec.items.length) out.push({ level: "warn", line: sec.line, message: "Skills needs `### Group` headings; this text will not render." });
  for (const h of sec.items) {
    if (!h.body.some((l) => l.trim())) {
      out.push({ level: "error", line: h.line, message: `Skills group "${h.text}" has no keyword line.` });
    }
  }
}

function lintLanguages(sec, out) {
  for (const l of sec.lines) {
    if (l.text.trim() && !/^- [^|]+\|\s*\S/.test(l.text)) {
      out.push({ level: "error", line: l.line, message: "Languages lines must be `- Language | Fluency`." });
    }
  }
}

function splitSections(lines, from) {
  const sections = [];
  const summary = [];
  let cur = null;
  let item = null;
  for (let i = from; i < lines.length; i++) {
    const text = lines[i];
    const h2 = text.match(/^## (.+)$/);
    const h3 = text.match(/^### (.+)$/);
    if (h2) {
      cur = { name: h2[1].trim(), line: i + 1, lines: [], items: [] };
      sections.push(cur);
      item = null;
    } else if (!cur) {
      summary.push(text);
    } else if (h3) {
      item = { text: h3[1].trim(), line: i + 1, body: [] };
      cur.items.push(item);
    } else {
      cur.lines.push({ text, line: i + 1 });
      if (item) item.body.push(text);
    }
  }
  return { sections, summary };
}

export function lintCv(src) {
  const out = [];
  try {
    const lines = String(src).split(/\r?\n/);
    const bodyStart = lintFrontmatter(lines, out);
    lines.forEach((l, i) => {
      if (l.includes("\t")) out.push({ level: "warn", line: i + 1, message: "Tab character; use spaces." });
    });

    const { sections, summary } = splitSections(lines, bodyStart);
    if (bodyStart > 0 && !summary.some((l) => l.trim())) {
      out.push({ level: "warn", line: bodyStart + 1, message: "No summary text before the first ## section." });
    }
    const names = new Set();
    for (const sec of sections) {
      if (names.has(sec.name)) out.push({ level: "warn", line: sec.line, message: `Duplicate section "${sec.name}".` });
      names.add(sec.name);
      if (!KNOWN_SECTIONS.includes(sec.name)) {
        out.push({ level: "warn", line: sec.line, message: `Unknown section "${sec.name}"; it will not render.` });
      } else if (!sec.lines.some((l) => l.text.trim()) && !sec.items.length) {
        out.push({ level: "warn", line: sec.line, message: `Section "${sec.name}" is empty.` });
      } else if (sec.name in PARTS_NEEDED) lintItems(sec.name, sec, out);
      else if (sec.name === "Skills") lintSkills(sec, out);
      else if (sec.name === "Languages") lintLanguages(sec, out);
    }
    if (bodyStart > 0 && !names.has("Experience")) {
      out.push({ level: "warn", line: lines.length, message: 'Missing section "Experience".' });
    }
  } catch (e) {
    out.push({ level: "error", line: 1, message: `Lint failed: ${e.message}` });
  }
  return out.sort((a, b) => a.line - b.line);
}

export function countLevels(issues) {
  return {
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warn").length,
  };
}

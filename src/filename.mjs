// Filename templates: {name} {headline} {title} {variant} {date} {date:FORMAT},
// plus any frontmatter key, e.g. {company}. Empty values and empty () or []
// pairs are dropped.
// Pure, no Node APIs.
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;
const SEP = "-–—_·,.|";
const MAX_LEN = 150;

export function formatDate(date, fmt = "YYYY-MM-DD") {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return fmt.replace(/YYYY|MM|DD/g, (t) =>
    t === "YYYY" ? p(date.getFullYear(), 4) : t === "MM" ? p(date.getMonth() + 1) : p(date.getDate()),
  );
}

export function sanitizeFilename(s) {
  return String(s).replace(ILLEGAL, "").replace(/\s+/g, " ").trim();
}

function tidy(s) {
  const sepClass = `[${SEP.replace(/[-\]\\]/g, "\\$&")}]`;
  const dangling = new RegExp(`^(?:\\s|${sepClass})+|(?:\\s|${sepClass})+$`, "g");
  const doubled = new RegExp(`(\\s${sepClass})(?:\\s+${sepClass})+(?=\\s)`, "g");
  return s.replace(doubled, "$1").replace(dangling, "");
}

export function renderFilename(template, ctx, fallback = "CV") {
  const date = ctx.date ?? new Date();
  // Built-in tokens win; any other {key} reads the note's frontmatter (ctx.fields).
  const values = { ...(ctx.fields ?? {}), name: ctx.name, headline: ctx.headline, title: ctx.title, variant: ctx.variant };
  const raw = String(template || "")
    .replace(/\{date(?::([^}]*))?\}/g, (_, f) => formatDate(date, f || undefined))
    .replace(/\{([\w-]+)\}/g, (m, k) => (Object.hasOwn(values, k) ? sanitizeFilename(values[k] ?? "") : ""))
    .replace(/\(\s*\)|\[\s*\]/g, "");
  let out = tidy(sanitizeFilename(raw));
  if (out.length > MAX_LEN) out = tidy(out.slice(0, MAX_LEN));
  return out || fallback;
}

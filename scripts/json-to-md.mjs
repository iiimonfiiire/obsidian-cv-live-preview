// One-off converter: master CV JSON -> Markdown (visible items only).
// usage: node json-to-md.mjs <cv.json> <out.md>
import { readFileSync, writeFileSync } from "node:fs";

const [, , src, dest] = process.argv;
const d = JSON.parse(readFileSync(src, "utf8"));

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

// Minimal HTML -> Markdown for the subset the CV JSON uses.
function htmlToMd(html) {
  if (!html) return "";
  let s = html;
  s = s.replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs, (_, h, t) => `[${t}](${h})`);
  s = s.replace(/<(strong|b)>(.*?)<\/\1>/gs, "**$2**");
  s = s.replace(/<(em|i)>(.*?)<\/\1>/gs, "*$2*");
  s = s.replace(/<code>(.*?)<\/code>/gs, "`$1`");
  s = s.replace(/<li>\s*<p>(.*?)<\/p>\s*<\/li>/gs, "\n- $1");
  s = s.replace(/<li>(.*?)<\/li>/gs, "\n- $1");
  s = s.replace(/<\/ul>\s*<ul>/g, "");
  s = s.replace(/<\/?ul>/g, "\n");
  s = s.replace(/<p>(.*?)<\/p>/gs, "\n$1\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decode(s);
  s = s.replace(/(^|[^\\`])<(?=\d)/g, "$1\\<");
  return s
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const b = d.basics;
const out = [
  "---",
  `name: ${b.name}`,
  `headline: ${b.headline}`,
  `email: ${b.email}`,
  `phone: ${b.phone}`,
  `location: ${b.location}`,
  `website: ${b.website.url} | ${b.website.label}`,
  "---",
  "",
  htmlToMd(d.summary.content),
  "",
];
const s = d.sections;
const vis = (sec) => (s[sec].hidden ? [] : s[sec].items.filter((i) => !i.hidden));

out.push("## Experience", "");
for (const it of vis("experience")) {
  out.push(`### ${it.company} · ${it.position} · ${it.period}`, "", htmlToMd(it.description), "");
}
out.push("## Projects", "");
for (const it of vis("projects")) {
  out.push(`### ${it.name} · ${it.period}`, "", htmlToMd(it.description), "");
}
out.push("## Skills", "");
for (const it of vis("skills")) out.push(`### ${it.name}`, "", it.keywords.join(", "), "");
out.push("## Education", "");
for (const it of vis("education")) {
  out.push(`### ${[it.degree, it.area, it.school, it.period].join(" · ")}`, "");
}
out.push("## Languages", "");
for (const it of vis("languages")) out.push(`- ${it.language} | ${it.fluency}`);
out.push("");

const dropped = Object.keys(s)
  .map((k) => [k, s[k].items.length - vis(k).length])
  .filter(([, n]) => n > 0)
  .map(([k, n]) => `${k}: ${n}`);
writeFileSync(dest, out.join("\n").replace(/\n{3,}/g, "\n\n"));
console.log("wrote", dest, dropped.length ? `| hidden items not carried over: ${dropped.join("; ")}` : "");

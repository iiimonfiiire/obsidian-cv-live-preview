// Core: Markdown CV -> HTML (Carcharias-style). No Node APIs, so it runs in the
// CLI and inside the Obsidian plugin bundle.
import { marked } from "marked";
import { getTheme } from "./themes.mjs";

export function parseCv(src) {
  src = src.replace(/\r\n?/g, "\n");
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("missing frontmatter");
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const parts = m[2].split(/^## (.+)$/m);
  const summary = parts[0].trim();
  const sections = {};
  for (let i = 1; i < parts.length; i += 2) sections[parts[i].trim()] = parts[i + 1].trim();
  return { meta, summary, sections };
}

const inline = (s) => marked.parseInline(s);
const block = (s) => marked.parse(s);
export const PERIOD = /^(\d{2}\/\d{4}|\d{4})(\s*[–-]\s*(\d{2}\/\d{4}|\d{4}|Present))?$/;

function items(text) {
  return text
    .split(/^### (.+)$/m)
    .slice(1)
    .reduce((acc, v, i, a) => (i % 2 ? acc : [...acc, { head: v.trim(), body: (a[i + 1] || "").trim() }]), []);
}

function splitHead(head) {
  const parts = head.split(" · ").map((p) => p.trim());
  const last = parts[parts.length - 1];
  const period = PERIOD.test(last) ? parts.pop() : "";
  return { parts, period };
}

const ICON = {
  mail: '<rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5"/><path d="M2.25 4.25 8 8.75l5.75-4.5"/>',
  phone:
    '<path d="M3.2 1.9h2.3l1.1 3-1.5 1.1a8 8 0 0 0 3.9 3.9l1.1-1.5 3 1.1v2.3a1.4 1.4 0 0 1-1.5 1.4A11.6 11.6 0 0 1 1.8 3.4a1.4 1.4 0 0 1 1.4-1.5Z"/>',
  globe:
    '<circle cx="8" cy="8" r="6.25"/><path d="M1.75 8h12.5M8 1.75c1.8 1.9 2.6 4 2.6 6.25S9.8 12.35 8 14.25C6.2 12.35 5.4 10.25 5.4 8S6.2 3.65 8 1.75Z"/>',
  linkedin:
    '<rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2"/><path d="M5 7v4.5M5 4.75v.01M8 11.5V7m0 2.2c0-1.3.9-2.2 2-2.2s1.6.8 1.6 2v2.5"/>',
  github:
    '<path d="M6 14.25v-2.1c-2.6.6-3.1-1.1-3.1-1.1M10 14.25v-2.3c0-.7-.2-1.1-.6-1.4 2-.2 3.6-1 3.6-3.9 0-.8-.3-1.5-.8-2 .1-.3.3-1.1-.1-2.1 0 0-.7-.2-2.1.8a7 7 0 0 0-3.8 0C4.8 2.2 4.1 2.4 4.1 2.4c-.4 1-.2 1.8-.1 2.1-.5.5-.8 1.2-.8 2 0 2.9 1.6 3.7 3.6 3.9-.4.3-.6.8-.6 1.4"/>',
  obsidian:
    '<path d="M8 1.75 12.75 5.5 11.25 14.25h-6.5L3.25 5.5Z"/><path d="M8 1.75 6.75 8.25 4.75 14.25M6.75 8.25l4.5 6"/>',
};
const icon = (n) =>
  `<span class="ic" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg></span>`;

const escAttr = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escText = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// "url | label" or a bare URL. A bare URL's label is the URL without scheme, www, and trailing slash.
export function parseLink(value) {
  const [url, label] = String(value || "").split("|").map((p) => p.trim());
  if (!url) return null;
  return { url, label: label || url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") };
}

function header(meta) {
  const row = (ic, inner) => `<div class="contact-row">${icon(ic)}${inner}</div>`;
  const link = (ic, value) => {
    const l = parseLink(value);
    return l ? row(ic, `<a href="${escAttr(l.url)}">${escText(l.label)}</a>`) : "";
  };
  const rows = [
    row("mail", `<a href="mailto:${meta.email}">${meta.email}</a>`),
    row("phone", `<a href="tel:${meta.phone}">${meta.phone}</a>`),
    link("globe", meta.website),
    link("linkedin", meta.linkedin),
    link("github", meta.github),
    link("obsidian", meta.obsidian),
  ].filter(Boolean);
  return `<header>
  <h1>${meta.name}</h1>
  <p class="headline">${meta.headline}</p>
  <div class="contact">
    ${rows.join("\n    ")}
  </div>
  <hr class="rule">
</header>`;
}

// The classic theme keeps its original one-page markup (location row, stacked
// title line, absolutely positioned rule), so its stylesheet is untouched.
const CLASSIC_ICON = {
  mail: '<path d="M2 4h12v8H2z M2 4l6 5 6-5"/>',
  pin: '<path d="M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
  phone: '<path d="M3.5 2h3l1 3-1.8 1.2a8 8 0 0 0 3.1 3.1L10 7.5l3 1v3a1.5 1.5 0 0 1-1.6 1.5A10.5 10.5 0 0 1 2 3.6 1.5 1.5 0 0 1 3.5 2z"/>',
  globe: '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/>',
  linkedin: ICON.linkedin,
  github: ICON.github,
  obsidian: ICON.obsidian,
};
const classicIcon = (n) =>
  `<svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${CLASSIC_ICON[n]}</svg>`;

function headerClassic(meta) {
  const row = (ic, inner) => `<div class="contact-row">${classicIcon(ic)}${inner}</div>`;
  const link = (ic, value) => {
    const l = parseLink(value);
    return l ? row(ic, `<a href="${escAttr(l.url)}">${escText(l.label)}</a>`) : "";
  };
  return `<header>
  <div class="id"><h1>${meta.name}</h1><p class="headline">${meta.headline}</p></div>
  <div class="contact">
    ${row("mail", `<a href="mailto:${meta.email}">${meta.email}</a>`)}
    ${meta.location ? row("pin", `<span>${meta.location}</span>`) : ""}
    ${row("phone", `<a href="tel:${meta.phone}">${meta.phone}</a>`)}
    ${link("globe", meta.website)}
    ${link("linkedin", meta.linkedin)}
    ${link("github", meta.github)}
    ${link("obsidian", meta.obsidian)}
  </div>
  <div class="rule"></div>
</header>`;
}

const section = (title, inner) => `<section><h2>${title}</h2>${inner}</section>`;

function itemHead(classic, titleHtml, posHtml, period) {
  if (classic) {
    return `<div class="item-head"><div class="title"><span class="company">${titleHtml}</span>${
      posHtml ? `<span class="sep"> • </span><span class="position">${posHtml}</span>` : ""
    }</div><div class="date">${period}</div></div>`;
  }
  return `<div class="item-head"><span class="company">${titleHtml}</span>${
    posHtml ? `<span class="position">${posHtml}</span>` : ""
  }<span class="date">${period}</span></div>`;
}

function experience(text, classic) {
  return items(text)
    .map(({ head, body }) => {
      const { parts, period } = splitHead(head);
      const [company, ...pos] = parts;
      const posHtml = pos.length ? inline(pos.join(" · ")) : "";
      return `<article>${itemHead(classic, inline(company), posHtml, period)}${block(body)}</article>`;
    })
    .join("");
}

function projects(text, classic) {
  return items(text)
    .map(({ head, body }) => {
      const { parts, period } = splitHead(head);
      return `<article>${itemHead(classic, inline(parts.join(" · ")), "", period)}${block(body)}</article>`;
    })
    .join("");
}

function skills(text) {
  return items(text)
    .map(({ head, body }) => {
      const kws = body.split(",").map((k) => k.trim()).filter(Boolean);
      kws[0] = kws[0][0].toUpperCase() + kws[0].slice(1);
      return `<div class="skill"><div class="skill-name">${head}</div><p class="kw">${kws
        .map((k) => inline(k))
        .join(", ")}</p></div>`;
    })
    .join("");
}

function education(text, classic) {
  return items(text)
    .map(({ head }) => {
      const { parts, period } = splitHead(head);
      const [degree, area, school] = parts;
      if (classic) {
        return `<article class="edu"><div class="degree">${inline(`${degree} ${area}`)}</div><div class="school">${inline(school)}</div><div class="date">${period}</div></article>`;
      }
      return `<div class="edu"><span class="degree">${inline(`${degree} ${area}`)}</span><span class="date">${period}</span><p class="school">${inline(school)}</p></div>`;
    })
    .join("");
}

function languages(text) {
  return text
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => {
      const [name, level] = l.slice(2).split("|").map((s) => s.trim());
      return `<div class="lang"><span>${name}</span><span class="fluency">${level}</span></div>`;
    })
    .join("");
}

// Chrome breaks lines after a hyphen; the react-pdf renderer this design came
// from does not. Keep hyphenated words (Docs-as-Code, end-to-end) unbroken.
function keepHyphenated(html) {
  return html
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith("<") ? part : part.replace(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+/gu, '<span class="nb">$&</span>'),
    )
    .join("");
}

// preview: true marks <html class="preview"> so the stylesheet skips the browser sheet simulation.
// theme: an entry of THEMES (themes.mjs); css must be that theme's stylesheet.
// fonts: @font-face rules (fonts.mjs), prepended to the stylesheet.
export function renderHtml(src, { css, fonts = "", preview = false, theme = getTheme() }) {
  const { meta, summary, sections } = parseCv(src);
  const classic = theme.markup === "classic";
  const styles = `${fonts}\n${css}`;
  const main = [
    sections.Experience && section("Experience", experience(sections.Experience, classic)),
    sections.Projects && section("Projects", projects(sections.Projects, classic)),
  ].join("");
  const side = [
    sections.Technical && section("Technical", block(sections.Technical)),
    sections["Open source and community"] &&
      section("Open source and community", block(sections["Open source and community"])),
    sections.Skills && section("Skills", skills(sections.Skills)),
    sections.Education && section("Education", education(sections.Education, classic)),
    sections.Languages && section("Languages", languages(sections.Languages)),
    sections["Fun fact"] && section("Fun fact", block(sections["Fun fact"])),
  ].join("");
  const page = `${classic ? headerClassic(meta) : header(meta)}
<div class="featured">${block(summary)}</div>
<div class="cols"><main>${main}</main><aside>${side}</aside></div>`;
  const body = classic ? `<div class="page">\n${keepHyphenated(page)}\n</div>` : keepHyphenated(page);
  const bodyAttr = theme.bodyClass ? ` class="${theme.bodyClass}"` : "";
  return `<!doctype html><html lang="en"${preview ? ' class="preview"' : ""}><head><meta charset="utf-8"><title>${`${meta.name} - ${meta.headline}`.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>
<style>${styles}</style></head><body${bodyAttr}>
${body}
</body></html>`;
}

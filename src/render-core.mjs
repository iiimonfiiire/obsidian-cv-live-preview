// Core: Markdown CV -> HTML (Carcharias-style). No Node APIs, so it runs in the
// CLI and inside the Obsidian plugin bundle.
import { marked } from "marked";

export function parseCv(src) {
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
const PERIOD = /^(\d{2}\/\d{4}|\d{4})(\s*[–-]\s*(\d{2}\/\d{4}|\d{4}|Present))?$/;

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
  mail: '<path d="M2 4h12v8H2z M2 4l6 5 6-5"/>',
  pin: '<path d="M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
  phone: '<path d="M3.5 2h3l1 3-1.8 1.2a8 8 0 0 0 3.1 3.1L10 7.5l3 1v3a1.5 1.5 0 0 1-1.6 1.5A10.5 10.5 0 0 1 2 3.6 1.5 1.5 0 0 1 3.5 2z"/>',
  globe: '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/>',
};
const icon = (n) =>
  `<svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

function header(meta) {
  const [url, label] = meta.website.split("|").map((s) => s.trim());
  const row = (ic, inner) => `<div class="contact-row">${icon(ic)}${inner}</div>`;
  return `<header>
  <div class="id"><h1>${meta.name}</h1><p class="headline">${meta.headline}</p></div>
  <div class="contact">
    ${row("mail", `<a href="mailto:${meta.email}">${meta.email}</a>`)}
    ${row("pin", `<span>${meta.location}</span>`)}
    ${row("phone", `<a href="tel:${meta.phone}">${meta.phone}</a>`)}
    ${row("globe", `<a href="${url}">${label}</a>`)}
  </div>
  <div class="rule"></div>
</header>`;
}

const section = (title, inner) => `<section><h2>${title}</h2>${inner}</section>`;

function experience(text) {
  return items(text)
    .map(({ head, body }) => {
      const { parts, period } = splitHead(head);
      const [company, ...pos] = parts;
      return `<article><div class="item-head"><div class="title"><span class="company">${company}</span>${
        pos.length ? `<span class="sep"> • </span><span class="position">${pos.join(" · ")}</span>` : ""
      }</div><div class="date">${period}</div></div>${block(body)}</article>`;
    })
    .join("");
}

function projects(text) {
  return items(text)
    .map(({ head, body }) => {
      const { parts, period } = splitHead(head);
      return `<article><div class="item-head"><div class="title"><span class="company">${parts.join(" · ")}</span></div><div class="date">${period}</div></div>${block(body)}</article>`;
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

function education(text) {
  return items(text)
    .map(({ head }) => {
      const { parts, period } = splitHead(head);
      const [degree, area, school] = parts;
      return `<article class="edu"><div class="degree">${degree} ${area}</div><div class="school">${school}</div><div class="date">${period}</div></article>`;
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

export function renderHtml(src, { css, fontUrl }) {
  const { meta, summary, sections } = parseCv(src);
  const styles = css.replace(/FONTDIR\/([\w-]+\.ttf)/g, (_, f) => fontUrl(f));
  const main = [
    sections.Experience && section("Experience", experience(sections.Experience)),
    sections.Projects && section("Projects", projects(sections.Projects)),
  ].join("");
  const side = [
    sections.Technical && section("Technical", block(sections.Technical)),
    sections["Open source and community"] &&
      section("Open source and community", block(sections["Open source and community"])),
    sections.Skills && section("Skills", skills(sections.Skills)),
    sections.Education && section("Education", education(sections.Education)),
    sections.Languages && section("Languages", languages(sections.Languages)),
    sections["Fun fact"] && section("Fun fact", block(sections["Fun fact"])),
  ].join("");
  const page = `${header(meta)}
<div class="featured">${block(summary)}</div>
<div class="cols"><main>${main}</main><aside>${side}</aside></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${meta.name} - ${meta.headline}</title>
<style>${styles}</style></head><body><div class="page">
${keepHyphenated(page)}
</div></body></html>`;
}

// PDF document metadata. buildMetadata is pure; applyMetadata uses pdf-lib.
import { PDFDocument } from "pdf-lib";
import { parseCv } from "./render-core.mjs";

export const PRODUCER = "CV Live Preview";

function skillKeywords(skills) {
  if (!skills) return [];
  return skills
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .flatMap((l) => l.split(","))
    .map((k) => k.trim())
    .filter(Boolean);
}

function splitList(s) {
  return String(s)
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((k) => k.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

// overrides: { pdfTitle, pdfAuthor, pdfSubject, pdfKeywords } (see overrides.mjs)
export function buildMetadata(src, overrides = {}) {
  const { meta, sections } = parseCv(src);
  const fromFront = meta.keywords ? splitList(meta.keywords) : [];
  const keywords = overrides.pdfKeywords
    ? splitList(overrides.pdfKeywords)
    : fromFront.length
      ? fromFront
      : skillKeywords(sections.Skills);
  return {
    title: overrides.pdfTitle || `${meta.name} - ${meta.headline}`,
    author: overrides.pdfAuthor || meta.name,
    subject: overrides.pdfSubject || meta.headline,
    keywords: [...new Set(keywords)].join(", "),
    creator: PRODUCER,
    producer: PRODUCER,
  };
}

export async function applyMetadata(bytes, md) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.setTitle(md.title);
  doc.setAuthor(md.author);
  doc.setSubject(md.subject);
  doc.setKeywords(md.keywords ? [md.keywords] : []);
  doc.setCreator(md.creator);
  doc.setProducer(md.producer);
  return doc.save({ useObjectStreams: false });
}

// Chrome prints real text with font objects. An image-only PDF has none.
export function hasTextLayer(bytes) {
  return /\/Type\s*\/Font\b/.test(new TextDecoder("latin1").decode(bytes));
}

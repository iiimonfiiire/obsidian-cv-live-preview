// Page-fit estimate for the live preview. Pure. The preview shows one continuous
// flow; real pages are shorter because each has top and bottom margins, and Chrome
// moves whole bullets and headings to the next page (break-inside: avoid), so the
// numbers are an estimate. The exported PDF page count is exact.
export const A4_H_PX = 1122.5; // 297 mm at 96 dpi
export const PT_TO_PX = 4 / 3;

// Where page n's content area ends, in preview (continuous flow) pixels.
// geometry: { topNext, bottom } in pt, see themes.mjs.
export function pageEndPx(n, geometry) {
  const first = A4_H_PX - geometry.bottom * PT_TO_PX;
  const span = A4_H_PX - (geometry.topNext + geometry.bottom) * PT_TO_PX;
  return first + (n - 1) * span;
}

// contentBottomPx: bottom edge of the last content, in preview pixels.
// -> { pages, freePt, level: "ok" | "tight" | "over", text, guides: [{ y, label }], marginGuideY }
export function fitPages({ contentBottomPx, minBottomMarginPt, geometry, maxPages = 2, linePt = 14.5 }) {
  let pages = 1;
  while (contentBottomPx > pageEndPx(pages, geometry)) pages++;
  const freePt = (pageEndPx(pages, geometry) - contentBottomPx) / PT_TO_PX;
  const guides = [];
  for (let n = 1; n <= maxPages; n++) {
    guides.push({ y: pageEndPx(n, geometry), label: maxPages === 1 || n === maxPages ? "page end" : `page ${n} ends` });
  }
  const marginGuideY = pageEndPx(Math.min(pages, maxPages), geometry) - minBottomMarginPt * PT_TO_PX;

  let level = "ok";
  let text;
  if (pages > maxPages) {
    const overPt = (contentBottomPx - pageEndPx(maxPages, geometry)) / PT_TO_PX;
    const lines = Math.ceil(overPt / linePt);
    level = "over";
    const lineText = `about ${lines} line${lines === 1 ? "" : "s"}`;
    text =
      maxPages === 1
        ? `Overflows the page by ${Math.round(overPt)}pt (${lineText})`
        : `Runs to ${pages} pages: over ${maxPages} by ${Math.round(overPt)}pt (${lineText})`;
  } else if (freePt < minBottomMarginPt) {
    level = "tight";
    text =
      maxPages === 1
        ? `Fits, but the bottom margin is only ${Math.round(freePt)}pt`
        : `About ${pages} page${pages === 1 ? "" : "s"}, but the last page has only ${Math.round(freePt)}pt of bottom margin`;
  } else {
    text =
      maxPages === 1
        ? `Fits one page, ${Math.round(freePt)}pt bottom margin`
        : `About ${pages} page${pages === 1 ? "" : "s"}, ${Math.round(freePt)}pt free on the last page`;
  }
  return { pages, freePt, level, text, guides, marginGuideY };
}

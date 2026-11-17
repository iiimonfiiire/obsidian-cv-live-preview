// CV themes. Pure metadata; the CSS text is loaded by the caller (plugin bundle or CLI).
//   cssFile    stylesheet under src/themes/
//   bodyClass  class on <body>, used by the layout variants
//   markup     "classic" keeps the original one-page markup; "modern" is the redesign
//   maxPages   page budget the fit check enforces
//   geometry   page margins in pt (modern themes use @page margins, classic pads the sheet)
//   linePt     body line height in pt, used to say "about N lines"
export const DEFAULT_THEME = "a";

export const THEMES = [
  {
    id: "classic",
    label: "Classic, one page",
    cssFile: "classic.css",
    bodyClass: "",
    markup: "classic",
    maxPages: 1,
    geometry: { topFirst: 35, topNext: 35, bottom: 0 },
    linePt: 8.75 * 1.25,
  },
  {
    id: "a",
    label: "Option A, sidebar",
    cssFile: "modern.css",
    bodyClass: "",
    markup: "modern",
    maxPages: 2,
    geometry: { topFirst: 35, topNext: 32, bottom: 34 },
    linePt: 10.5 * 1.38,
  },
  {
    id: "b",
    label: "Option B, single column",
    cssFile: "modern.css",
    bodyClass: "layout-single",
    markup: "modern",
    maxPages: 2,
    geometry: { topFirst: 35, topNext: 32, bottom: 34 },
    linePt: 10.5 * 1.38,
  },
  {
    id: "c",
    label: "Option C, wide sidebar",
    cssFile: "modern.css",
    bodyClass: "layout-wide",
    markup: "modern",
    maxPages: 2,
    geometry: { topFirst: 35, topNext: 32, bottom: 34 },
    linePt: 10.5 * 1.38,
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function isThemeId(id) {
  return THEME_IDS.includes(String(id ?? "").trim().toLowerCase());
}

// Unknown or empty ids fall back to `fallback`, then to the built-in default.
export function getTheme(id, fallback = DEFAULT_THEME) {
  const find = (v) => THEMES.find((t) => t.id === String(v ?? "").trim().toLowerCase());
  return find(id) ?? find(fallback) ?? find(DEFAULT_THEME);
}

# CV Live Preview

An Obsidian plugin for writing a CV in Markdown. It renders the note live in a
side pane, checks the page fit, and exports a PDF through headless Chrome. It
ships three themes (see "Themes"). Desktop only.

## Install

From Community plugins (once listed): open Settings > Community plugins >
Browse, search "CV Live Preview", install, and enable.

Manual install from a release:

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Put them in `<vault>/.obsidian/plugins/cv-live-preview/`.
3. Enable "CV Live Preview" under Settings > Community plugins.

Build from source:

```
npm ci
npm run build
npm run install-plugin -- <path to vault>
```

The build writes `main.js`, `manifest.json`, and `styles.css` to `dist/`; the
fonts are inside `main.js`. Then enable the plugin as above.

## Getting started

1. Run "Create sample CV" from the command palette. It adds `Sample CV.md` to
   your vault (numbered if the name is taken) and opens the preview.
2. Edit the note: replace the placeholder name, contact details, and jobs with
   your own.
3. Run "Export CV as PDF", or press Export PDF in the preview bar.

## Use

1. Open a CV note (frontmatter with `name` and `headline`). On a note without
   them, the preview names the missing fields and offers "Create sample CV".
2. Run "Open CV preview" from the command palette or the ribbon icon.
3. The pane re-renders as you type. The banner shows the page fit, and the
   dashed lines mark the minimum bottom margin and where each page ends.
   Pick a theme for this note from the dropdown in the bar.
4. Run "Export CV as PDF". Where the file goes is set under Settings > Export.

### Preview panels

- The bar shows an error and warning count from the format linter. Expand
  "Format check" for the list; click a row to jump the editor to that line.
- "Keywords" takes a pasted job posting (kept per note in the plugin data) and
  optional pinned terms. It reports coverage, the sections each matched term
  appears in, and the missing terms. Click a missing term to copy it. Matching
  is case-insensitive and ignores plural and `-ing` endings.

### Settings

- Export: location (`next-to-note`, fixed `folder`, or `ask` with a save
  dialog), export folder (absolute or vault-relative; created if missing),
  filename template, collision handling (`overwrite` or `counter`), action after
  export (`none`, `reveal`, `open`), PDF metadata on or off.
- Theme: default theme for notes without a `cv-theme` line.
- Preview: minimum bottom margin (pt).
- Chrome: binary path and a Test button. If the path does not exist, Chrome,
  Chromium, Edge, and Brave are looked up in well-known locations (and
  `CHROME_BIN`).

The folder picker and save dialog use Electron through `electron.remote` or
`@electron/remote`. If neither is exposed, the picker shows a notice and the
export falls back to the configured location.

### Filename template

Default `{name} - {headline}`. Tokens: `{name}`, `{headline}`, `{title}` (note
name), `{variant}` (frontmatter `variant`), any other frontmatter key such as
`{company}` (a missing or empty key, and the empty `()` it leaves, are dropped;
built-in tokens win over a same-named key), `{date}` and `{date:FORMAT}` with
`YYYY`, `MM`, `DD`. Illegal characters are removed, whitespace is collapsed, and
separators left dangling by empty tokens are trimmed. An empty result becomes
`CV`.

### Themes

| Id | Design | Pages |
|---|---|---|
| `classic` | The original compact layout, 8.75 pt text | 1 |
| `a` | Two columns with a sidebar, 10.5 pt text (default) | up to 2 |
| `b` | Single column; skills, education, and languages follow the experience | up to 2 |

The dropdown in the preview bar writes `cv-theme: <id>` into the note's
frontmatter. It changes only that line and leaves the rest of the note as is.
"Default theme" clears the line, so the note follows the default in settings.
Themes `a` and `b` share one stylesheet (`src/themes/modern.css`) and run
page numbers ("Page 2 of 2") from page 2. The preview estimates the page count;
the export notice reports the exact count of the PDF.

#### Page plan for `a` and `b`

Two A4 pages is the intended length, never squeezed to one. The type floors
(body 10.5 pt, dates and labels 9 pt) hold; to fit, trim content or spacing, not
type size.

- Page 1: header, summary, the first two jobs complete, and the whole sidebar.
- Page 2: starts with the third job, then the remaining jobs and Projects. It
  has no repeated header, only a top margin and a "Page X of Y" footer.
- If page 1 overflows, in order: shorten two-line bullets to one line, drop the
  weakest bullet of job 2 (keep at least 5), lower `--s5` to as low as 11 pt,
  shorten the summary. Never shrink fonts, narrow margins, or split job 2.
- Do not remove the break rules in `modern.css`: headings and entry heads stay
  with the text after them, and bullets, skill groups, education entries, and
  languages never split.
- Design values change only through the custom properties at the top of
  `modern.css`. For a white print copy, set `--page-bg` to `#ffffff`.

After a change, print and check: exactly 2 pages, job 2's last bullet ends page
1, job 3's company opens page 2, the sidebar ends on page 1, page 1 has five
working links, and copied text has no broken words such as "L ANGUAGES" (reduce
`--track-h2` if it does). The preview's page estimate does not check where the
split falls; check the PDF.

### Per-note overrides

Frontmatter keys override the settings for one note:

| Key | Effect |
|---|---|
| `cv-theme` | Theme for this note: `classic`, `a`, or `b` |
| `cv-export-folder` | Export to this folder (implies folder mode) |
| `cv-filename` | Filename template |
| `cv-pdf-title`, `cv-pdf-author`, `cv-pdf-subject` | PDF metadata |
| `cv-pdf-keywords` | PDF keywords, comma separated |

### PDF metadata

After Chrome prints, the plugin sets Title (`name - headline`), Author, Subject
(headline), Keywords (frontmatter `keywords`, else the Skills keywords), and
Creator/Producer ("CV Live Preview") with `pdf-lib`. Chrome output keeps real
text with font objects; the export warns if no font objects are found.

## Markdown format

- Frontmatter: `name`, `headline`, `email`, `phone`, `website: <url> | <label>`.
  Optional: `linkedin`, `github`, and `obsidian` (a URL, or `<url> | <label>`), shown in the
  header with icons; `location`, shown by the `classic` theme only; `variant`,
  `keywords`, and the `cv-*` overrides above.
- The header shows the contact items (`email`, `phone`, `website`, `linkedin`,
  `github`, `obsidian`, and `location` in `classic`) in frontmatter order. The
  modern themes put them on one row, which wraps when the labels are long.
  Short labels (`<url> | LinkedIn`) keep the row to one line.
- Text before the first `##` is the summary.
- `## Experience` and `## Projects`: `### Company · Position · period`, then bullets.
- `## Skills`: `### Group`, then a comma-separated keyword line.
- `## Education`: `### Degree · Area · School · period`.
- `## Languages`: `- Language | Fluency`.

## Command line

```
npm run render -- cv.md out/cv.pdf [--theme classic|a|b] [--watch] [--html-only] [--no-metadata]
node scripts/json-to-md.mjs <resume.json> cv.md   # one-off conversion
```

Chrome is auto-detected; set `CHROME_BIN` to use a specific binary. PDF
metadata is applied unless `--no-metadata` is passed.

## Disclosures

- Export launches a locally installed Chrome, Chromium, Edge, or Brave through
  `child_process` to print the PDF.
- The folder picker and save dialog use Electron dialogs.
- The PDF is written to the folder you choose, which can be outside the vault.
- The plugin makes no network requests and sends no telemetry.
- Fonts (Figtree, Barlow Condensed, JetBrains Mono) are bundled in `main.js`
  under the SIL Open Font License; the license texts are in `assets/fonts/`.

## Roadmap (v0.3 candidates)

- **Batch export:** export every note with CV frontmatter in a folder, using the
  filename template and per-note overrides.
- **Auto-export on save:** opt-in, debounced, so the PDF in the export folder
  stays current.
- **Theme options:** font size, margins, accent color, and section order as
  settings or frontmatter.
- **Page-fit help:** show which lines overflow the page and suggest a trim or a
  spacing adjustment.

## Known gaps

- Line breaks can differ between the preview and the PDF on a few lines, so
  rely on the bottom-margin check, not only the page count.
- Tests (`npm test`) cover rendering, filenames, export paths, the linter,
  keyword coverage, PDF metadata, and Chrome detection. The plugin UI, Electron
  dialogs, and the Chrome print step are not covered by automated tests.

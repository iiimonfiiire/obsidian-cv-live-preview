# CV Live Preview

An Obsidian plugin for writing a CV in Markdown. It renders the note live in a
side pane with a Carcharias-style layout, checks that the CV fits one page, and
exports a PDF through headless Chrome. Desktop only.

## Install

```
npm install
npm run fonts -- <path to webfontlist.json>   # once; fonts are gitignored
npm run build
npm run install-plugin -- <path to vault>
```

Then enable "CV Live Preview" under Settings > Community plugins.

## Use

1. Open a CV note (frontmatter with `name` and `headline`).
2. Run "Open CV preview" from the command palette or the ribbon icon.
3. The pane re-renders as you type. The banner shows the page fit, and the
   dashed lines mark the minimum bottom margin and the page end.
4. Run "Export CV as PDF" to write the PDF next to the note.

Settings: Chrome path and minimum bottom margin (pt).

## Markdown format

- Frontmatter: `name`, `headline`, `email`, `phone`, `location`, `website: <url> | <label>`.
- Text before the first `##` is the summary.
- `## Experience` and `## Projects`: `### Company · Position · period`, then bullets.
- `## Skills`: `### Group`, then a comma-separated keyword line.
- `## Education`: `### Degree · Area · School · period`.
- `## Languages`: `- Language | Fluency`.

## Command line

```
npm run render -- cv.md out/cv.pdf [--watch] [--html-only]
node scripts/json-to-md.mjs <resume.json> cv.md   # one-off conversion
```

Set `CHROME_BIN` if Chrome is not at the default macOS path.

## Known gaps

- Line breaks differ from the react-pdf renderer on a few lines, so rely on
  the bottom-margin check, not only the page count.
- No automated tests yet beyond a manual smoke test.

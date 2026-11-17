import { FileSystemAdapter, ItemView, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, normalizePath, setIcon } from "obsidian";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseCv, renderHtml } from "./render-core.mjs";
import { renderFilename } from "./filename.mjs";
import { resolveCollision, resolveTarget } from "./export-path.mjs";
import { applyOverrides, readFrontmatter, readOverrides, setFrontmatterKey } from "./overrides.mjs";
import { THEMES, getTheme } from "./themes.mjs";
import { findChrome } from "./chrome.mjs";
import { applyMetadata, buildMetadata, countPages, hasTextLayer } from "./pdf-meta.mjs";
import { countLevels, lintCv } from "./lint.mjs";
import { fitPages } from "./pagination.mjs";
import { coverage, formatCoverageReport } from "./keywords.mjs";
import classicCss from "./themes/classic.css";
import modernCss from "./themes/modern.css";

const THEME_CSS = { "classic.css": classicCss, "modern.css": modernCss };
const themeCss = (theme) => THEME_CSS[theme.cssFile];

const VIEW_TYPE = "cv-live-preview";
const A4_W = 793.7; // CSS px at 96 dpi
const A4_H = 1122.5;

const DEFAULTS = {
  defaultTheme: "a",
  chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  minBottomMarginPt: 30,
  exportMode: "next-to-note",
  exportFolder: "",
  filenameTemplate: "{name} - {headline}",
  onCollision: "overwrite",
  afterExport: "none",
  embedMetadata: true,
  postings: {},
};

const SAMPLE_CTX = { name: "Jane Doe", headline: "Technical Writer", title: "CV", variant: "" };

function electron() {
  try {
    return require("electron");
  } catch {
    return null;
  }
}

function electronRemote() {
  const e = electron();
  if (e?.remote) return e.remote;
  try {
    return require("@electron/remote");
  } catch {
    return null;
  }
}

function pickFolder() {
  const dialog = electronRemote()?.dialog;
  if (!dialog) {
    new Notice("The folder picker is not available in this Obsidian build. Type the path instead.");
    return null;
  }
  return dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] }).then((r) => (r.canceled ? null : r.filePaths[0]));
}

function splitPins(s) {
  return String(s || "")
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function looksLikeCv(text) {
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  return !!fm && /^name:/m.test(fm[1]) && /^headline:/m.test(fm[1]);
}

class CvView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.contentHeight = A4_H;
  }

  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "CV preview";
  }
  getIcon() {
    return "file-text";
  }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("cv-live-preview");
    const bar = root.createDiv({ cls: "cv-bar" });
    this.statusEl = bar.createSpan({ cls: "cv-status", text: "Open a CV note to preview it." });
    this.lintCountEl = bar.createSpan({ cls: "cv-lint-count" });
    this.themeSelect = bar.createEl("select", { cls: "dropdown cv-theme", attr: { "aria-label": "CV theme for this note" } });
    this.themeSelect.createEl("option", { value: "", text: "Default theme" });
    for (const t of THEMES) this.themeSelect.createEl("option", { value: t.id, text: t.label });
    this.themeSelect.addEventListener("change", () => this.plugin.setNoteTheme(this.themeSelect.value));
    const btn = bar.createEl("button", { text: "Export PDF" });
    btn.addEventListener("click", () => this.plugin.exportActive());
    const gear = bar.createEl("button", { cls: "cv-gear clickable-icon", attr: { "aria-label": "CV Live Preview settings" } });
    setIcon(gear, "settings");
    gear.addEventListener("click", () => this.plugin.openSettings());
    this.buildPanels(root);
    this.scroller = root.createDiv({ cls: "cv-scroller" });
    this.sizer = this.scroller.createDiv({ cls: "cv-sizer" });
    this.stage = this.sizer.createDiv({ cls: "cv-stage" });
    this.frame = this.stage.createEl("iframe");
    this.frame.setAttr("sandbox", "allow-same-origin");
    this.marginGuide = this.stage.createDiv({ cls: "cv-guide margin" });
    this.marginGuide.createSpan({ text: "bottom margin" });
    this.pageGuides = [0, 1].map(() => {
      const el = this.stage.createDiv({ cls: "cv-guide page" });
      el.createSpan();
      return el;
    });
    this.observer = new ResizeObserver(() => this.rescale());
    this.observer.observe(this.scroller);
    this.rescale();
    this.plugin.refreshView();
  }

  async onClose() {
    this.observer?.disconnect();
  }

  buildPanels(root) {
    const panels = root.createDiv({ cls: "cv-panels" });
    this.lintPanel = panels.createEl("details", { cls: "cv-panel" });
    this.lintSummary = this.lintPanel.createEl("summary", { text: "Format check" });
    this.lintList = this.lintPanel.createDiv({ cls: "cv-issues" });

    this.kwPanel = panels.createEl("details", { cls: "cv-panel" });
    this.kwSummary = this.kwPanel.createEl("summary", { text: "Keywords" });
    const body = this.kwPanel.createDiv({ cls: "cv-kw" });
    this.kwText = body.createEl("textarea", { attr: { rows: "5", placeholder: "Paste the job posting here" } });
    this.kwPins = body.createEl("input", { attr: { type: "text", placeholder: "Pin extra terms, comma separated" } });
    this.kwResult = body.createDiv({ cls: "cv-kw-result" });
    this.kwCopy = this.kwPanel.createEl("button", { cls: "cv-kw-copy clickable-icon", attr: { "aria-label": "Copy keyword coverage" } });
    setIcon(this.kwCopy, "copy");
    this.kwCopy.addEventListener("click", async () => {
      if (!this.kwReport) return;
      await navigator.clipboard.writeText(this.kwReport);
      new Notice("Keyword coverage copied", 1500);
    });
    this.kwCopy.hide();
    const onInput = () => this.plugin.onPostingEdited(this.kwPath, this.kwText.value, this.kwPins.value);
    this.kwText.addEventListener("input", onInput);
    this.kwPins.addEventListener("input", onInput);
  }

  setLint(issues) {
    const { errors, warnings } = countLevels(issues);
    this.lintCountEl.empty();
    if (errors) this.lintCountEl.createSpan({ cls: "cv-count err", text: `${errors} error${errors === 1 ? "" : "s"}` });
    if (warnings) this.lintCountEl.createSpan({ cls: "cv-count warn", text: `${warnings} warning${warnings === 1 ? "" : "s"}` });
    this.lintSummary.setText(issues.length ? `Format check (${issues.length})` : "Format check: clean");
    this.lintList.empty();
    for (const issue of issues) {
      const row = this.lintList.createDiv({ cls: `cv-issue ${issue.level}` });
      row.createSpan({ cls: "cv-issue-line", text: `L${issue.line}` });
      row.createSpan({ text: issue.message });
      row.addEventListener("click", () => this.plugin.jumpToLine(issue.line));
    }
  }

  setKeywords(path, posting, cv) {
    if (this.kwPath !== path) {
      this.kwPath = path;
      this.kwText.value = posting.text;
      this.kwPins.value = posting.pins;
    }
    this.kwResult.empty();
    this.kwReport = "";
    if (!this.kwText.value.trim() && !splitPins(this.kwPins.value).length) {
      this.kwSummary.setText("Keywords");
      this.kwCopy.hide();
      return;
    }
    const r = coverage(cv, this.kwText.value, { pins: splitPins(this.kwPins.value) });
    this.kwReport = formatCoverageReport(r);
    this.kwCopy.show();
    this.kwSummary.setText(`Keywords: ${r.percent}% (${r.matched}/${r.total})`);
    const missing = r.terms.filter((t) => !t.matched);
    this.kwResult.createDiv({ cls: "cv-kw-head", text: `Coverage ${r.percent}%. Missing ${missing.length}. Click a term to copy it.` });
    const chips = this.kwResult.createDiv({ cls: "cv-chips" });
    for (const t of missing) {
      const chip = chips.createEl("button", { cls: "cv-chip missing", text: t.pinned ? `${t.term} (pinned)` : `${t.term} x${t.count}` });
      chip.addEventListener("click", async () => {
        await navigator.clipboard.writeText(t.term);
        new Notice(`Copied "${t.term}"`, 1500);
      });
    }
    const hits = this.kwResult.createDiv({ cls: "cv-kw-hits" });
    for (const t of r.terms.filter((x) => x.matched)) {
      const where = t.sections.map((s) => `${s.name} ${s.count}`).join(", ");
      hits.createDiv({ text: `${t.term}: ${t.hits} in ${where}` });
    }
  }

  setStatus(text, level) {
    this.statusEl.setText(text);
    this.statusEl.removeClass("ok", "tight", "over");
    if (level) this.statusEl.addClass(level);
  }

  rescale() {
    if (!this.scroller) return;
    const scale = Math.max(0.3, (this.scroller.clientWidth - 24) / A4_W);
    this.stage.style.width = `${A4_W}px`;
    this.stage.style.height = `${this.contentHeight}px`;
    this.stage.style.transform = `scale(${scale})`;
    this.sizer.style.width = `${A4_W * scale}px`;
    this.sizer.style.height = `${this.contentHeight * scale}px`;
  }

  setThemeChoice(id) {
    this.themeSelect.value = id;
  }

  async show(html, theme) {
    const token = (this.token = (this.token || 0) + 1);
    await new Promise((resolve) => {
      this.frame.onload = resolve;
      this.frame.srcdoc = html;
    });
    if (token !== this.token) return;
    const doc = this.frame.contentDocument;
    await doc.fonts.ready;
    if (token !== this.token) return;
    const cols = doc.querySelector(".cols");
    const bottomPx = cols.getBoundingClientRect().bottom;
    this.contentHeight = Math.max(A4_H, doc.documentElement.scrollHeight);
    const fit = fitPages({
      contentBottomPx: bottomPx,
      minBottomMarginPt: this.plugin.settings.minBottomMarginPt,
      geometry: theme.geometry,
      maxPages: theme.maxPages,
      linePt: theme.linePt,
    });
    this.marginGuide.style.top = `${fit.marginGuideY}px`;
    this.pageGuides.forEach((el, i) => {
      const g = fit.guides[i];
      el.style.display = g ? "" : "none";
      if (!g) return;
      el.style.top = `${g.y}px`;
      el.firstChild.setText(g.label);
    });
    this.contentHeight = Math.max(this.contentHeight, fit.guides[fit.guides.length - 1].y);
    this.frame.style.height = `${this.contentHeight}px`;
    this.rescale();
    this.setStatus(fit.text, fit.level);
  }

  showMessage(text) {
    this.token = (this.token || 0) + 1;
    this.setStatus(text);
  }
}

export default class CvLivePreviewPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.currentFile = null;
    this.timer = null;

    this.registerView(VIEW_TYPE, (leaf) => new CvView(leaf, this));
    this.addRibbonIcon("file-text", "Open CV preview", () => this.activateView());
    this.addCommand({ id: "open-preview", name: "Open CV preview", callback: () => this.activateView() });
    this.addCommand({ id: "export-pdf", name: "Export CV as PDF", callback: () => this.exportActive() });
    this.addSettingTab(new CvSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, info) => {
        if (info?.file && looksLikeCv(editor.getValue())) {
          this.currentFile = info.file;
          this.queueRender(editor.getValue());
        }
      }),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf?.view instanceof MarkdownView && leaf.view.file) this.follow(leaf.view.file);
      }),
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (this.currentFile && file.path === this.currentFile.path) this.follow(file);
      }),
    );
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  getView() {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    return leaf?.view instanceof CvView ? leaf.view : null;
  }

  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    this.refreshView();
  }

  refreshView() {
    const active = this.app.workspace.getActiveFile();
    if (active) this.follow(active);
    else if (this.currentFile) this.follow(this.currentFile);
  }

  async follow(file) {
    if (file.extension !== "md") return;
    const text = await this.readText(file);
    if (!looksLikeCv(text)) return;
    this.currentFile = file;
    this.queueRender(text);
  }

  // The open editor holds the newest text. Disk reads can lag behind it
  // because Obsidian autosaves on a delay and caches file contents.
  async readText(file) {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const v = leaf.view;
      if (v instanceof MarkdownView && v.file?.path === file.path && v.editor) return v.editor.getValue();
    }
    return this.app.vault.read(file);
  }

  queueRender(text) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.renderPreview(text), 250);
  }

  getPosting(path) {
    const p = this.settings.postings?.[path];
    return typeof p === "string" ? { text: p, pins: "" } : { text: p?.text ?? "", pins: p?.pins ?? "" };
  }

  onPostingEdited(path, text, pins) {
    if (!path) return;
    this.settings.postings = { ...this.settings.postings, [path]: { text, pins } };
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveSettings(), 500);
    this.getView()?.setKeywords(path, this.getPosting(path), this.lastText ?? "");
  }

  rememberContext(text) {
    try {
      const { meta } = parseCv(text);
      this.lastCtx = { name: meta.name, headline: meta.headline, title: this.currentFile?.basename ?? "", variant: readFrontmatter(text).variant ?? "" };
    } catch {
      // keep the previous context
    }
  }

  previewFilename() {
    return `${renderFilename(this.settings.filenameTemplate, { ...(this.lastCtx ?? SAMPLE_CTX), date: new Date() })}.pdf`;
  }

  async jumpToLine(line) {
    const path = this.currentFile?.path;
    const leaf = this.app.workspace.getLeavesOfType("markdown").find((l) => l.view instanceof MarkdownView && l.view.file?.path === path);
    if (!leaf) return new Notice("Open the note in an editor to jump to a line.");
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    const editor = leaf.view.editor;
    const pos = { line: Math.max(0, line - 1), ch: 0 };
    editor.setCursor(pos);
    editor.scrollIntoView({ from: pos, to: pos }, true);
  }

  renderPreview(text) {
    const view = this.getView();
    this.lastText = text;
    this.rememberContext(text);
    if (!view) return;
    view.setLint(lintCv(text));
    if (this.currentFile) view.setKeywords(this.currentFile.path, this.getPosting(this.currentFile.path), text);
    const choice = readOverrides(text).theme ?? "";
    const theme = this.resolveTheme(text);
    view.setThemeChoice(THEMES.some((t) => t.id === choice.toLowerCase()) ? choice.toLowerCase() : "");
    try {
      const html = renderHtml(text, { css: themeCss(theme), fontUrl: (f) => this.fontResourceUrl(f), preview: true, theme });
      view.show(html, theme);
    } catch (e) {
      view.showMessage(`Cannot render: ${e.message}`);
    }
  }

  resolveTheme(text) {
    return getTheme(readOverrides(text).theme, this.settings.defaultTheme);
  }

  // Writes cv-theme into the note's frontmatter, touching only that line.
  // An empty id removes the override so the note follows the default theme.
  async setNoteTheme(id) {
    const file = this.currentFile;
    if (!file) return;
    await this.app.vault.process(file, (data) => setFrontmatterKey(data, "cv-theme", id));
    this.follow(file);
  }

  fontResourceUrl(file) {
    return this.app.vault.adapter.getResourcePath(normalizePath(`${this.manifest.dir}/fonts/${file}`));
  }

  basePath() {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) throw new Error("Needs a local vault on desktop");
    return adapter.getBasePath();
  }


  async exportActive() {
    const file = this.app.workspace.getActiveFile() ?? this.currentFile;
    if (!file || file.extension !== "md") return new Notice("Open a CV note first.");
    try {
      const text = await this.readText(file);
      if (!looksLikeCv(text)) return new Notice("This note has no CV frontmatter (name and headline).");
      const result = await this.exportPdf(file, text);
      if (!result) return new Notice("Export cancelled.");
      this.announceExport(result);
    } catch (e) {
      new Notice(`PDF export failed: ${e.message}`, 8000);
    }
  }

  announceExport({ outPath: out, pages, maxPages }) {
    const base = this.basePath();
    const shown = out.startsWith(base) ? out.slice(base.length + 1) : out;
    const count = pages ? `${pages} page${pages === 1 ? "" : "s"}` : "";
    const over = pages > maxPages ? ` (over the ${maxPages}-page budget)` : "";
    const notice = new Notice(`CV exported${count ? `, ${count}${over}` : ""}: ${shown} (click to reveal)`, 8000);
    notice.noticeEl?.addEventListener("click", () => electron()?.shell?.showItemInFolder(out));
    const shell = electron()?.shell;
    if (this.settings.afterExport === "reveal") shell?.showItemInFolder(out);
    else if (this.settings.afterExport === "open") shell?.openPath(out);
  }

  async chooseOutPath(target) {
    if (!target.ask) return resolveCollision(target.path, existsSync, this.settings.onCollision);
    const dialog = electronRemote()?.dialog;
    if (!dialog) {
      new Notice("Save dialog unavailable in this Obsidian build; saving to the default location.");
      return resolveCollision(target.path, existsSync, this.settings.onCollision);
    }
    await mkdir(dirname(target.path), { recursive: true });
    const r = await dialog.showSaveDialog({ defaultPath: target.path, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    return r.canceled ? null : r.filePath;
  }

  async exportPdf(file, text) {
    const base = this.basePath();
    const pluginDir = join(base, this.manifest.dir);
    const overrides = readOverrides(text);
    const s = applyOverrides(this.settings, overrides);
    const { meta } = parseCv(text);
    const filename = `${renderFilename(s.filenameTemplate, {
      name: meta.name,
      headline: meta.headline,
      title: file.basename,
      variant: readFrontmatter(text).variant,
      date: new Date(),
    })}.pdf`;
    const noteDir = file.parent?.path === "/" ? "" : (file.parent?.path ?? "");
    const target = resolveTarget({ mode: s.exportMode, exportFolder: s.exportFolder, noteDir, vaultBase: base, filename });
    const outPath = await this.chooseOutPath(target);
    if (!outPath) return null;

    const chrome = findChrome({ configured: this.settings.chromePath, platform: process.platform, env: process.env, exists: existsSync });
    if (!chrome) throw new Error("No Chrome, Chromium, Edge, or Brave found. Set the Chrome path in settings.");

    const theme = this.resolveTheme(text);
    const html = renderHtml(text, { css: themeCss(theme), fontUrl: (f) => `file://${join(pluginDir, "fonts", f)}`, theme });
    const tmp = await mkdtemp(join(tmpdir(), "cv-live-preview-"));
    let pages = 0;
    try {
      const htmlPath = join(tmp, "cv.html");
      const rawPdf = join(tmp, "cv.pdf");
      await writeFile(htmlPath, html);
      await new Promise((resolve, reject) => {
        execFile(
          chrome.path,
          [
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--allow-file-access-from-files",
            `--user-data-dir=${join(tmp, "profile")}`,
            `--print-to-pdf=${rawPdf}`,
            `file://${htmlPath}`,
          ],
          { timeout: 60000 },
          (err) => (err ? reject(new Error(`Chrome failed (${err.message.split("\n")[0]}). Check the Chrome path in settings.`)) : resolve()),
        );
      });
      let bytes = await readFile(rawPdf);
      if (!hasTextLayer(bytes)) new Notice("Warning: the PDF has no font objects, so text may not be selectable.", 6000);
      if (this.settings.embedMetadata) bytes = await applyMetadata(bytes, buildMetadata(text, overrides));
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, bytes);
      pages = await countPages(bytes);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
    return { outPath, pages, maxPages: theme.maxPages };
  }

  openSettings() {
    const setting = this.app.setting;
    if (!setting?.open || !setting?.openTabById) return new Notice("Open Settings > Community plugins > CV Live Preview.");
    setting.open();
    setting.openTabById(this.manifest.id);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class CvSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    const save = () => this.plugin.saveSettings();
    containerEl.empty();

    new Setting(containerEl).setName("Export").setHeading();
    new Setting(containerEl)
      .setName("Export location")
      .setDesc("Next to the note, in a fixed folder, or ask in a save dialog each time.")
      .addDropdown((d) =>
        d
          .addOptions({ "next-to-note": "Next to the note", folder: "Fixed folder", ask: "Ask each time" })
          .setValue(settings.exportMode)
          .onChange(async (v) => {
            settings.exportMode = v;
            await save();
          }),
      );
    new Setting(containerEl)
      .setName("Export folder")
      .setDesc("Used by the fixed folder and ask modes. Absolute, or relative to the vault. Created if missing.")
      .addText((t) =>
        t.setValue(settings.exportFolder).onChange(async (v) => {
          settings.exportFolder = v.trim();
          await save();
        }),
      )
      .addButton((b) =>
        b.setButtonText("Choose").onClick(async () => {
          const dir = await pickFolder();
          if (dir) {
            settings.exportFolder = dir;
            await save();
            this.display();
          }
        }),
      );
    const preview = containerEl.createDiv({ cls: "setting-item-description cv-filename-preview" });
    const updatePreview = () => preview.setText(`Filename preview: ${this.plugin.previewFilename()}`);
    new Setting(containerEl)
      .setName("Filename template")
      .setDesc("Tokens: {name} {headline} {title} {variant} {date} {date:YYYY-MM-DD}. A note can override it with cv-filename.")
      .addText((t) =>
        t.setValue(settings.filenameTemplate).onChange(async (v) => {
          settings.filenameTemplate = v;
          await save();
          updatePreview();
        }),
      );
    updatePreview();
    new Setting(containerEl)
      .setName("If the file exists")
      .addDropdown((d) =>
        d
          .addOptions({ overwrite: "Overwrite", counter: "Add a counter, e.g. (2)" })
          .setValue(settings.onCollision)
          .onChange(async (v) => {
            settings.onCollision = v;
            await save();
          }),
      );
    new Setting(containerEl)
      .setName("After export")
      .addDropdown((d) =>
        d
          .addOptions({ none: "Do nothing", reveal: "Reveal in file manager", open: "Open the PDF" })
          .setValue(settings.afterExport)
          .onChange(async (v) => {
            settings.afterExport = v;
            await save();
          }),
      );
    new Setting(containerEl)
      .setName("Embed PDF metadata")
      .setDesc("Title, author, subject, and keywords. Override per note with cv-pdf-title, cv-pdf-author, cv-pdf-subject, cv-pdf-keywords.")
      .addToggle((t) =>
        t.setValue(settings.embedMetadata).onChange(async (v) => {
          settings.embedMetadata = v;
          await save();
        }),
      );

    new Setting(containerEl).setName("Theme").setHeading();
    new Setting(containerEl)
      .setName("Default theme")
      .setDesc("Used by notes without a cv-theme line. Pick a theme per note from the preview bar, or set cv-theme to classic, a, b, or c.")
      .addDropdown((d) =>
        d
          .addOptions(Object.fromEntries(THEMES.map((t) => [t.id, t.label])))
          .setValue(getTheme(settings.defaultTheme).id)
          .onChange(async (v) => {
            settings.defaultTheme = v;
            await save();
            this.plugin.refreshView();
          }),
      );

    new Setting(containerEl).setName("Preview").setHeading();
    new Setting(containerEl)
      .setName("Minimum bottom margin (pt)")
      .setDesc("The preview warns when content comes closer to the page end than this.")
      .addText((t) =>
        t.setValue(String(settings.minBottomMarginPt)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0) {
            settings.minBottomMarginPt = n;
            await save();
          }
        }),
      );

    new Setting(containerEl).setName("Chrome").setHeading();
    const found = this.findChrome();
    const chromeSetting = new Setting(containerEl)
      .setName("Chrome path")
      .setDesc(this.chromeDesc(found))
      .addText((t) =>
        t.setValue(settings.chromePath).onChange(async (v) => {
          settings.chromePath = v.trim();
          await save();
          chromeSetting.setDesc(this.chromeDesc(this.findChrome()));
        }),
      )
      .addButton((b) => b.setButtonText("Test").onClick(() => this.testChrome()));
  }

  findChrome() {
    return findChrome({ configured: this.plugin.settings.chromePath, platform: process.platform, env: process.env, exists: existsSync });
  }

  chromeDesc(found) {
    const base = "Chrome, Chromium, Edge, or Brave binary used to print the PDF. Auto-detected when this path is missing.";
    if (!found) return `${base} Nothing found.`;
    return `${base} Using ${found.source === "configured" ? "the configured path" : `auto-detected ${found.path}`}.`;
  }

  testChrome() {
    const found = this.findChrome();
    if (!found) return new Notice("No Chrome, Chromium, Edge, or Brave found. Set the path.", 6000);
    execFile(found.path, ["--version"], { timeout: 15000 }, (err, stdout) => {
      if (err) return new Notice(`Could not run ${found.path}: ${err.message.split("\n")[0]}`, 8000);
      new Notice(`Browser OK: ${stdout.trim() || found.path}`, 5000);
    });
  }
}

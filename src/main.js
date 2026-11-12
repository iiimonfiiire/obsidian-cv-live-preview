import { FileSystemAdapter, ItemView, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, normalizePath } from "obsidian";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCv, renderHtml } from "./render-core.mjs";
import css from "./carcharias.css";

const VIEW_TYPE = "cv-live-preview";
const A4_W = 793.7; // CSS px at 96 dpi
const A4_H = 1122.5;
const PX_TO_PT = 0.75;
const LINE_PT = 8.75 * 1.25; // body font size x line height in the template

const DEFAULTS = {
  chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  minBottomMarginPt: 30,
};

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
    const btn = bar.createEl("button", { text: "Export PDF" });
    btn.addEventListener("click", () => this.plugin.exportActive());
    this.scroller = root.createDiv({ cls: "cv-scroller" });
    this.sizer = this.scroller.createDiv({ cls: "cv-sizer" });
    this.stage = this.sizer.createDiv({ cls: "cv-stage" });
    this.frame = this.stage.createEl("iframe");
    this.frame.setAttr("sandbox", "allow-same-origin");
    this.marginGuide = this.stage.createDiv({ cls: "cv-guide margin" });
    this.marginGuide.createSpan({ text: "bottom margin" });
    this.pageGuide = this.stage.createDiv({ cls: "cv-guide page" });
    this.pageGuide.createSpan({ text: "page end" });
    this.observer = new ResizeObserver(() => this.rescale());
    this.observer.observe(this.scroller);
    this.rescale();
    this.plugin.refreshView();
  }

  async onClose() {
    this.observer?.disconnect();
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

  async show(html) {
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
    this.frame.style.height = `${this.contentHeight}px`;
    const minMarginPx = this.plugin.settings.minBottomMarginPt / PX_TO_PT;
    this.marginGuide.style.top = `${A4_H - minMarginPx}px`;
    this.pageGuide.style.top = `${A4_H}px`;
    this.rescale();

    const marginPt = (A4_H - bottomPx) * PX_TO_PT;
    if (marginPt < 0) {
      const lines = Math.ceil(-marginPt / LINE_PT);
      this.setStatus(`Overflows the page by ${Math.round(-marginPt)}pt (about ${lines} line${lines === 1 ? "" : "s"})`, "over");
    } else if (marginPt < this.plugin.settings.minBottomMarginPt) {
      this.setStatus(`Fits, but the bottom margin is only ${Math.round(marginPt)}pt`, "tight");
    } else {
      this.setStatus(`Fits one page, ${Math.round(marginPt)}pt bottom margin`, "ok");
    }
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

  renderPreview(text) {
    const view = this.getView();
    if (!view) return;
    try {
      const html = renderHtml(text, { css, fontUrl: (f) => this.fontResourceUrl(f) });
      view.show(html);
    } catch (e) {
      view.showMessage(`Cannot render: ${e.message}`);
    }
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
      const out = await this.exportPdf(file, text);
      new Notice(`CV exported: ${out}`);
    } catch (e) {
      new Notice(`PDF export failed: ${e.message}`, 8000);
    }
  }

  async exportPdf(file, text) {
    const base = this.basePath();
    const pluginDir = join(base, this.manifest.dir);
    const { meta } = parseCv(text);
    const html = renderHtml(text, { css, fontUrl: (f) => `file://${join(pluginDir, "fonts", f)}` });
    const tmp = await mkdtemp(join(tmpdir(), "cv-live-preview-"));
    const htmlPath = join(tmp, "cv.html");
    await writeFile(htmlPath, html);
    const safe = `${meta.name} - ${meta.headline}`.replace(/[\\/:*?"<>|]/g, "");
    const outPath = join(base, file.parent?.path ?? "", `${safe}.pdf`);
    await new Promise((resolve, reject) => {
      execFile(
        this.settings.chromePath,
        [
          "--headless=new",
          "--disable-gpu",
          "--no-pdf-header-footer",
          "--allow-file-access-from-files",
          `--user-data-dir=${join(tmp, "profile")}`,
          `--print-to-pdf=${outPath}`,
          `file://${htmlPath}`,
        ],
        { timeout: 60000 },
        (err) => (err ? reject(new Error(`Chrome failed (${err.message.split("\n")[0]}). Check the Chrome path in settings.`)) : resolve()),
      );
    });
    return outPath.replace(base + "/", "");
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
    containerEl.empty();
    new Setting(containerEl)
      .setName("Chrome path")
      .setDesc("Chrome or Chromium binary used to print the PDF.")
      .addText((t) =>
        t.setValue(this.plugin.settings.chromePath).onChange(async (v) => {
          this.plugin.settings.chromePath = v.trim();
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("Minimum bottom margin (pt)")
      .setDesc("The preview warns when content comes closer to the page end than this.")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.minBottomMarginPt)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0) {
            this.plugin.settings.minBottomMarginPt = n;
            await this.plugin.saveSettings();
          }
        }),
      );
  }
}

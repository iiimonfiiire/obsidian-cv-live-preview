// Resolve where an exported PDF goes. Pure: no fs, no Node APIs.
const ABS = /^(?:[a-zA-Z]:[\\/]|[\\/])/;

export const isAbsolute = (p) => ABS.test(p);

function sepFor(p) {
  return /^[a-zA-Z]:|\\/.test(p) && !p.includes("/") ? "\\" : "/";
}

export function joinPath(base, ...parts) {
  const sep = sepFor(base);
  const rest = parts.map((p) => (p || "").replace(/^[\\/]+|[\\/]+$/g, "")).filter(Boolean);
  return [base.replace(/[\\/]+$/, ""), ...rest].join(sep);
}

// mode: "next-to-note" | "folder" | "ask"
// noteDir: vault-relative folder of the note. vaultBase: absolute vault root.
export function resolveTarget({ mode, exportFolder, noteDir, vaultBase, filename }) {
  const folder = (exportFolder || "").trim();
  const noteFolder = joinPath(vaultBase, noteDir || "");
  let dir = noteFolder;
  if (mode === "folder" || mode === "ask") {
    if (folder) dir = isAbsolute(folder) ? folder : joinPath(vaultBase, folder);
  }
  return { dir, path: joinPath(dir, filename), ask: mode === "ask" };
}

export function splitExt(file) {
  const i = file.lastIndexOf(".");
  return i > 0 ? [file.slice(0, i), file.slice(i)] : [file, ""];
}

// exists: (path) => boolean. policy: "overwrite" | "counter".
export function resolveCollision(path, exists, policy) {
  if (policy !== "counter" || !exists(path)) return path;
  const [stem, ext] = splitExt(path);
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (!exists(candidate)) return candidate;
  }
  return path;
}

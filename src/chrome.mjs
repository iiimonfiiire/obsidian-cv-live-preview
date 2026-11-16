// Locate a Chromium-family browser. Pure: existence checks are injected.
export function chromeCandidates(platform, env = {}) {
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ];
  }
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean);
    const rel = [
      "Google\\Chrome\\Application\\chrome.exe",
      "Chromium\\Application\\chrome.exe",
      "Microsoft\\Edge\\Application\\msedge.exe",
      "BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    ];
    return roots.flatMap((r) => rel.map((p) => `${r.replace(/[\\/]+$/, "")}\\${p}`));
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/usr/bin/microsoft-edge",
    "/usr/bin/brave-browser",
  ];
}

// -> { path, source: "configured" | "env" | "auto" } or null
export function findChrome({ configured, platform, env = {}, exists }) {
  if (configured && exists(configured)) return { path: configured, source: "configured" };
  if (env.CHROME_BIN && exists(env.CHROME_BIN)) return { path: env.CHROME_BIN, source: "env" };
  const hit = chromeCandidates(platform, env).find((p) => exists(p));
  return hit ? { path: hit, source: "auto" } : null;
}

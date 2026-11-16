// Keyword coverage: terms from a job posting versus the CV text. Pure.
const STOP = new Set(
  `a about above across after again against all also am an and any are as at be because been before being below
between both but by can cannot could did do does doing down during each either else etc even ever every few for
from further had has have having he her here hers him his how i if in into is it its itself just like may me
might more most must my no nor not now of off on once only or other our ours out over own per same shall she
should so some such than that the their theirs them then there these they this those through to too under until
up upon us use used using very via was we were what when where which while who whom why will with within without
would yet you your yours able ability about apply applicants applicant benefits candidate candidates company
day days degree demonstrated description desired duties employer environment equal excellent experience
experienced following full great including include includes job join looking knowledge location looking
month months must need needed offer opportunity part plus position preferred required requirements requirement
responsibilities responsibility role skills strong team time understanding want well work working year years
ll re ve`.split(/\s+/),
);

const TOKEN = /\p{L}[\p{L}\p{N}]*(?:[.\/+#-][\p{L}\p{N}]+)*(?:\+\+|#)?/gu;

function stemWord(w) {
  if (w.length > 5 && w.endsWith("ing")) {
    let s = w.slice(0, -3);
    if (/(.)\1$/.test(s) && !/(ll|ss|zz)$/.test(s)) s = s.slice(0, -1);
    if (/[aeiouy]/.test(s)) return s;
  }
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(sses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function normalizeToken(raw) {
  const lower = raw.toLowerCase();
  if (!/^[\p{L}-]+$/u.test(lower)) return lower;
  return lower.split("-").map(stemWord).join("-");
}

export function tokenize(text) {
  const tokens = [];
  let prevEnd = -1;
  for (const m of String(text).matchAll(TOKEN)) {
    const raw = m[0];
    const lower = raw.toLowerCase();
    const symbolic = /[.\/+#]/.test(raw);
    tokens.push({
      raw,
      key: normalizeToken(raw),
      stop: STOP.has(lower) || (raw.length < 2 && !symbolic) || /^\d+$/.test(raw),
      tech: symbolic || (raw.length >= 2 && raw === raw.toUpperCase()),
      adj: prevEnd >= 0 && /^[ \t]+$/.test(text.slice(prevEnd, m.index)),
    });
    prevEnd = m.index + raw.length;
  }
  return tokens;
}

function ngrams(tokens, max = 3) {
  const found = new Map();
  const add = (toks, pos) => {
    const key = toks.map((t) => t.key).join(" ");
    const e = found.get(key) ?? { key, term: toks.map((t) => t.raw).join(" "), count: 0, pos, n: toks.length, tech: false };
    e.count++;
    e.tech ||= toks.some((t) => t.tech);
    found.set(key, e);
  };
  tokens.forEach((t, i) => {
    if (t.stop) return;
    add([t], i);
    for (let n = 2; n <= max; n++) {
      const win = tokens.slice(i, i + n);
      if (win.length < n || win.some((w, j) => w.stop || (j > 0 && !w.adj))) break;
      add(win, i);
    }
  });
  return found;
}

// -> [{ term, key, count }] ranked by frequency; phrases need 2+ occurrences.
export function extractTerms(posting, { limit = 40 } = {}) {
  const found = ngrams(tokenize(posting));
  const phrases = [...found.values()].filter((e) => e.n > 1 && e.count >= 2).sort((a, b) => b.n - a.n);
  for (const p of phrases) {
    const words = p.key.split(" ");
    for (let n = 1; n < words.length; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const sub = found.get(words.slice(i, i + n).join(" "));
        if (sub) sub.count -= p.count;
      }
    }
  }
  return [...found.values()]
    .filter((e) => e.count > 0 && (e.n === 1 || e.count >= 2))
    .sort((a, b) => b.count + (b.tech ? 1 : 0) - (a.count + (a.tech ? 1 : 0)) || a.pos - b.pos)
    .slice(0, limit)
    .map(({ term, key, count }) => ({ term, key, count }));
}

export function cvSections(cv) {
  const body = String(cv).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const parts = body.split(/^## (.+)$/m);
  const out = [{ name: "Summary", text: parts[0] }];
  for (let i = 1; i < parts.length; i += 2) out.push({ name: parts[i].trim(), text: parts[i + 1] || "" });
  return out;
}

function countPhrase(keys, words) {
  let n = 0;
  for (let i = 0; i + words.length <= keys.length; i++) {
    if (words.every((w, j) => keys[i + j] === w)) n++;
  }
  return n;
}

// pins: extra terms to always check. -> { terms, matched, total, percent }
export function coverage(cv, posting, { pins = [], limit = 40 } = {}) {
  const terms = extractTerms(posting, { limit }).map((t) => ({ ...t, pinned: false }));
  const known = new Set(terms.map((t) => t.key));
  const postingKeys = tokenize(posting).map((t) => t.key);
  for (const pin of pins) {
    const toks = tokenize(pin);
    if (!toks.length) continue;
    const key = toks.map((t) => t.key).join(" ");
    if (known.has(key)) {
      terms.find((t) => t.key === key).pinned = true;
      continue;
    }
    known.add(key);
    terms.push({ term: pin.trim(), key, count: countPhrase(postingKeys, key.split(" ")), pinned: true });
  }
  const sections = cvSections(cv).map((s) => ({ name: s.name, keys: tokenize(s.text).map((t) => t.key) }));
  for (const t of terms) {
    const words = t.key.split(" ");
    t.sections = sections
      .map((s) => ({ name: s.name, count: countPhrase(s.keys, words) }))
      .filter((s) => s.count > 0);
    t.hits = t.sections.reduce((a, s) => a + s.count, 0);
    t.matched = t.hits > 0;
  }
  const matched = terms.filter((t) => t.matched).length;
  return { terms, matched, total: terms.length, percent: terms.length ? Math.round((matched / terms.length) * 100) : 0 };
}

// Plain-text report of a coverage() result, for pasting into another tool.
export function formatCoverageReport(r) {
  const missing = r.terms.filter((t) => !t.matched);
  const hits = r.terms.filter((t) => t.matched);
  const lines = [`Keyword coverage: ${r.percent}% (${r.matched}/${r.total})`, "", `Missing (${missing.length}):`];
  for (const t of missing) lines.push(`- ${t.term}${t.pinned ? " (pinned)" : ` x${t.count}`}`);
  if (!missing.length) lines.push("- none");
  lines.push("", `Matched (${hits.length}):`);
  for (const t of hits) lines.push(`- ${t.term}: ${t.hits} in ${t.sections.map((x) => `${x.name} ${x.count}`).join(", ")}`);
  if (!hits.length) lines.push("- none");
  return lines.join("\n") + "\n";
}

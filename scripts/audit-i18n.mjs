import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const { en, es } = await import("../js/ui/i18n/dictionaries.js");

function* walk(dir, ext) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p, ext);
    else if (ext.test(p)) yield p;
  }
}

const filesToScan = ["index.html",
  ...Array.from(walk("js", /\.js$/) ),
];

const refs = new Set();

// 1. data-i18n / data-i18n-html / data-i18n-placeholder → a single key
for (const file of filesToScan) {
  const src = readFileSync(file, "utf8");
  let m;
  const dataRe = /data-i18n(-[a-z]+)?=["']([^"']+)["']/g;
  while ((m = dataRe.exec(src)) !== null) {
    const variant = m[1] || "";
    const body = m[2];
    if (variant === "-attr") {
      for (const pair of body.split(/[,;]/)) {
        const [, key] = pair.split(":").map((s) => s.trim());
        if (key) refs.add(key);
      }
    } else {
      refs.add(body);
    }
  }
}

// 2. JS: t("..."), t('...'), t(\`...\`) calls
for (const file of filesToScan) {
  const src = readFileSync(file, "utf8");
  const tRe = /\bt\(\s*[`"']([^`"']+)[`"']/g;
  let m;
  while ((m = tRe.exec(src)) !== null) {
    refs.add(m[1]);
  }
}

const flat = (obj, prefix = "") => {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + "." + k : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...flat(v, key));
    else out.push(key);
  }
  return out;
};
const all = new Set([...flat(en), ...flat(es)]);

const missing = [...refs].filter((k) => !all.has(k)).sort();
const unused = [...all].filter((k) => !refs.has(k)).sort();

console.log("\n### Missing references (referenced but not in dictionary)");
if (missing.length === 0) {
  console.log("  (none — all references resolve ✓)");
} else {
  for (const k of missing) console.log("  -", k);
}

console.log("\n### Defined but never referenced");
console.log(`  ${unused.length} keys (kept for future use)`);

process.exit(missing.length > 0 ? 1 : 0);

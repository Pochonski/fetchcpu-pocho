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

// 2. JS: t("..."), t('...'), t(`...`) and tFn("...") calls.
for (const file of filesToScan) {
  const src = readFileSync(file, "utf8");
  const tRe = /\b(?:t|tFn)\(\s*[`"']([^`"']+)[`"']/g;
  let m;
  while ((m = tRe.exec(src)) !== null) {
    refs.add(m[1]);
  }
}

// 2b. JS: error("key", ...) calls — the parser emits error keys that the
// UI later resolves via t(err.key, err.args). The string literal is the
// only reference to that i18n key.
for (const file of filesToScan) {
  const src = readFileSync(file, "utf8");
  const errRe = /\berror\(\s*[`"']([^`"']+)[`"']/g;
  let m;
  while ((m = errRe.exec(src)) !== null) {
    refs.add(m[1]);
  }
}

// 2c. JS: ["dotted.key"] or ['dotted.key'] bracket-access references,
// including on the in-file EN/ES fallback objects (parser.js uses these).
for (const file of filesToScan) {
  const src = readFileSync(file, "utf8");
  const brRe = /\[\s*[`"']([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)[`"']\s*\]/g;
  let m;
  while ((m = brRe.exec(src)) !== null) {
    refs.add(m[1]);
  }
}

// 3. readArray("path.to.array") — dotted paths reaching into arrays/objects
//    used by main.js to read template-rendered tables.
for (const file of filesToScan) {
  const src = readFileSync(file, "utf8");
  const aRe = /\breadArray\(\s*[`"']([^`"']+)[`"']/g;
  let m;
  while ((m = aRe.exec(src)) !== null) {
    refs.add(m[1]);
  }
}

// 4. Dynamic t(`a.${x}`).foo / t(`a.${x}`)["foo"] — projection access.
//    The audit can't know what value `x` will take, so we register the
//    dynamic prefix plus a wildcard suffix that the dictionary matcher
//    resolves below.
const dynamicAccess = []; // [{ prop, isFullAccess }]
for (const file of filesToScan) {
  const src = readFileSync(file, "utf8");
  const dRe = /\bt\(\s*[`"']([^`"']+)[`"']\s*\)\s*(?:\.([a-zA-Z_$][\w$]*)|\[["']?([a-zA-Z_$][\w$]*)["']?\])/g;
  let m;
  while ((m = dRe.exec(src)) !== null) {
    const base = m[1];
    const prop = m[2] || m[3];
    if (base.includes("${")) {
      refs.add(`${base}__WILDCARD__`);
      dynamicAccess.push({ base, prop });
    }
  }
  // Also catch direct dynamic t(`prefix.${x}`) with no projection — match
  // any leaf under that prefix.
  const dRe2 = /\bt\(\s*[`"']([^`"']+\$\{[^`"']+\}[^`"']*)[`"']\s*\)/g;
  let m2;
  while ((m2 = dRe2.exec(src)) !== null) {
    const base = m2[1];
    if (dynamicAccess.some((a) => a.base === base)) continue;
    refs.add(`${base}__WILDCARD__`);
    dynamicAccess.push({ base, prop: null });
  }
}

const flat = (obj, prefix = "", leaves = []) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + "." + k : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flat(v, key, leaves);
    } else {
      leaves.push(key);
    }
  }
  return leaves;
};
const flatAll = (obj, prefix = "", out = []) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + "." + k : k;
    out.push(key);
    if (v && typeof v === "object" && !Array.isArray(v)) flatAll(v, key, out);
  }
  return out;
};
const leaves = [...flat(en), ...flat(es)];
const all = new Set([...flatAll(en), ...flatAll(es)]);

// A "missing" reference is one that resolves to nothing. But t(`a.${x}`) is a
// template literal where the static prefix may match a real key (e.g.
// `access.phases.${label}` resolves to `access.phases.fetch` etc. at runtime).
// Drop those false positives by checking whether the prefix exists.
const SKIP_REFS = new Set(["key"]); // placeholder in docstrings
const missing = [];
let templateIgnored = 0;
for (const key of refs) {
  if (SKIP_REFS.has(key)) continue;
  if (all.has(key)) continue;
  // Dynamic t(`a.${x}`).foo — expand the wildcard to any leaf in the prefix
  // subtree.
  if (key.endsWith("__WILDCARD__")) {
    // Find the matching dynamic-access record.
    const base = key.slice(0, -"__WILDCARD__".length);
    const rec = dynamicAccess.find((a) => a.base === base);
    if (rec) {
      // Figure out the static prefix (everything before the first ${...}).
      const staticPrefix = base.replace(/\$\{[^}]+\}/g, "");
      // Remove trailing dot.
      const root = staticPrefix.replace(/\.$/, "");
      if (rec.prop) {
        // Add every leaf matching `${root}.<anything>.${prop}`.
        for (const leaf of leaves) {
          if (leaf.startsWith(root + ".") && leaf.endsWith("." + rec.prop)) {
            refs.add(leaf);
          }
        }
      } else {
        // No projection: add every leaf under root.
        for (const leaf of leaves) {
          if (leaf.startsWith(root + ".")) refs.add(leaf);
        }
      }
      refs.add(root);
    }
    continue;
  }
  // Walk from the first dot outward, treating the suffix as a possible
  // template-literal expression. If any prefix exists in the dictionary, the
  // reference is dynamic-but-valid.
  let idx = key.indexOf(".");
  let matched = false;
  while (idx > 0) {
    const prefix = key.slice(0, idx);
    if (all.has(prefix)) {
      templateIgnored++;
      matched = true;
      break;
    }
    idx = key.indexOf(".", idx + 1);
  }
  if (!matched) missing.push(key);
}
missing.sort();

const unused = [...new Set(leaves)].filter((k) => !refs.has(k)).sort();

console.log("\n### Missing references (referenced but not in dictionary)");
if (missing.length === 0) {
  console.log(`  (none — all references resolve ✓ — ${templateIgnored} template-literal suffix ignored)`);
} else {
  for (const k of missing) console.log("  -", k);
}

console.log("\n### Defined but never referenced");
console.log(`  ${unused.length} keys (kept for future use)`);

process.exit(missing.length > 0 ? 1 : 0);

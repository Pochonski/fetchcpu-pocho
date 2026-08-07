// Lightweight i18n helper.
//
//   - t("key", args?)              → string
//   - setLanguage("en" | "es")     → applies language, fires event
//   - currentLanguage()            → string
//   - registerOnChange(fn)          → notify on language switch
//
// Keys use dot-notation. Interpolation uses {0}, {1} placeholders.
// Missing keys return the key itself with a console warning (so untranslated
// strings are obviously discoverable in the UI).

import { en, es, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "./dictionaries.js";

const STORAGE_KEY = "lmc-language";

const dictionaries = { en, es };
let current = readPersisted();
const changeListeners = new Set();

if (!dictionaries[current]) current = DEFAULT_LANGUAGE;

function readPersisted() {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_LANGUAGE;
    const v = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(v) ? v : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function lookup(d, key) {
  const parts = key.split(".");
  let cur = d;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function t(key, ...args) {
  const dict = dictionaries[current] || dictionaries[DEFAULT_LANGUAGE];
  const value = lookup(dict, key);
  if (value === undefined) {
    console.warn(`[i18n] missing key "${key}" for "${current}"`);
    return key;
  }
  if (typeof value === "string") {
    if (args.length === 0) return value;
    const interpolated = Array.isArray(args[0]) || (args.length === 1 && typeof args[0] === "object")
      ? args[0]
      : args;
    return value
      .replace(/\{(\d+)\}/g, (_, n) => {
        const idx = Number(n);
        return Object.prototype.hasOwnProperty.call(interpolated, idx)
          ? String(interpolated[idx])
          : "";
      })
      .replace(/\{([a-zA-Z_][\w]*)\}/g, (_, name) => {
        return Object.prototype.hasOwnProperty.call(interpolated, name)
          ? String(interpolated[name])
          : "";
      });
  }
  return value;
}

export function currentLanguage() { return current; }

export function languages() { return SUPPORTED_LANGUAGES.slice(); }

export function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  for (const fn of changeListeners) {
    try { fn(current); } catch (e) { console.error(e); }
  }
}

export function registerOnChange(fn) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

/**
 * Walk the DOM and translate any element that has `data-i18n="key"`.
 * Optionally handle attribute translations via `data-i18n-attr="attr:key"`.
 * For attribute translations multiple pairs can be separated by `,` or `;`.
 */
export function translateDom(root = document.body) {
  // Element text content
  const textNodes = root.querySelectorAll("[data-i18n]");
  textNodes.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  // innerHTML translations
  const htmlNodes = root.querySelectorAll("[data-i18n-html]");
  htmlNodes.forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (key) el.innerHTML = t(key);
  });
  // Attribute translations: multiple pairs separated by , or ;
  const attrNodes = root.querySelectorAll("[data-i18n-attr]");
  attrNodes.forEach((el) => {
    const spec = el.getAttribute("data-i18n-attr") || "";
    spec.split(/[,;]/).forEach((pair) => {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && key) {
        el.setAttribute(attr, t(key));
      }
    });
  });
  // Placeholder translations
  const ph = root.querySelectorAll("[data-i18n-placeholder]");
  ph.forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) el.setAttribute("placeholder", t(key));
  });
}

export function initI18n() {
  document.documentElement.lang = current;
  document.documentElement.dataset.lang = current;
}

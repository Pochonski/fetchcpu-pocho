// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

function read(rel) { return readFileSync(resolve(ROOT, rel), "utf8"); }

describe("i18n module", () => {
  it("resolves nested keys with dotted notation", async () => {
    const { t } = await import("../js/ui/i18n/index.js");
    expect(t("app.name")).toBeTruthy();
    expect(t("panels.editor.title")).toBeTruthy();
    expect(t("panels.cpu.registers.pc")).toBe("PC");
  });

  it("supports positional interpolation with varargs and arrays", async () => {
    const { t } = await import("../js/ui/i18n/index.js");
    expect(t("log.loaded", 5)).toMatch(/5/);
    expect(t("log.loaded", [42])).toMatch(/42/);
  });

  it("falls back to the key text when missing", async () => {
    const { t } = await import("../js/ui/i18n/index.js");
    expect(t("nonexistent.path.here")).toBe("nonexistent.path.here");
  });

  it("returns arrays when given an array key", async () => {
    const { t } = await import("../js/ui/i18n/index.js");
    const arr = t("modal.instructions.instructions");
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[0][0]).toBe("INP");
  });
});

describe("translateDom", () => {
  beforeEach(() => {
    const html = `<!doctype html><html><body>
      <span data-i18n="app.name">placeholder</span>
      <span data-i18n-html="modal.about.credits">placeholder</span>
      <span data-i18n-placeholder="panels.cpu.inputPlaceholder">old</span>
      <button data-i18n-attr="title:panels.cpu.faster">step</button>
      <button data-i18n-attr="title:panels.cpu.faster;aria-label:panels.cpu.faster">step</button>
    </body></html>`;
    document.documentElement.innerHTML = html;
  });

  it("translates data-i18n text content", async () => {
    const { translateDom } = await import("../js/ui/i18n/index.js");
    translateDom(document.body);
    expect(document.querySelector("[data-i18n='app.name']").textContent).toMatch(/Pocho LMC/);
  });

  it("translates data-i18n-html innerHTML", async () => {
    const { translateDom } = await import("../js/ui/i18n/index.js");
    translateDom(document.body);
    const el = document.querySelector("[data-i18n-html]");
    expect(el.innerHTML).toMatch(/101Computing|Wikipedia/);
  });

  it("translates placeholder via data-i18n-placeholder", async () => {
    const { translateDom } = await import("../js/ui/i18n/index.js");
    translateDom(document.body);
    expect(document.querySelector("[data-i18n-placeholder]").getAttribute("placeholder")).toMatch(/numeric|valor/);
  });

  it("translates one attribute via data-i18n-attr", async () => {
    const { translateDom } = await import("../js/ui/i18n/index.js");
    translateDom(document.body);
    const btn = document.querySelectorAll("button")[0];
    expect(btn.getAttribute("title")).toMatch(/Faster|Más rápido/);
    // Single-pair attribute should leave aria-label untouched (or null)
    const al = btn.getAttribute("aria-label");
    if (al != null) expect(al).toBe("step");
  });

  it("translates multiple attributes separated by semicolons", async () => {
    const { translateDom } = await import("../js/ui/i18n/index.js");
    translateDom(document.body);
    const btn = document.querySelectorAll("button")[1];
    expect(btn.getAttribute("title")).toMatch(/Faster|Más rápido/);
    expect(btn.getAttribute("aria-label")).toMatch(/Faster|Más rápido/);
  });
});

describe("Language switch (EN/ES)", () => {
  let errors;
  beforeEach(async () => {
    errors = [];
    const store = new Map();
    if (!globalThis.localStorage) {
      Object.defineProperty(globalThis, "localStorage", {
        value: {
          getItem: (k) => store.get(k) ?? null,
          setItem: (k, v) => store.set(k, v),
          removeItem: (k) => store.delete(k),
          clear: () => store.clear(),
        },
      });
    }
    document.documentElement.innerHTML = read("index.html").match(/<body>([\s\S]*?)<\/body>/,)[1];
    // First import: side-effect boot() fires with persisted lang (default en).
    // Force a fresh boot by importing with cache buster.
    const main = await import("../js/main.js?v=2");
    try { main.resetBoot(); main.boot(); } catch (e) { errors.push(e.message); }
  });

  it("starts with English as the default language", () => {
    const btn = document.querySelector(".lang-btn[data-lang='en']");
    const btnEs = document.querySelector(".lang-btn[data-lang='es']");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btnEs.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector("#editor-title").textContent).toMatch(/Program · Assembly|Programa/i);
  });

  it("switches to Spanish when the ES button is clicked", () => {
    const btnEs = document.querySelector(".lang-btn[data-lang='es']");
    btnEs.click();
    // After click, EN should be released, ES pressed
    const btnEn = document.querySelector(".lang-btn[data-lang='en']");
    expect(btnEs.getAttribute("aria-pressed")).toBe("true");
    expect(btnEn.getAttribute("aria-pressed")).toBe("false");
    // Spanish translation of the editor panel title should now be in place
    expect(document.querySelector("#editor-title").textContent).toMatch(/Programa/i);
    // Load button should also be translated
    expect(document.querySelector("#btn-load").textContent).toMatch(/Cargar/i);
    // Run button
    expect(document.querySelector("#btn-run").textContent).toMatch(/Ejecutar/i);
  });

  it("updates the program blurb when language changes", () => {
    const sel = document.querySelector("#files");
    sel.value = "1";
    sel.dispatchEvent(new Event("change"));

    expect(document.querySelector("#blurb-title").textContent).toMatch(/Adding 2 inputs|Sumar 2 entradas/);

    document.querySelector(".lang-btn[data-lang='es']").click();
    sel.dispatchEvent(new Event("change"));
    expect(document.querySelector("#blurb-title").textContent).toMatch(/Sumar 2 entradas/);

    document.querySelector(".lang-btn[data-lang='en']").click();
    sel.dispatchEvent(new Event("change"));
    expect(document.querySelector("#blurb-title").textContent).toMatch(/Adding 2 inputs/);
  });

  it("stats labels are translated", () => {
    // Switch to stats tab
    document.querySelector("#tab-stats").click();
    document.querySelector(".lang-btn[data-lang='es']").click();
    const labels = Array.from(document.querySelectorAll(".stat-label")).map((e) => e.textContent);
    // Spanish labels include Ciclos, Instrucciones, etc.
    expect(labels.some((l) => /Ciclos/i.test(l))).toBe(true);

    document.querySelector(".lang-btn[data-lang='en']").click();
    const enLabels = Array.from(document.querySelectorAll(".stat-label")).map((e) => e.textContent);
    expect(enLabels.some((l) => /Cycles/i.test(l))).toBe(true);
  });
});

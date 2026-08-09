// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { en as enDict, es as esDict } from "../js/ui/i18n/dictionaries.js";

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

  it("supports named placeholders like {keys}", async () => {
    const { t } = await import("../js/ui/i18n/index.js");
    // footer.text contains {keys}
    const out = t("footer.text", { keys: "<kbd>F5</kbd>" });
    expect(out).toContain("<kbd>F5</kbd>");
    expect(out).not.toContain("{keys}");
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
      <span data-i18n-placeholder="panels.cpu.inputAddValue">old</span>
      <button data-i18n-attr="title:panels.cpu.faster">step</button>
      <button data-i18n-attr="title:panels.cpu.faster;aria-label:panels.cpu.faster">step</button>
    </body></html>`;
    document.documentElement.innerHTML = html;
  });

  it("translates data-i18n text content", async () => {
    const { translateDom } = await import("../js/ui/i18n/index.js");
    translateDom(document.body);
    expect(document.querySelector("[data-i18n='app.name']").textContent).toMatch(/FetchCPU-Pocho/);
  });

  it("translates data-i18n-html innerHTML", async () => {
    const { translateDom } = await import("../js/ui/i18n/index.js");
    translateDom(document.body);
    const el = document.querySelector("[data-i18n-html]");
    expect(el.innerHTML).toMatch(/Pocho|Pochonski/);
  });

  it("translates placeholder via data-i18n-placeholder", async () => {
    const { translateDom } = await import("../js/ui/i18n/index.js");
    translateDom(document.body);
    expect(document.querySelector("[data-i18n-placeholder]").getAttribute("placeholder")).toMatch(/Add value|Añadir valor/);
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

describe("Language switch (EN/ES) — no English leakage", () => {
  beforeEach(async () => {
    // Reset language persistence so this describe doesn't poison later ones.
    try { localStorage.removeItem("fetchcpu-language"); } catch { /* ignore */ }

    if (!globalThis.localStorage) {
      const store = new Map();
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
    const main = await import("../js/main.js?v=es-leak");
    main.resetBoot();
    main.boot();
    document.querySelector(".lang-btn[data-lang='es']").click();
  });

  it("the explanation idle text is translated to Spanish", () => {
    // The explanation-controls text is set by setExplanationText() during
    // loadProgram() (called on boot) and then re-rendered by translateDom()
    // on language switch. Both should yield the Spanish string.
    const text = document.getElementById("explanation-controls").textContent;
    expect(text).toMatch(/Pulsa Paso o Ejecutar/i);
    expect(text).not.toMatch(/Press Step or Run/i);
  });

  it("the editor panel title is in Spanish", () => {
    expect(document.getElementById("editor-title").textContent).toMatch(/Programa/i);
    expect(document.getElementById("btn-load").textContent).toMatch(/Cargar/i);
    expect(document.getElementById("btn-run").textContent).toMatch(/Ejecutar/i);
  });

  it("the RAM stats strip uses Spanish labels", () => {
    const stats = document.getElementById("ram-stats");
    expect(stats).toBeTruthy();
    // Trigger a render by loading an example.
    document.querySelector("#btn-try-example").click();
    const text = stats.textContent;
    expect(text).toMatch(/usadas/);
    expect(text).toMatch(/instrucciones/);
    expect(text).toMatch(/datos/);
    expect(text).not.toMatch(/\bused\b/i);
    expect(text).not.toMatch(/\binstructions\b/i);
  });

  it("the History tab uses 'ciclo' (not 'cycle')", () => {
    // Load an example so history gets entries.
    document.querySelector("#btn-try-example").click();
    document.querySelector("#tab-history").click();
    const list = document.getElementById("history-list");
    expect(list.textContent).toMatch(/ciclo/i);
    expect(list.textContent).not.toMatch(/\bcycle\b/i);
  });

  it("parser error messages come out in Spanish", () => {
    const ta = document.getElementById("codeListing");
    ta.value = "FOO\n";
    ta.dispatchEvent(new Event("input"));
    document.querySelector("#btn-load").click();
    const log = document.getElementById("log");
    expect(log.textContent).toMatch(/Mnemónico desconocido/i);
    expect(log.textContent).not.toMatch(/Unknown mnemonic/i);
  });

  it("the disasm view shows 'DETENIDO' (not 'HALTED') after HLT", () => {
    document.querySelector("#btn-try-example").click();
    // Poll until HLT fires.
    let halted = false;
    for (let i = 0; i < 80; i++) {
      const t = document.getElementById("disasm-next").textContent;
      if (/DETENIDO|HALTED/.test(t)) { halted = true; break; }
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "F9" }));
    }
    expect(halted).toBe(true);
    const text = document.getElementById("disasm-next").textContent;
    expect(text).toMatch(/DETENIDO/);
    expect(text).not.toMatch(/HALTED/);
  });

  it("the footer keys use Spanish labels", () => {
    const footer = document.querySelector(".app-footer");
    expect(footer.textContent).toMatch(/ejecutar/);
    expect(footer.textContent).not.toMatch(/\brun\b/i);
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

  // Always start these tests with English as the active language. Other
  // describes may have flipped to Spanish; reset before each test.
  beforeEach(async () => {
    try { localStorage.removeItem("fetchcpu-language"); } catch { /* ignore */ }
    const { setLanguage } = await import("../js/ui/i18n/index.js?v=reset-en");
    setLanguage("en");
    document.querySelectorAll(".lang-btn").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.lang === "en" ? "true" : "false");
    });
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

describe("Instruction Set modal content", () => {
  it("renders Mnemonic / Name / Description / Op Code columns and eleven rows", async () => {
    // Open the modal (in case it's not auto-mounted).
    document.getElementById("linkPopup").hidden = false;
    // rebuildModalContent is called on language change — call it now.
    const main = await import("../js/main.js?v=fcpu");
    main.resetBoot();
    main.boot();

    const head = document.querySelectorAll("#instructions-thead-row th");
    expect(head.length).toBe(4);
    expect(head[0].textContent.toLowerCase()).toContain("mnemonic");
    expect(head[1].textContent.toLowerCase()).toContain("name");
    expect(head[2].textContent.toLowerCase()).toContain("description");
    expect(head[3].textContent.toLowerCase()).toContain("op");

    const rows = document.querySelectorAll("#instructions-tbody tr");
    // 11 standard mnemonics (INP, OUT, LDA, STA, ADD, SUB, BRP, BRZ, BRA, HLT, DAT)
    expect(rows.length).toBeGreaterThanOrEqual(11);

    // Confirm INP row uses the new four-column shape and the long description.
    const inpRow = Array.from(rows).find((r) => r.textContent.includes("INPUT"));
    expect(inpRow).toBeTruthy();
    expect(inpRow.textContent).toMatch(/Read user input/i);
    // 901 lives inside a <code> in the Op Code column.
    expect(inpRow.querySelector("code")?.textContent ?? inpRow.textContent).toMatch(/901/);

    // DAT row has no op code cell (or has empty code cell).
    const datRow = Array.from(rows).find((r) => r.textContent.includes("DATA LOCATION"));
    expect(datRow).toBeTruthy();
    expect(datRow.querySelectorAll("td").length).toBe(3);

    // The phase key + F10 shortcut is rendered in the footer.
    const footer = document.querySelector(".app-footer");
    expect(footer.textContent).toContain("F10");
  });
});

describe("CPU + RAM didactic tooltips", () => {
  it("every register label has a translated tooltip", () => {
    for (const reg of ["pc", "cir", "mar", "mdr", "acc"]) {
      const label = document.querySelector(`label[for="${reg}"]`);
      expect(label).toBeTruthy();
      const enTip = enDict.panels.cpu.tip[reg];
      const esTip = esDict.panels.cpu.tip[reg];
      // Real explanation, not a one-word label.
      expect(enTip.length).toBeGreaterThan(20);
      expect(esTip.length).toBeGreaterThan(20);
      // Falls back to a non-empty title attribute even before translateDom.
      const title = label.getAttribute("title");
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(20);
    }
  });

  it("every RAM legend item has a translated tooltip", () => {
    for (const item of ["pc", "mar", "code", "data"]) {
      const span = document.querySelector(`.legend-item.${item === "pc" ? "legend-active" : item === "mar" ? "legend-mar" : item === "code" ? "legend-code" : "legend-data"}`);
      expect(span).toBeTruthy();
      const tip = enDict.panels.ram.legendTip[item];
      expect(tip).toBeTruthy();
      expect(tip.length).toBeGreaterThan(15);
    }
  });

  it("the FDE flow container has a tooltip explaining the cycle", () => {
    const flow = document.getElementById("fde-indicator");
    expect(flow).toBeTruthy();
    expect(flow.getAttribute("title").length).toBeGreaterThan(20);
    // The EN translation of the FDE tip must mention each phase name.
    const enFde = enDict.panels.cpu.tip.fde;
    expect(enFde).toMatch(/Fetch/i);
    expect(enFde).toMatch(/Decode|Decodif/i);
    expect(enFde).toMatch(/Execute|Ejecución/i);
  });
});

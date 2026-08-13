// @vitest-environment jsdom
// Regression test for the panel collapse/expand toggle on the wide-desktop
// layout (≥1640 px). Activity and Editor both expose a chevron that flips
// `data-collapsed` on the panel and persists the state in localStorage so
// the layout is sticky across reloads.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

let main;

beforeAll(async () => {
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
  const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(
    /<body>([\s\S]*?)<\/body>/,
  )[1];
  document.documentElement.innerHTML = body;
  main = await import(resolve(ROOT, "js/main.js"));
  main.boot();
});

beforeEach(() => {
  localStorage.clear();
  delete document.getElementById("editor-panel").dataset.collapsed;
  delete document.getElementById("log-panel").dataset.collapsed;
  document.getElementById("btn-toggle-editor").setAttribute("aria-expanded", "true");
  document.getElementById("btn-toggle-log").setAttribute("aria-expanded", "true");
});

describe("panel toggle — DOM contract", () => {
  it("renders a collapse button in the Editor panel header", () => {
    const btn = document.getElementById("btn-toggle-editor");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(btn.getAttribute("aria-controls")).toBe("editor-panel");
    expect(btn.querySelector("svg.icon-collapse")).toBeTruthy();
  });

  it("renders a collapse button in the Activity panel header", () => {
    const btn = document.getElementById("btn-toggle-log");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(btn.getAttribute("aria-controls")).toBe("log-panel");
    expect(btn.querySelector("svg.icon-collapse")).toBeTruthy();
  });

  it("CPU and RAM panels do NOT have a collapse button (always visible)", () => {
    expect(document.querySelector(".cpu-panel .panel-collapse-btn")).toBeNull();
    expect(document.querySelector(".ram-panel .panel-collapse-btn")).toBeNull();
  });
});

describe("panel toggle — click behaviour", () => {
  it("clicking the Editor toggle sets data-collapsed on the panel", () => {
    const btn = document.getElementById("btn-toggle-editor");
    const panel = document.getElementById("editor-panel");
    btn.click();
    expect(panel.dataset.collapsed).toBe("true");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking the Editor toggle a second time clears data-collapsed", () => {
    const btn = document.getElementById("btn-toggle-editor");
    const panel = document.getElementById("editor-panel");
    btn.click();
    btn.click();
    expect(panel.dataset.collapsed).toBeUndefined();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("clicking the Activity toggle sets data-collapsed on the log panel", () => {
    const btn = document.getElementById("btn-toggle-log");
    const panel = document.getElementById("log-panel");
    btn.click();
    expect(panel.dataset.collapsed).toBe("true");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("panel toggle — localStorage persistence", () => {
  it("Editor toggle writes the new state to localStorage", () => {
    const btn = document.getElementById("btn-toggle-editor");
    btn.click();
    expect(localStorage.getItem("fetchcpu.ui.editor-collapsed")).toBe("true");
    btn.click();
    expect(localStorage.getItem("fetchcpu.ui.editor-collapsed")).toBe("false");
  });

  it("Activity toggle writes the new state to localStorage", () => {
    const btn = document.getElementById("btn-toggle-log");
    btn.click();
    expect(localStorage.getItem("fetchcpu.ui.activity-collapsed")).toBe("true");
    btn.click();
    expect(localStorage.getItem("fetchcpu.ui.activity-collapsed")).toBe("false");
  });

  it("each toggle has its own storage key (independent state)", () => {
    const editorBtn = document.getElementById("btn-toggle-editor");
    editorBtn.click();
    expect(localStorage.getItem("fetchcpu.ui.editor-collapsed")).toBe("true");
    expect(localStorage.getItem("fetchcpu.ui.activity-collapsed")).toBeNull();
  });
});

describe("panel toggle — restoration on boot", () => {
  it("restoring the editor-collapsed state on the next boot()", async () => {
    localStorage.setItem("fetchcpu.ui.editor-collapsed", "true");
    main.resetBoot();
    main.boot();
    expect(document.getElementById("editor-panel").dataset.collapsed).toBe("true");
    expect(document.getElementById("btn-toggle-editor").getAttribute("aria-expanded")).toBe("false");
  });

  it("restoring the activity-collapsed state on the next boot()", async () => {
    localStorage.setItem("fetchcpu.ui.activity-collapsed", "true");
    main.resetBoot();
    main.boot();
    expect(document.getElementById("log-panel").dataset.collapsed).toBe("true");
    expect(document.getElementById("btn-toggle-log").getAttribute("aria-expanded")).toBe("false");
  });
});

describe("panel toggle — i18n aria labels", () => {
  it("flips the title + aria-label between Collapse and Expand", () => {
    const btn = document.getElementById("btn-toggle-editor");
    expect(btn.getAttribute("title")).toBe("Collapse");
    btn.click();
    expect(btn.getAttribute("title")).toBe("Expand");
    expect(btn.getAttribute("aria-label")).toBe("Expand");
    btn.click();
    expect(btn.getAttribute("title")).toBe("Collapse");
  });

  it("Spanish locale swaps the tooltip to Colapsar / Expandir", async () => {
    // Rebuild the DOM (to drop listeners attached by previous boots) and
    // re-import main with a fresh module instance so click handlers bind
    // against the new translation. Otherwise the beforeAll boot's EN
    // handlers and the new ES handlers race to mutate the same DOM.
    const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(
      /<body>([\s\S]*?)<\/body>/,
    )[1];
    document.documentElement.innerHTML = body;
    const { setLanguage } = await import(resolve(ROOT, "js/ui/i18n/index.js"));
    setLanguage("es");
    const localMain = await import(resolve(ROOT, `js/main.js?v=toggle-es-${Date.now()}`));
    localMain.boot();

    const btn = document.getElementById("btn-toggle-editor");
    expect(btn.getAttribute("title")).toBe("Colapsar");
    btn.click();
    expect(btn.getAttribute("title")).toBe("Expandir");
    btn.click();
    expect(btn.getAttribute("title")).toBe("Colapsar");

    setLanguage("en");
  });
});

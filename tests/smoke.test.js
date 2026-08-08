// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("Application smoke test", () => {
  let errors;

  beforeAll(async () => {
    errors = [];

    // Stub localStorage if missing.
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

    // Capture uncaught errors.
    globalThis.addEventListener("error", (e) => errors.push(e.message));

    // Parse the HTML so all elements exist in document.
    document.documentElement.innerHTML = read("index.html").match(
      /<body>([\s\S]*?)<\/body>/,
    )[1];

    // Boot the application.
    const main = await import("../js/main.js");
    try {
      main.boot();
    } catch (e) {
      errors.push(`boot error: ${e.message}`);
    }
  });

  afterAll(() => {});

  it("the HTML exposes all expected controls", () => {
    expect(document.getElementById("btn-load")).toBeTruthy();
    expect(document.getElementById("btn-run")).toBeTruthy();
    expect(document.getElementById("btn-step")).toBeTruthy();
    expect(document.getElementById("btn-pause")).toBeTruthy();
    expect(document.getElementById("codeListing")).toBeTruthy();
    expect(document.getElementById("ram-body")).toBeTruthy();
    expect(document.getElementById("liveFeed")).toBeTruthy();
    // 1 header row + 10 data rows × 10 cells = 100 cells.
    expect(document.querySelectorAll("#ram-body .ram-cell").length).toBe(100);
    expect(document.getElementById("ram-map").children.length).toBe(100);
  });

  it("did not throw during boot", () => {
    expect(errors).toEqual([]);
  });

  it("selecting an example populates the editor", () => {
    const sel = document.getElementById("files");
    sel.value = "1";
    sel.dispatchEvent(new Event("change"));
    document.getElementById("btn-select-program").click();
    const ta = document.getElementById("codeListing");
    expect(ta.value).toMatch(/INP/);
  });

  it("runs the countdown timer and produces 5 4 3 2 1 0", async () => {
    const clock = document.getElementById("clock");
    clock.value = "10";
    clock.dispatchEvent(new Event("input"));

    const sel = document.getElementById("files");
    sel.value = "3";
    sel.dispatchEvent(new Event("change"));
    document.getElementById("btn-select-program").click();

    document.getElementById("input").value = "5";

    document.getElementById("btn-load").click();
    document.getElementById("btn-run").click();

    const start = Date.now();
    while (Date.now() - start < 4000) {
      await new Promise((r) => setTimeout(r, 50));
      const out = document.getElementById("output").value;
      if (/^5\s*4\s*3\s*2\s*1\s*0\s*$/.test(out.trim())) break;
    }

    document.getElementById("btn-pause").click();
    const out = document.getElementById("output").value;
    expect(out.trim().split(/\s+/)).toEqual(["5", "4", "3", "2", "1", "0"]);
  });

  it("exposes the redesigned UI", () => {
    expect(document.getElementById("stats-grid")).toBeTruthy();
    expect(document.getElementById("flag-z")).toBeTruthy();
    expect(document.getElementById("flag-n")).toBeTruthy();
    expect(document.getElementById("flag-p")).toBeTruthy();
    expect(document.getElementById("disasm-current")).toBeTruthy();
    expect(document.getElementById("disasm-next")).toBeTruthy();
    expect(document.getElementById("bus-memory-out")).toBeTruthy();
    expect(document.querySelector(".tabs")).toBeTruthy();
    expect(document.getElementById("history-list")).toBeTruthy();
    expect(document.querySelector(".editor-highlight")).toBeTruthy();
    expect(document.querySelector(".app-header .logo")).toBeTruthy();
  });

  it("wires the Phase step button next to the Step button", () => {
    const stepBtn = document.getElementById("btn-step");
    const phaseBtn = document.getElementById("btn-step-phase");
    expect(stepBtn).toBeTruthy();
    expect(phaseBtn).toBeTruthy();
    // They sit in the same .control-buttons strip
    const strip = document.querySelector(".control-buttons");
    expect(strip.contains(stepBtn)).toBe(true);
    expect(strip.contains(phaseBtn)).toBe(true);
  });

  it("shows mnemonic badges after loading the adding program", async () => {
    const sel = document.getElementById("files");
    sel.value = "1";
    sel.dispatchEvent(new Event("change"));
    document.getElementById("btn-select-program").click();
    document.getElementById("input").value = "3\n4";
    document.getElementById("btn-load").click();

    const firstCell = document.querySelector('#ram-body [data-addr="0"] .cell-tag');
    expect(firstCell.textContent).toBe("INP");
    const mapCode = document.querySelectorAll("#ram-map .map-code").length;
    expect(mapCode).toBeGreaterThan(3);
    const datCells = Array.from(document.querySelectorAll('#ram-body .cell-tag'))
      .filter((el) => el.textContent === "DAT");
    expect(datCells.length).toBeGreaterThan(0);
  });

  it("syntax-highlights the editor overlay", () => {
    const hl = document.getElementById("editor-highlight");
    expect(hl.innerHTML).toMatch(/tk-mnemonic/);
    expect(hl.innerHTML).toMatch(/tk-label/);
  });

  it("exposes the redesigned Activity panel with tabs", () => {
    const tabs = document.querySelectorAll(".tabs .tab");
    expect(tabs.length).toBeGreaterThanOrEqual(4);
    expect(document.getElementById("panel-live")).toBeTruthy();
    expect(document.getElementById("panel-history")).toBeTruthy();
    expect(document.getElementById("panel-stats")).toBeTruthy();
    expect(document.getElementById("panel-log")).toBeTruthy();
  });

  it("shows the program blurb and default example on load", () => {
    expect(document.getElementById("blurb-title").textContent).toBeTruthy();
    expect(document.getElementById("blurb-text").textContent).toBeTruthy();
    expect(document.getElementById("blurb-expected").textContent).toBeTruthy();

    // Switch to "Multiplying 2 inputs" and confirm blurb updates.
    const sel = document.getElementById("files");
    sel.value = "4";
    sel.dispatchEvent(new Event("change"));
    expect(document.getElementById("blurb-title").textContent).toBe("Multiplying 2 inputs");
    expect(document.getElementById("blurb-expected").textContent).toMatch(/20/);
  });

  it("Try example loads, assembles and runs a program in one step", async () => {
    const sel = document.getElementById("files");
    sel.value = "1"; // Adding 2 inputs (3 + 4 = 7)
    sel.dispatchEvent(new Event("change"));
    document.getElementById("btn-try-example").click();

    // Poll for up to 4 seconds
    const start = Date.now();
    let out = "";
    while (Date.now() - start < 4000) {
      await new Promise((r) => setTimeout(r, 50));
      out = document.getElementById("output").value.trim();
      if (out.includes("7")) break;
    }
    document.getElementById("btn-pause").click();

    expect(out).toContain("7");
  });

  it("modals open, close on Escape, and restore focus", async () => {
    const helpBtn = document.getElementById("help-link");
    const modal = document.getElementById("linkPopup");
    expect(modal.hidden).toBe(true);
    helpBtn.focus();
    helpBtn.click();
    expect(modal.hidden).toBe(false);
    // Escape closes the modal.
    modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(modal.hidden).toBe(true);
    // Focus is restored to the opener.
    expect(document.activeElement).toBe(helpBtn);
  });
});


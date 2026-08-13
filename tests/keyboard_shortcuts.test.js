// @vitest-environment jsdom
// Regression test for Phase 3: every F-key / Ctrl+S shortcut wired in
// main.js must produce the expected observable effect.
import { describe, it, expect, beforeAll } from "vitest";
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

function load(src, inp = "1") {
  document.getElementById("codeListing").value = src;
  document.getElementById("input").value = inp;
  document.getElementById("btn-load").click();
}

function press(key, opts = {}) {
  const ev = new KeyboardEvent("keydown", { key, ...opts, bubbles: true });
  document.dispatchEvent(ev);
  return ev;
}

function pc() { return document.getElementById("pc").value; }
function acc() { return document.getElementById("acc").value; }
function output() { return document.getElementById("output").value; }
function isPauseIcon() {
  return document.getElementById("btn-pause").getAttribute("data-running") === "true";
}

describe("Keyboard shortcuts — F9 / F10", () => {
  it("F9 advances one FDE cycle", () => {
    load(`INP\nOUT\nHLT\n`, "3");
    expect(pc()).toBe("00");
    press("F9");
    expect(pc()).toBe("01");
    expect(acc()).toBe("0003");
  });

  it("F10 advances one phase, not the whole cycle", () => {
    load(`INP\nOUT\nHLT\n`, "3");
    expect(pc()).toBe("00");
    press("F10"); // fetch
    press("F10"); // decode
    press("F10"); // execute
    // After three phases, pc should advance by one full FDE.
    expect(pc()).toBe("01");
    expect(acc()).toBe("0003");
  });
});

describe("Keyboard shortcuts — F4 (restart)", () => {
  it("F4 reloads the program and resets state", () => {
    load(`INP\nOUT\nHLT\n`, "1");
    press("F9");
    press("F9");
    expect(pc()).not.toBe("00");

    press("F4");
    expect(pc()).toBe("00");
    expect(acc()).toBe("0000");
    expect(output()).toBe("");
  });
});

describe("Keyboard shortcuts — F6 (run / pause toggle)", () => {
  it("F6 starts execution from a halted state", async () => {
    load(`INP\nOUT\nHLT\n`, "9");
    expect(isPauseIcon()).toBe(false);
    press("F6");
    expect(isPauseIcon()).toBe(true);
    // Wait for the program to halt (clock default is ~500 ms).
    const start = Date.now();
    while (Date.now() - start < 4000 && isPauseIcon()) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(isPauseIcon()).toBe(false);
    expect(output().trim()).toBe("9");
  });

  it("F6 toggles run / pause while running", () => {
    load(`INP\nOUT\nHLT\n`, "1");
    press("F6"); // start
    expect(isPauseIcon()).toBe(true);
    press("F6"); // pause
    expect(isPauseIcon()).toBe(false);
  });
});

describe("Keyboard shortcuts — F8 (step back)", () => {
  it("F8 reverses the last FDE step", () => {
    load(`INP\nOUT\nHLT\n`, "1");
    const accBefore = acc();
    press("F9"); // INP
    expect(pc()).toBe("01");
    expect(acc()).not.toBe(accBefore); // input was consumed

    press("F8"); // undo
    // Snapshot was captured post-fetch (pc has already advanced by 1), so
    // stepBack restores to pc=1 but undoes the input-consumption side-effect.
    expect(pc()).toBe("01");
    expect(acc()).toBe(accBefore);
  });
});

describe("Keyboard shortcuts — input guards", () => {
  it("shortcuts are suppressed while focus is in a form control", () => {
    load(`INP\nOUT\nHLT\n`, "1");
    press("F9");
    const pcBefore = pc();
    // Simulate the keydown with target inside a form control.
    const ta = document.getElementById("codeListing");
    const ev = new KeyboardEvent("keydown", { key: "F9", bubbles: true });
    Object.defineProperty(ev, "target", { value: ta });
    document.dispatchEvent(ev);
    // F9 was suppressed, pc unchanged.
    expect(pc()).toBe(pcBefore);
  });
});

describe("Keyboard shortcuts — F5 (run)", () => {
  it("F5 starts execution like the pause button", () => {
    load(`INP\nOUT\nHLT\n`, "3");
    expect(isPauseIcon()).toBe(false);
    press("F5");
    expect(isPauseIcon()).toBe(true);
    // Cleanup: pause so the test ends idle.
    press("F6");
  });
});

describe("Keyboard shortcuts — Shift+F5 (run until halt)", () => {
  it("Shift+F5 leaves the program halted when execution finishes", async () => {
    load(`INP\nOUT\nHLT\n`, "42");
    press("F5", { shiftKey: true });
    // The simulation should reach halt without manual pause.
    const start = Date.now();
    while (Date.now() - start < 4000 && isPauseIcon()) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(isPauseIcon()).toBe(false);
    expect(output().trim()).toBe("42");
  });
});

describe("Keyboard shortcuts — Ctrl+S (download log)", () => {
  it("Ctrl+S triggers a download of the log file", () => {
    // Mock createObjectURL + click to capture the download.
    let captured = null;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => {
      captured = { type: blob.type, size: blob.size };
      return "blob:mock";
    };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {
      captured.href = this.href;
      captured.download = this.download;
    };
    try {
      press("s", { ctrlKey: true });
      expect(captured).toBeTruthy();
      expect(captured.type).toMatch(/text\/plain/);
      expect(captured.size).toBeGreaterThan(0);
      expect(captured.download).toMatch(/\.txt$/);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      HTMLAnchorElement.prototype.click = origClick;
    }
  });
});

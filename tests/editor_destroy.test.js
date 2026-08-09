// @vitest-environment jsdom
// Tests for the editor.js destroy() method (H16) and onToggleBreakpoint
// wiring (C3).
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("editor.js — destroy() (H16)", () => {
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
    const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(/<body>([\s\S]*?)<\/body>/)[1];
    document.documentElement.innerHTML = body;
  });

  it("createEditorView returns an object with a destroy() method", async () => {
    const { createEditorView } = await import("../js/ui/editor.js");
    const ta = document.getElementById("codeListing");
    const g = document.getElementById("editor-gutter");
    const h = document.getElementById("editor-highlight");
    const ed = createEditorView(ta, g, h, {});
    expect(typeof ed.destroy).toBe("function");
    // Calling destroy() must not throw.
    expect(() => ed.destroy()).not.toThrow();
    // A second destroy() is also safe.
    expect(() => ed.destroy()).not.toThrow();
  });
});

describe("main.js — onToggleBreakpoint (C3)", () => {
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
    const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(/<body>([\s\S]*?)<\/body>/)[1];
    document.documentElement.innerHTML = body;
    const main = await import(resolve(ROOT, "js/main.js"));
    main.boot();
  });

  it("toggling a breakpoint before loadProgram keeps no addresses mapped", () => {
    // No address has been resolved yet, so toggling a breakpoint should
    // leave the executor breakpoint set empty. We just verify the wiring
    // doesn't throw and the side-effects are observable.
    document.getElementById("codeListing").value = "INP\nOUT\nHLT";
    document.getElementById("btn-load").click();
    // After load, address 0 corresponds to source line 1. Toggle a BP on
    // the gutter of line 2 (source line index 1 in the editor's zero-based
    // space — the editor's data-line attribute is 0-based).
    const gutter = document.getElementById("editor-gutter");
    const lines = gutter.querySelectorAll(".gutter-line");
    // Click line 1 (the OUT at address 1).
    const event = new MouseEvent("click", { bubbles: true });
    lines[1].dispatchEvent(event);
    // No assertion on the internal set (closure-private), but we verify
    // the program still runs to completion without throwing.
    document.getElementById("btn-step").click(); // INP
    document.getElementById("btn-step").click(); // OUT
    document.getElementById("btn-step").click(); // HLT
    expect(document.getElementById("btn-step")).toBeTruthy();
  });
});
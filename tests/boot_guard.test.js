// @vitest-environment jsdom
// Tests for the auto-boot guard: boot() must only fire in the browser,
// not when running under vitest (which sets `globalThis.__vitest_worker__`).
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

let main;

describe("Auto-boot guard", () => {
  beforeAll(async () => {
    // Stub localStorage so main.js's i18n doesn't warn loudly.
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
    // Inject the index.html body so module-level code that references
    // DOM elements can resolve them on first import.
    const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(
      /<body>([\s\S]*?)<\/body>/,
    )[1];
    document.documentElement.innerHTML = body;
    main = await import(resolve(ROOT, "js/main.js"));
  });

  it("exports shouldAutoBoot()", () => {
    expect(typeof main.shouldAutoBoot).toBe("function");
  });

  it("returns false when __vitest_worker__ is defined (test env)", () => {
    // Vitest has set this flag before the test ran; shouldAutoBoot()
    // gates on its presence.
    expect(globalThis.__vitest_worker__).toBeDefined();
    expect(main.shouldAutoBoot()).toBe(false);
  });

  it("returns true when __vitest_worker__ is undefined (browser-like)", () => {
    // Temporarily clear the flag, evaluate the gate, restore.
    const original = globalThis.__vitest_worker__;
    try {
      delete globalThis.__vitest_worker__;
      expect(main.shouldAutoBoot()).toBe(true);
    } finally {
      globalThis.__vitest_worker__ = original;
    }
  });

  it("does not call boot() automatically while the test env gate is on", () => {
    // __fetchcpu is only assigned inside boot(). If the auto-boot branch
    // fired during import, the helper would be on globalThis.
    expect(globalThis.__fetchcpu).toBeUndefined();
  });
});

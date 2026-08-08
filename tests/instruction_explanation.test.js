// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("Instruction explanation pill", () => {
  beforeAll(async () => {
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
    const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(
      /<body>([\s\S]*?)<\/body>/,
    )[1];
    document.documentElement.innerHTML = body;
    const main = await import(resolve(ROOT, "js/main.js"));
    main.boot();
  });

  function load(src, inp) {
    document.getElementById("codeListing").value = src;
    document.getElementById("input").value = inp;
    document.getElementById("btn-load").click();
  }

  function explanation() {
    return {
      controls: document.getElementById("explanation-controls").textContent,
      cpu: document.getElementById("explanation-cpu").textContent,
    };
  }

  it("shows the idle prompt after a fresh boot", () => {
    expect(explanation().controls).toMatch(/begin|empezar/i);
  });

  it("describes INP after a step", () => {
    load(`INP
STA 4
HLT
DAT
`, "42");
    document.getElementById("btn-step").click();
    expect(explanation().controls).toMatch(/INP 901/);
    expect(explanation().controls).toMatch(/42/);
  });

  it("describes STA with operand and ACC value", () => {
    load(`INP
STA 4
HLT
DAT
`, "7");
    document.getElementById("btn-step").click(); // INP
    document.getElementById("btn-step").click(); // STA
    expect(explanation().controls).toMatch(/STA 04/);
    expect(explanation().controls).toMatch(/7/);
  });

  it("describes ADD with operands and result", () => {
    load(`INP
STA 4
INP
ADD 4
OUT
HLT
DAT
`, "3\n4");
    document.getElementById("btn-step").click(); // INP -> ACC=3
    document.getElementById("btn-step").click(); // STA 4
    document.getElementById("btn-step").click(); // INP -> ACC=4
    document.getElementById("btn-step").click(); // ADD 4
    expect(explanation().controls).toMatch(/ADD 04/);
    expect(explanation().controls).toMatch(/= 7/);
  });

  it("describes HLT at end of program", () => {
    load(`INP\nOUT\nHLT\n`, "9");
    document.getElementById("btn-step").click(); // INP
    document.getElementById("btn-step").click(); // OUT
    document.getElementById("btn-step").click(); // HLT
    expect(explanation().controls).toMatch(/HLT 000/);
  });

  it("describes BRP taken vs skipped", () => {
    // Program: ACC=5 (positive), BRP 4; OUT; HLT
    load(`
LDA one
BRP skip
OUT      ; skipped because ACC>=0
HLT
skip HLT
one DAT 1
`, "");
    document.getElementById("btn-step").click(); // LDA one -> ACC=1
    document.getElementById("btn-step").click(); // BRP 4 (taken because ACC>=0)
    expect(explanation().controls).toMatch(/BRP 04/);
    expect(explanation().controls).toMatch(/jump/);
  });

  it("mirrors the same text in both panels", () => {
    load(`INP\nHLT\n`, "5");
    document.getElementById("btn-step").click();
    expect(explanation().controls).toBe(explanation().cpu);
  });
});

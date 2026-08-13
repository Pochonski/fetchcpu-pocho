// @vitest-environment node
// Regression test for Phase 4: branch-coverage for js/programs/examples.js.
// Exercises every entry in PROGRAMS through `getProgramMeta` and verifies
// the example carries a non-empty label so the dropdown is well-formed.
import { describe, it, expect } from "vitest";
import { PROGRAMS, getProgramMeta } from "../js/programs/examples.js";

// Tiny stand-in for `t()` that walks dot-notation keys in a fixed
// dictionary; misses log a warning so the audit script can pick them up.
const en = { examples: { "1": { label: "Add two numbers" }, "2": { label: "Max of two numbers" }, "3": { label: "Countdown" }, "4": { label: "Multiply" }, "5": { label: "Skip with default" }, "6": { label: "Factorial" }, "7": { label: "Immediate operands" }, "8": { label: "Indirect addressing" }, "9": { label: "Print 0..9" }, "10": { label: "Sum 1..N" }, "11": { label: "Print 0..N" }, "12": { label: "Absolute value" }, fallbackLabel: "Example #{0}" } };
const es = { examples: { "1": { label: "Suma de dos números" }, "2": { label: "Mayor de dos números" }, "3": { label: "Cuenta regresiva" }, "4": { label: "Multiplicación" }, "5": { label: "Salto con valor por defecto" }, "6": { label: "Factorial" }, "7": { label: "Operandos inmediatos" }, "8": { label: "Direccionamiento indirecto" }, "9": { label: "Imprime 0..9" }, "10": { label: "Suma 1..N" }, "11": { label: "Imprime 0..N" }, "12": { label: "Valor absoluto" }, fallbackLabel: "Ejemplo #{0}" } };

function makeT(dict, lang) {
  return (key, args) => {
    const parts = key.split(".");
    let cur = dict;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    if (typeof cur === "string") {
      if (!args) return cur;
      return cur.replace(/\{(\d+)\}/g, (_, n) => String(args[Number(n)] ?? ""));
    }
    if (cur && typeof cur === "object" && (cur.label || cur.blurb)) return cur;
    console.warn(`[i18n] missing key "${key}" for "${lang}"`);
    return undefined;
  };
}

describe("examples.js — getProgramMeta()", () => {
  it("contains exactly the documented twelve programs", () => {
    const values = PROGRAMS.map((p) => p.value);
    expect(values).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  });

  it.each(PROGRAMS.map((p) => p.value))(
    "example #%s has a non-empty label in EN",
    (value) => {
      const t = makeT(en, "en");
      const program = PROGRAMS.find((p) => p.value === value);
      const meta = getProgramMeta(program, t);
      expect(meta.label.length).toBeGreaterThan(0);
    },
  );

  it.each(PROGRAMS.map((p) => p.value))(
    "example #%s has a non-empty label in ES",
    (value) => {
      const t = makeT(es, "es");
      const program = PROGRAMS.find((p) => p.value === value);
      const meta = getProgramMeta(program, t);
      expect(meta.label.length).toBeGreaterThan(0);
    },
  );

  it("falls back to fallbackLabel when the example has no translation", () => {
    const empty = { examples: { fallbackLabel: "Ejemplo #{0}" } };
    const tForEmpty = (key, args) => {
      const parts = key.split(".");
      let cur = empty;
      for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
      }
      if (typeof cur === "string") {
        if (!args) return cur;
        const arr = Array.isArray(args[0]) ? args[0] : args;
        return cur.replace(/\{(\d+)\}/g, (_, n) => String(arr[Number(n)] ?? ""));
      }
      if (cur && typeof cur === "object") return cur;
      // The real t() returns the key when missing; emulate that so the
      // fallback branch in getProgramMeta reaches `t("examples.fallbackLabel")`.
      return key;
    };
    const program = PROGRAMS[0];
    const meta = getProgramMeta(program, tForEmpty);
    expect(meta.label).toBe("Ejemplo #1");
  });

  it("every example compiles to a parseable program", async () => {
    const { parse } = await import("../js/cpu/parser.js");
    for (const p of PROGRAMS) {
      const result = parse(p.code);
      expect(result.ok, `example ${p.value} failed to parse`).toBe(true);
    }
  });
});

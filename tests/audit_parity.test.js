// Regression test for the EN/ES parity gap in scripts/audit-i18n.mjs.
// Before parity was enforced, an EN-only or ES-only key was silently
// accepted because the script merged both dictionaries into a single
// `all` set. This suite asserts that the parity check (1) runs, (2)
// exits non-zero on a mismatch, and (3) passes on the current repo.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AUDIT = resolve(ROOT, "scripts/audit-i18n.mjs");

function runAudit(env = {}) {
  return spawnSync("node", [AUDIT], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

describe("i18n audit script — parity check", () => {
  it("passes on the current repository", () => {
    const r = runAudit();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("parity ✓");
    expect(r.stdout).toContain("Missing references");
  });

  it("fails (exit 1) when an EN-only leaf is added", () => {
    // Mutate dictionaries.js in memory via dynamic import, then re-run
    // the audit script and assert it exits non-zero with an "Only in EN"
    // report. The mutation is in-process — no filesystem writes.
    const r = spawnSync("node", ["--input-type=module", "-e", `
      import("./js/ui/i18n/dictionaries.js").then((d) => {
        d.en.__parityTest = { enOnly: "x" };
        return import("./scripts/audit-i18n.mjs");
      });
    `], { cwd: ROOT, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Only in EN/);
    expect(r.stdout).toContain("__parityTest.enOnly");
  });

  it("fails (exit 1) when an ES-only leaf is added", () => {
    const r = spawnSync("node", ["--input-type=module", "-e", `
      import("./js/ui/i18n/dictionaries.js").then((d) => {
        d.es.__parityTest2 = { esOnly: "x" };
        return import("./scripts/audit-i18n.mjs");
      });
    `], { cwd: ROOT, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Only in ES/);
    expect(r.stdout).toContain("__parityTest2.esOnly");
  });
});

describe("opcodes.js — disassemble (single source of truth)", () => {
  it("decodes every ISA mnemonic consistently", async () => {
    const { disassemble } = await import("../js/cpu/opcodes.js");
    const cases = [
      [901, "INP", "", "io"],
      [902, "OUT", "", "io"],
      [0,   "HLT", "", "control"],
      [599, "LDA", "99", "memory"],
      [305, "STA", "05", "memory"],
      [108, "ADD", "08", "memory"],
      [242, "SUB", "42", "memory"],
      [800, "BRP", "00", "branch"],
      [799, "BRZ", "99", "branch"],
      [650, "BRA", "50", "branch"],
      [42,  "DAT", "42", "data"],
      [-5,  "DAT", "-5", "data"],
      [999, "DAT", "999", "data"],
    ];
    for (const [word, mnem, op, type] of cases) {
      const d = disassemble(word);
      expect(d.mnemonic).toBe(mnem);
      expect(d.operand).toBe(op);
      expect(d.type).toBe(type);
    }
  });
});
// Regression tests for `countInps`. Earlier versions used
// `Number(instr.operand?.value)` to read the branch target, which silently
// turned every label-based branch (BRP pos, BRA exit, …) into a jump to
// address 0. That made the whole program look like a loop, so programs
// with multiple top-level INPs (e.g. "Max of 2 inputs") rendered only one
// slot and lost the second input value. These tests pin the correct
// behavior per example program.

import { describe, it, expect } from "vitest";
import { PROGRAMS } from "../js/programs/examples.js";
import { parse } from "../js/cpu/parser.js";
import { countInps } from "../js/ui/inputShape.js";

// Expected shape per program. The keys come from PROGRAMS in
// `js/programs/examples.js`; the values reflect what each program
// actually asks of the user (number of inputs, whether any input is read
// inside a loop body).
//
// Note: programs 3, 8, 10 and 11 do have backward branches, but their
// INP sits *before* the loop body, so the input is read exactly once.
// `isLoop` is therefore `false` — the "+ Add value" button stays
// hidden and the user can't add phantom inputs.
const EXPECTED = {
  "1":  { count: 2, isLoop: false },
  "2":  { count: 2, isLoop: false },
  "3":  { count: 1, isLoop: false },
  "4":  { count: 2, isLoop: false },
  "5":  { count: 1, isLoop: false },
  "6":  { count: 1, isLoop: false },
  "7":  { count: 1, isLoop: false },
  "8":  { count: 1, isLoop: false },
  "9":  { count: 1, isLoop: false },
  "10": { count: 1, isLoop: false },
  "11": { count: 1, isLoop: false },
  "12": { count: 1, isLoop: false },
};

describe("countInps", () => {
  for (const program of PROGRAMS) {
    it(`program ${program.value} resolves to ${JSON.stringify(EXPECTED[program.value])}`, () => {
      const result = parse(program.code);
      expect(result.ok).toBe(true);
      const shape = countInps(result.program.instructions, result.program.labels);
      expect(shape).toEqual(EXPECTED[program.value]);
    });
  }

  it("treats label-based forward branches as non-loops", () => {
    // Program 2 ("Max of 2 inputs") has BRP pos and BRA exit — both
    // forward jumps to labels. Without label resolution they look like
    // backward jumps to address 0, collapsing the two top-level INPs
    // into a single "loop" slot. The test pins the fix.
    const program = PROGRAMS.find((p) => p.value === "2");
    const result = parse(program.code);
    expect(result.ok).toBe(true);

    const inLoopAddrs = new Set();
    const { instructions, labels } = result.program;
    for (const instr of instructions) {
      if (!["BRA", "BRP", "BRZ"].includes(instr.mnemonic)) continue;
      const target = labels[instr.operand.ref] ?? Number(instr.operand?.value);
      if (target < instr.address) {
        for (let i = target; i <= instr.address; i++) inLoopAddrs.add(i);
      }
    }
    expect(inLoopAddrs.has(0)).toBe(false);
    expect(inLoopAddrs.has(2)).toBe(false);
    expect(countInps(instructions, labels)).toEqual({ count: 2, isLoop: false });
  });
});
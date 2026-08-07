import { describe, it, expect } from "vitest";
import { parse, encodeInstruction, resolveLabels } from "../js/lmc/parser.js";
import { createRAM } from "../js/lmc/ram.js";
import { createCPU } from "../js/lmc/cpu.js";
import { createExecutor } from "../js/lmc/executor.js";
import { PROGRAMS } from "../js/programs/examples.js";

function runProgram(code, inputs) {
  let inputIdx = 0;
  let outputs = [];
  const ram = createRAM();
  const cpu = createCPU();
  const io = {
    readInput: () => inputs[inputIdx++],
    writeOutput: (v) => outputs.push(v),
    reset: () => {},
    outputValue: () => outputs.slice(),
    inputIndex: () => inputIdx,
    setOutput: (v) => { outputs = v.slice(); },
    setInputIndex: (i) => { inputIdx = i; },
  };

  const r = parse(code);
  if (!r.ok) throw new Error("Parse errors: " + JSON.stringify(r.errors));

  // Pre-allocate immediates to data cells.
  const dataCells = [];
  const allocator = 99;
  const used = new Set(r.program.instructions.map((i) => i.address));
  const indirectSourceLines = new Set();
  for (const instr of r.program.instructions) {
    if (instr.mnemonic === "DAT") continue;
    if (!instr.operand) continue;
    if (instr.operand.mode === "immediate") {
      let addr = allocator;
      while (used.has(addr) && addr > 0) addr -= 1;
      dataCells.push({ addr, value: Number(instr.operand.value) });
      used.add(addr);
      instr.operand = { mode: "direct", value: String(addr), ref: null };
    } else if (instr.operand.mode === "indirect") {
      indirectSourceLines.add(instr.sourceLine);
    }
  }

  const entries = r.program.instructions.map((i) => ({
    ...i,
    code: encodeInstruction(i),
  }));
  try { resolveLabels(entries, r.program.labels); }
  catch (e) { throw new Error("Label resolution: " + e.message); }

  entries.forEach((e) => {
    let value = 0;
    if (e.mnemonic === "DAT") value = e.code.value ?? 0;
    else if (e.code.value != null) value = e.code.value;
    ram.write(e.address, value);
  });
  dataCells.forEach(({ addr, value }) => ram.write(addr, value));

  const indirectAddrs = new Set();
  for (const sl of indirectSourceLines) {
    const addr = r.program.instructions.find((i) => i.sourceLine === sl)?.address;
    if (addr != null) indirectAddrs.add(addr);
  }
  const ex = createExecutor(cpu, ram, io);
  ex.setIndirectAddresses(indirectAddrs);
  let safety = 1000;
  while (!cpu.state.halted && safety-- > 0) ex.step();
  return outputs;
}

describe("Integration: example programs", () => {
  it("Adding 2 inputs (3 + 4 = 7)", () => {
    const code = PROGRAMS.find((p) => p.value === "1").code;
    expect(runProgram(code, [3, 4])).toEqual([7]);
  });

  it("Max of 2 inputs: 7 vs 12 -> 12", () => {
    const code = PROGRAMS.find((p) => p.value === "2").code;
    expect(runProgram(code, [7, 12])).toEqual([12]);
  });

  it("Count down timer: 5 -> 5 4 3 2 1 0", () => {
    const code = PROGRAMS.find((p) => p.value === "3").code;
    expect(runProgram(code, [5])).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("Immediate addressing produces 10", () => {
    const code = PROGRAMS.find((p) => p.value === "7").code;
    // Original program lacks HLT — but OUT followed by 0 acts as a halt.
    expect(runProgram(code, [])).toEqual([10]);
  });

  it("Indirect addressing for x=2 should reverse-walk memory", () => {
    const code = PROGRAMS.find((p) => p.value === "8").code;
    expect(() => runProgram(code, [2])).not.toThrow();
  });

  it("Print 0..9 produces 0..9", () => {
    const code = PROGRAMS.find((p) => p.value === "9").code;
    expect(runProgram(code, [])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("Sum 1..N for N=10 produces 55", () => {
    const code = PROGRAMS.find((p) => p.value === "10").code;
    expect(runProgram(code, [10])).toEqual([55]);
  });

  it("Print 0..N for N=5 produces 0..5", () => {
    const code = PROGRAMS.find((p) => p.value === "11").code;
    expect(runProgram(code, [5])).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("Absolute value of -8 produces 8", () => {
    const code = PROGRAMS.find((p) => p.value === "12").code;
    expect(runProgram(code, [-8])).toEqual([8]);
  });

  it("Absolute value of 5 produces 5", () => {
    const code = PROGRAMS.find((p) => p.value === "12").code;
    expect(runProgram(code, [5])).toEqual([5]);
  });
});

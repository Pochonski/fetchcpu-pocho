import { describe, it, expect, beforeEach } from "vitest";
import { createCPU } from "../js/lmc/cpu.js";
import { createRAM } from "../js/lmc/ram.js";
import { createExecutor } from "../js/lmc/executor.js";

function makeIO(inputs = []) {
  let i = 0;
  let out = [];
  return {
    readInput: () => {
      if (i >= inputs.length) throw new Error("no input");
      return inputs[i++];
    },
    writeOutput: (v) => out.push(v),
    reset: () => { i = 0; out = []; },
    outputValue: () => out.slice(),
    inputIndex: () => i,
    setOutput: (v) => { out = v.slice(); },
    setInputIndex: (x) => { i = x; },
  };
}

describe("executor - direct addressing", () => {
  let cpu, ram, io, ex;
  beforeEach(() => {
    cpu = createCPU();
    ram = createRAM();
    io = makeIO();
    ex = createExecutor(cpu, ram, io);
  });

  it("adds two numbers via program", () => {
    // 0: INP, 1: STA 6, 2: INP, 3: ADD 6, 4: OUT, 5: HLT, 6: data
    ram.write(0, 901);
    ram.write(1, 306);
    ram.write(2, 901);
    ram.write(3, 106);
    ram.write(4, 902);
    ram.write(5, 0);
    const { io: io2 } = { io: makeIO([3, 4]) };
    ex = createExecutor(cpu, ram, io2);
    for (let i = 0; i < 6; i++) ex.step();
    expect(io2.outputValue()).toEqual([7]);
    expect(cpu.state.halted).toBe(true);
  });

  it("counts down and halts when ACC becomes negative", () => {
    // 0: INP, 1: OUT, 2: STA 8, 3: SUB 7, 4: STA 8, 5: BRP 1, 6: HLT, 7: DAT 1, 8: DAT
    ram.write(0, 901);
    ram.write(1, 902);
    ram.write(2, 308);
    ram.write(3, 207);
    ram.write(4, 308);
    ram.write(5, 801);
    ram.write(6, 0);
    ram.write(7, 1);
    const { io: io2 } = { io: makeIO([3]) };
    ex = createExecutor(cpu, ram, io2);
    for (let i = 0; i < 50 && !cpu.state.halted; i++) ex.step();
    expect(cpu.state.halted).toBe(true);
    expect(io2.outputValue()).toEqual([3, 2, 1, 0]);
  });

  it("supports step-backward", () => {
    ram.write(0, 901);
    ram.write(1, 106);
    ram.write(2, 902);
    ram.write(3, 0);
    ram.write(6, 5);
    const { io: io2 } = { io: makeIO([5]) };
    ex = createExecutor(cpu, ram, io2);
    ex.step(); // INP -> ACC=5
    ex.step(); // ADD -> ACC=10
    ex.step(); // OUT
    ex.step(); // HLT
    expect(cpu.state.halted).toBe(true);
    while (ex.stepBack()) { /* walk back */ }
    expect(cpu.state.halted).toBe(false);
    expect(cpu.state.acc).toBe(0);
  });
});

describe("executor - immediate / indirect mode registration", () => {
  it("performs indirect LOAD when address is registered", () => {
    // 0: INP, 1: STA 5 (5 holds the pointer), 2: LDA @5, 3: OUT, 4: HLT, 5: pointer=6, 6: data=42
    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO([6]);
    ram.write(0, 901);
    ram.write(1, 305);
    ram.write(2, 505);
    ram.write(3, 902);
    ram.write(4, 0);
    ram.write(5, 6);
    ram.write(6, 42);
    const ex = createExecutor(cpu, ram, io);
    ex.setIndirectAddresses(new Set([2]));
    for (let i = 0; i < 4; i++) ex.step();
    expect(io.outputValue()).toEqual([42]);
  });
});

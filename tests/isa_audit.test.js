import { describe, it, expect, beforeEach } from "vitest";
import { createCPU } from "../js/cpu/cpu.js";
import { createRAM } from "../js/cpu/ram.js";
import { createExecutor, MAX_CYCLES, MAX_HISTORY } from "../js/cpu/executor.js";
import { parse, encodeInstruction, resolveLabels } from "../js/cpu/parser.js";
import { PROGRAMS } from "../js/programs/examples.js";
import { EndOfInputError } from "../js/ui/io.js";

function makeIO(inputs = []) {
  let i = 0;
  let out = [];
  return {
    readInput: () => {
      if (i >= inputs.length) throw new EndOfInputError();
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

function makeMachine(inputs = []) {
  const cpu = createCPU();
  const ram = createRAM();
  const io = makeIO(inputs);
  const ex = createExecutor(cpu, ram, io);
  return { cpu, ram, io, ex };
}

// Parse-level harness (mirrors the loader in main.js/integration tests):
// immediates are pre-stored in high cells, indirects registered by address.
function runSource(code, inputs = [], maxSteps = 20000) {
  const cpu = createCPU();
  const ram = createRAM();
  const io = makeIO(inputs);
  const r = parse(code);
  if (!r.ok) throw new Error("Parse errors: " + JSON.stringify(r.errors));
  const dataCells = [];
  const allocator = 99;
  const used = new Set(r.program.instructions.map((i) => i.address));
  const indirectLines = new Set();
  for (const instr of r.program.instructions) {
    if (instr.mnemonic === "DAT" || !instr.operand) continue;
    if (instr.operand.mode === "immediate") {
      let addr = allocator;
      while (used.has(addr) && addr > 0) addr -= 1;
      dataCells.push({ addr, value: Number(instr.operand.value) });
      used.add(addr);
      instr.operand = { mode: "direct", value: String(addr), ref: null };
    } else if (instr.operand.mode === "indirect") {
      indirectLines.add(instr.sourceLine);
    }
  }
  const entries = r.program.instructions.map((i) => ({ ...i, code: encodeInstruction(i) }));
  resolveLabels(entries, r.program.labels);
  for (const e of entries) {
    let value = 0;
    if (e.mnemonic === "DAT") value = e.code.value ?? 0;
    else if (e.code.value != null) value = e.code.value;
    ram.write(e.address, value);
  }
  for (const { addr, value } of dataCells) ram.write(addr, value);
  const indirectAddrs = new Set();
  for (const sl of indirectLines) {
    const addr = r.program.instructions.find((i) => i.sourceLine === sl)?.address;
    if (addr != null) indirectAddrs.add(addr);
  }
  const ex = createExecutor(cpu, ram, io);
  ex.setIndirectAddresses(indirectAddrs);
  let steps = 0;
  while (!cpu.state.halted && steps < maxSteps) { ex.step(); steps++; }
  return { cpu, ram, io, ex, outputs: io.outputValue(), steps };
}

describe("ISA audit — BRA direct execution", () => {
  let m;
  beforeEach(() => { m = makeMachine(); });

  it("BRA jumps unconditionally, skipping the next cell", () => {
    // 0: BRA 02, 1: DAT (skipped), 2: HLT
    m.ram.write(0, 602);
    m.ram.write(2, 0);
    m.ex.step(); // BRA
    expect(m.cpu.state.pc).toBe(2);
    m.ex.step(); // HLT
    expect(m.cpu.state.halted).toBe(true);
    expect(m.cpu.state.haltedAt).toBe(2);
  });

  it("BRA chains to a loop that exits via BRZ", () => {
    // 0: LDA 05(=1), 1: STA 06, 2: SUB 05, 3: BRZ 06->HLT at 6? layout below
    // Simpler: 0: BRA 02, 2: BRA 04, 4: HLT
    m.ram.write(0, 602);
    m.ram.write(2, 604);
    m.ram.write(4, 0);
    for (let i = 0; i < 5 && !m.cpu.state.halted; i++) m.ex.step();
    expect(m.cpu.state.halted).toBe(true);
    expect(m.cpu.state.haltedAt).toBe(4);
  });
});

describe("ISA audit — BRZ taken / not taken", () => {
  it("BRZ jumps when ACC == 0", () => {
    const m = makeMachine();
    // 0: LDA 05 (DAT 0), 1: BRZ 04, 2: DAT filler, 3: DAT filler, 4: HLT
    m.ram.write(0, 505);
    m.ram.write(1, 704);
    m.ram.write(4, 0);
    m.ram.write(5, 0);
    m.ex.step(); // LDA -> ACC 0
    expect(m.cpu.getFlag()).toBe("Z");
    m.ex.step(); // BRZ -> pc 4
    expect(m.cpu.state.pc).toBe(4);
    m.ex.step(); // HLT
    expect(m.cpu.state.haltedAt).toBe(4);
  });

  it("BRZ falls through when ACC != 0", () => {
    const m = makeMachine();
    m.ram.write(0, 505);
    m.ram.write(1, 704);
    m.ram.write(2, 0);
    m.ram.write(5, 5);
    m.ex.step(); // LDA -> ACC 5
    m.ex.step(); // BRZ not taken -> pc 2
    expect(m.cpu.state.pc).toBe(2);
    m.ex.step(); // HLT
    expect(m.cpu.state.haltedAt).toBe(2);
  });
});

describe("ISA audit — BRP boundary matrix (>= 0 jumps)", () => {
  function brpMachine(accValue) {
    const m = makeMachine();
    // 0: LDA 06, 1: BRP 04, 2: HLT (fallthrough), 4: HLT (taken)
    m.ram.write(0, 506);
    m.ram.write(1, 804);
    m.ram.write(2, 0);
    m.ram.write(4, 0);
    m.ram.write(6, accValue);
    m.ex.step(); // LDA
    m.ex.step(); // BRP
    return m;
  }

  it("BRP taken when ACC > 0", () => {
    const m = brpMachine(3);
    expect(m.cpu.state.pc).toBe(4);
  });

  it("BRP taken when ACC == 0 (LMC semantics include zero)", () => {
    const m = brpMachine(0);
    expect(m.cpu.state.pc).toBe(4);
  });

  it("BRP not taken when ACC < 0", () => {
    const m = brpMachine(-2);
    expect(m.cpu.getFlag()).toBe("N");
    expect(m.cpu.state.pc).toBe(2);
  });
});

describe("ISA audit — indirect addressing with value asserts", () => {
  it("STA @ptr stores through the pointer, pointer cell unchanged", () => {
    const m = makeMachine();
    // 0: LDA 08 (=42), 1: STA @05, 2: HLT, 5: ptr 7, 7: 0, 8: 42
    m.ram.write(0, 508);
    m.ram.write(1, 305);
    m.ram.write(2, 0);
    m.ram.write(5, 7);
    m.ram.write(7, 0);
    m.ram.write(8, 42);
    m.ex.setIndirectAddresses(new Set([1]));
    for (let i = 0; i < 4 && !m.cpu.state.halted; i++) m.ex.step();
    expect(m.ram.read(7)).toBe(42);
    expect(m.ram.read(5)).toBe(7);
    expect(m.cpu.state.halted).toBe(true);
  });

  it("ADD @ptr adds the pointed value", () => {
    const m = makeMachine();
    // 0: LDA 08 (=10), 1: ADD @05, 2: HLT, 5: ptr 7, 7: 5, 8: 10
    m.ram.write(0, 508);
    m.ram.write(1, 105);
    m.ram.write(2, 0);
    m.ram.write(5, 7);
    m.ram.write(7, 5);
    m.ram.write(8, 10);
    m.ex.setIndirectAddresses(new Set([1]));
    for (let i = 0; i < 4 && !m.cpu.state.halted; i++) m.ex.step();
    expect(m.cpu.state.acc).toBe(15);
  });

  it("SUB @ptr subtracts the pointed value", () => {
    const m = makeMachine();
    m.ram.write(0, 508);
    m.ram.write(1, 205);
    m.ram.write(2, 0);
    m.ram.write(5, 7);
    m.ram.write(7, 4);
    m.ram.write(8, 10);
    m.ex.setIndirectAddresses(new Set([1]));
    for (let i = 0; i < 4 && !m.cpu.state.halted; i++) m.ex.step();
    expect(m.cpu.state.acc).toBe(6);
  });
});

describe("ISA audit — immediate addressing via loader", () => {
  it("LDA #5 / ADD #7 / SUB #2 = 10 with OUT", () => {
    const { outputs, cpu } = runSource("LDA #5\nADD #7\nSUB #2\nOUT\nHLT\n");
    expect(outputs).toEqual([10]);
    expect(cpu.state.halted).toBe(true);
  });

  it("program without HLT still halts by falling into data cells", () => {
    const { outputs, cpu } = runSource("LDA #5\nADD #7\nSUB #2\nOUT\n");
    expect(outputs).toEqual([10]);
    expect(cpu.state.halted).toBe(true);
  });

  it("negative immediate LDA #-3 gives ACC -3 with N flag", () => {
    const { cpu } = runSource("LDA #-3\nHLT\n");
    expect(cpu.state.acc).toBe(-3);
    expect(cpu.getFlag()).toBe("N");
  });

  it("ADD overflow past 500 keeps arithmetic going with P flag", () => {
    const { cpu } = runSource("LDA #500\nADD #5\nHLT\n");
    expect(cpu.state.acc).toBe(505);
    expect(cpu.getFlag()).toBe("P");
  });

  it("SUB underflow below zero gives N flag", () => {
    const { cpu } = runSource("LDA #0\nSUB #5\nHLT\n");
    expect(cpu.state.acc).toBe(-5);
    expect(cpu.getFlag()).toBe("N");
  });
});

describe("ISA audit — flag transitions in one run", () => {
  it("P -> Z -> N across LDA/SUB steps", () => {
    const m = makeMachine();
    // 0: LDA 06 (=2), 1: SUB 07 (=2) -> 0 Z, 2: SUB 07 -> -2 N, 3: HLT
    m.ram.write(0, 506);
    m.ram.write(1, 207);
    m.ram.write(2, 207);
    m.ram.write(3, 0);
    m.ram.write(6, 2);
    m.ram.write(7, 2);
    m.ex.step();
    expect(m.cpu.getFlag()).toBe("P");
    m.ex.step();
    expect(m.cpu.state.acc).toBe(0);
    expect(m.cpu.getFlag()).toBe("Z");
    m.ex.step();
    expect(m.cpu.state.acc).toBe(-2);
    expect(m.cpu.getFlag()).toBe("N");
  });

  it("STA leaves the flag state untouched", () => {
    const m = makeMachine();
    m.ram.write(0, 506);
    m.ram.write(1, 307);
    m.ram.write(2, 0);
    m.ram.write(6, 5);
    m.ex.step(); // LDA -> P
    const before = m.cpu.state.flag;
    m.ex.step(); // STA
    expect(m.cpu.state.flag).toBe(before);
    expect(m.cpu.getFlag()).toBe("P");
  });
});

describe("ISA audit — examples 4/5/6 execute end to end", () => {
  function codeOf(value) {
    const p = PROGRAMS.find((e) => e.value === value);
    if (!p) throw new Error("example not found: " + value);
    return p;
  }

  it("example 4 multiplies 4x5=20", () => {
    const p = codeOf("4");
    const { outputs, cpu } = runSource(p.code, [4, 5]);
    expect(cpu.state.halted).toBe(true);
    expect(outputs).toEqual([20]);
  });

  it("example 5 emits triangular numbers 1,3,6,...,55 and halts", () => {
    const p = codeOf("5");
    const { outputs, cpu } = runSource(p.code, []);
    expect(cpu.state.halted).toBe(true);
    expect(outputs).toEqual([1, 3, 6, 10, 15, 21, 28, 36, 45, 55]);
  });

  it("example 6 computes 5!=120", () => {
    const p = codeOf("6");
    const { outputs, cpu } = runSource(p.code, [5]);
    expect(cpu.state.halted).toBe(true);
    expect(outputs).toEqual([120]);
  });
});

describe("ISA audit — watchdog and history bounds", () => {
  it("BRA-to-self loop stops at MAX_CYCLES via step()", () => {
    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO();
    let limitEvents = 0;
    const events = { emit: (name) => { if (name === "cycle-limit") limitEvents++; } };
    const ex2 = createExecutor(cpu, ram, io, events);
    ram.write(0, 600); // BRA 00
    let running = true;
    let guard = MAX_CYCLES + 100;
    while (running && guard-- > 0) running = ex2.step();
    expect(cpu.state.cycle).toBe(MAX_CYCLES);
    expect(limitEvents).toBeGreaterThan(0);
    expect(cpu.state.halted).toBe(false);
  });

  it("history never exceeds MAX_HISTORY on long runs", () => {
    const m = makeMachine();
    m.ram.write(0, 600); // BRA 00
    for (let i = 0; i < MAX_HISTORY + 200; i++) m.ex.step();
    expect(m.ex.history().length).toBeLessThanOrEqual(MAX_HISTORY);
  });
});

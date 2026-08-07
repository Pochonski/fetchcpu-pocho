// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createCPU } from "../js/lmc/cpu.js";
import { createRAM } from "../js/lmc/ram.js";
import { createExecutor } from "../js/lmc/executor.js";

function makeIO(inputs = []) {
  let i = 0;
  let out = [];
  return {
    readInput: () => (i < inputs.length ? inputs[i++] : 0),
    writeOutput: (v) => out.push(v),
    reset: () => { i = 0; out = []; },
    outputValue: () => out.slice(),
    inputIndex: () => i,
    setOutput: (v) => { out = v.slice(); },
    setInputIndex: (x) => { i = x; },
  };
}

describe("Step phase (FDE sub-step)", () => {
  it("three calls complete one Fetch / Decode / Execute cycle", () => {
    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO([42]);
    const ex = createExecutor(cpu, ram, io);

    // 0: INP,  1: OUT,  2: HLT
    ram.write(0, 901);
    ram.write(1, 902);
    ram.write(2, 0);

    expect(cpu.state.acc).toBe(0);
    expect(cpu.state.mar).toBe(0);

    // Phase 1: Fetch. After it, MAR should hold the address we fetched (0).
    ex.stepPhase();
    expect(cpu.state.cir).toBe(901);
    expect(cpu.state.mar).toBe(0);
    expect(cpu.state.acc).toBe(0); // not yet executed
    expect(cpu.state.phase).toBe("fetch"); // last completed phase is "fetch"
    expect(ex.nextStepPhase()).toBe("decode"); // next call does decode

    // Phase 2: Decode. CIR is unchanged, MAR may move if instruction has operand.
    ex.stepPhase();
    expect(cpu.state.cir).toBe(901);
    expect(cpu.state.acc).toBe(0); // still not executed
    expect(cpu.state.phase).toBe("decode");

    // Phase 3: Execute. ACC finally receives the input.
    ex.stepPhase();
    expect(cpu.state.acc).toBe(42);
    expect(cpu.state.phase).toBe("execute");
    expect(cpu.state.cycle).toBe(1);
  });

  it("shows the right phase per call and reports the upcoming one", () => {
    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO();
    const ex = createExecutor(cpu, ram, io);
    ram.write(0, 901);
    ram.write(1, 0);

    expect(ex.nextStepPhase()).toBe("fetch");
    ex.stepPhase();
    expect(ex.nextStepPhase()).toBe("decode");
    ex.stepPhase();
    expect(ex.nextStepPhase()).toBe("execute");
    ex.stepPhase();
    expect(ex.nextStepPhase()).toBe("fetch");
  });

  it("a full cycle via stepPhase equals a normal step", () => {
    const cpuA = createCPU();
    const cpuB = createCPU();
    const ramA = createRAM();
    const ramB = createRAM();
    const ioA = makeIO();
    const ioB = makeIO();

    const exA = createExecutor(cpuA, ramA, ioA);
    const exB = createExecutor(cpuB, ramB, ioB);

    ramA.write(0, 500); ramA.write(1, 902); ramA.write(2, 0);
    ramB.write(0, 500); ramB.write(1, 902); ramB.write(2, 0);

    exA.step(); // full cycle
    exB.stepPhase(); exB.stepPhase(); exB.stepPhase(); // 3 phase calls

    expect(cpuA.acc).toBe(cpuB.acc);
    expect(cpuA.cir).toBe(cpuB.cir);
    expect(cpuA.mar).toBe(cpuB.mar);
    expect(cpuA.cycle).toBe(cpuB.cycle);
    expect(cpuA.halted).toBe(cpuB.halted);
  });

  it("stops at HLT after the third phase call", () => {
    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO();
    const ex = createExecutor(cpu, ram, io);

    ram.write(0, 902); // OUT
    ram.write(1, 0);   // HLT

    ex.stepPhase(); // fetch OUT
    ex.stepPhase(); // decode OUT (no operand)
    ex.stepPhase(); // execute OUT
    expect(cpu.state.halted).toBe(false);

    ex.stepPhase(); // fetch HLT (=000)
    ex.stepPhase(); // decode
    ex.stepPhase(); // execute → halts
    expect(cpu.state.halted).toBe(true);
  });

  it("phase state resets after reset()", () => {
    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO([5]);
    const ex = createExecutor(cpu, ram, io);
    ram.write(0, 901); ram.write(1, 0);

    // Run partway through.
    ex.stepPhase(); // fetch
    ex.stepPhase(); // decode
    expect(ex.nextStepPhase()).toBe("execute");

    cpu.reset();
    ex.reset();

    // Should be back to fetch.
    expect(ex.nextStepPhase()).toBe("fetch");
    expect(cpu.state.phase).toBe("fetch");
  });
});

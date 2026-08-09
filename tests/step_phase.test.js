// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createCPU } from "../js/cpu/cpu.js";
import { createRAM } from "../js/cpu/ram.js";
import { createExecutor } from "../js/cpu/executor.js";

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

  it("stepBackPhase after Fetch reverts to the post-Decode snapshot of the previous cycle", () => {
    // Regression test for the pop-2 bug at cyclePhase === 1: stepping
    // back from post-Fetch must restore the post-Decode snapshot of the
    // PREVIOUS cycle (one full pop-2), not skip past it.
    //
    // Because every snapshot is captured BEFORE execute (so step-back
    // always reverses the execute's effect, mirroring the documented
    // step() contract), the ACC also reverts to its pre-INP value.
    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO([7, 8, 9]);
    const ex = createExecutor(cpu, ram, io);

    ram.write(0, 901); // INP (cycle 1)
    ram.write(1, 902); // OUT (cycle 2)
    ram.write(2, 0);   // HLT — placeholder so cycle 2's execute doesn't halt.

    // Run cycle 1 fully: Fetch → Decode → Execute.
    ex.stepPhase(); ex.stepPhase(); ex.stepPhase();
    expect(cpu.state.acc).toBe(7);
    expect(ex.nextStepPhase()).toBe("fetch");

    // Run only the Fetch of cycle 2 (so cyclePhase === 1, post-Fetch).
    ex.stepPhase();
    expect(ex.nextStepPhase()).toBe("decode");
    expect(cpu.state.cir).toBe(902);
    expect(cpu.state.pc).toBe(2);

    // Step back: must pop exactly TWO snapshots (the post-Fetch and the
    // post-Decode of cycle 1) so the user lands on cycle 1's post-Decode
    // boundary — NOT on the post-Decode of an earlier cycle, and NOT
    // stuck on the same post-Fetch state.
    expect(ex.stepBackPhase()).toBe(true);
    // PC and CIR are back to the post-Decode of cycle 1 (pre-execute).
    expect(cpu.state.pc).toBe(1);
    expect(cpu.state.cir).toBe(901);
    // ACC is reverted to pre-INP — same contract as stepBack() from a
    // full cycle, documented in tests/executor.test.js.
    expect(cpu.state.acc).toBe(0);
    // cyclePhase is restored to 2 (pre-Execute of cycle 1) so the next
    // stepPhase() runs Execute — re-doing the INP if the user chooses.
    expect(ex.nextStepPhase()).toBe("execute");
    expect(cpu.state.phase).toBe("decode");
  });

  it("stepBackPhase from a complete cycle returns to pre-Execute of that cycle", () => {
    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO();
    const ex = createExecutor(cpu, ram, io);
    ram.write(0, 902); // OUT
    ram.write(1, 0);   // HLT — placeholder

    ex.stepPhase(); ex.stepPhase(); ex.stepPhase(); // cycle 1: OUT executed.
    expect(cpu.state.phase).toBe("execute");
    expect(ex.nextStepPhase()).toBe("fetch");

    // Step back: should restore pre-Execute (post-Decode) of cycle 1.
    expect(ex.stepBackPhase()).toBe(true);
    // The post-Decode snapshot now carries cyclePhase=2, so the user
    // lands on the pre-Execute boundary and the next stepPhase() does
    // Execute (re-running the OUT).
    expect(ex.nextStepPhase()).toBe("execute");
    expect(cpu.state.cir).toBe(902);
    expect(cpu.state.pc).toBe(1);
  });

  it("stepBackPhase from post-Decode only undoes the Decode (no over-shoot)", () => {
    // Regression test for the original pop-2 bug at cyclePhase === 2:
    // undoing a Decode must NOT also rewind into the previous cycle.
    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO([5]);
    const ex = createExecutor(cpu, ram, io);
    ram.write(0, 901); // INP
    ram.write(1, 0);   // HLT — placeholder

    // Run cycle 1 fully.
    ex.stepPhase(); ex.stepPhase(); ex.stepPhase();
    expect(cpu.state.acc).toBe(5);
    expect(ex.nextStepPhase()).toBe("fetch");

    // Cycle 2: Fetch HLT, Decode HLT.
    ex.stepPhase(); // fetch HLT
    ex.stepPhase(); // decode HLT
    expect(ex.nextStepPhase()).toBe("execute");
    expect(cpu.state.cir).toBe(0);

    // Undo the Decode — should land on the post-Decode snapshot of cycle 2
    // (pre-Execute of cycle 2), NOT on cycle 1.
    expect(ex.stepBackPhase()).toBe(true);
    expect(cpu.state.acc).toBe(5); // cycle 1 acc preserved.
    expect(cpu.state.cir).toBe(0); // still the HLT we just decoded.
    // cyclePhase is restored from the snapshot to 2, so the next
    // stepPhase() performs Execute.
    expect(ex.nextStepPhase()).toBe("execute");
  });
});

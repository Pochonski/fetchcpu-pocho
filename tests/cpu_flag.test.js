// Tests for the cpu.js flag refactor (H14).
import { describe, it, expect } from "vitest";
import { createCPU } from "../js/cpu/cpu.js";

describe("cpu.js — flag derivation (H14)", () => {
  it("state.flag starts at 'P' for a fresh CPU", () => {
    const cpu = createCPU();
    expect(cpu.state.flag).toBe("P");
  });

  it("getFlag() returns 'Z' when acc is zero", () => {
    const cpu = createCPU();
    cpu.state.acc = 0;
    expect(cpu.getFlag()).toBe("Z");
  });

  it("getFlag() returns 'N' for negative acc", () => {
    const cpu = createCPU();
    cpu.state.acc = -1;
    expect(cpu.getFlag()).toBe("N");
    cpu.state.acc = -499;
    expect(cpu.getFlag()).toBe("N");
  });

  it("getFlag() returns 'P' for positive acc", () => {
    const cpu = createCPU();
    cpu.state.acc = 1;
    expect(cpu.getFlag()).toBe("P");
    cpu.state.acc = 500;
    expect(cpu.getFlag()).toBe("P");
  });

  it("refreshFlag() writes state.flag and returns it", () => {
    const cpu = createCPU();
    cpu.state.acc = 0;
    expect(cpu.refreshFlag()).toBe("Z");
    expect(cpu.state.flag).toBe("Z");
    cpu.state.acc = -42;
    expect(cpu.refreshFlag()).toBe("N");
    expect(cpu.state.flag).toBe("N");
  });

  it("snapshot()/restore() preserve flag", () => {
    const cpu = createCPU();
    cpu.state.acc = -7;
    cpu.refreshFlag();
    const snap = cpu.snapshot();
    const cpu2 = createCPU();
    cpu2.restore(snap);
    expect(cpu2.state.flag).toBe("N");
    expect(cpu2.state.acc).toBe(-7);
  });

  it("reset() returns flag to 'P'", () => {
    const cpu = createCPU();
    cpu.state.acc = -10;
    cpu.refreshFlag();
    cpu.reset();
    expect(cpu.state.flag).toBe("P");
  });
});
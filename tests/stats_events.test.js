import { describe, it, expect } from "vitest";
import { createStats } from "../js/cpu/stats.js";
import { createEvents } from "../js/cpu/events.js";

describe("stats", () => {
  it("counts cycles and per-mnemonic instructions", () => {
    const s = createStats();
    s.tickCycle();
    s.tickCycle();
    s.onInstruction("ADD");
    s.onInstruction("STA");
    s.onInstruction("ADD");
    s.onMemoryRead();
    s.onMemoryWrite();
    s.onBranchTaken();
    const snap = s.snapshot();
    expect(snap.cycles).toBe(2);
    expect(snap.ADD).toBe(2);
    expect(snap.STA).toBe(1);
    expect(snap.memoryReads).toBe(1);
    expect(snap.memoryWrites).toBe(1);
    expect(snap.taken).toBe(1);
  });

  it("tracks elapsed time across runs", async () => {
    const s = createStats();
    s.startRun();
    await new Promise((r) => setTimeout(r, 30));
    s.stopRun();
    s.startRun();
    await new Promise((r) => setTimeout(r, 10));
    s.stopRun();
    const snap = s.snapshot();
    expect(snap.elapsedMs).toBeGreaterThanOrEqual(35);
  });

  it("reset zeroes everything", () => {
    const s = createStats();
    s.onInstruction("ADD");
    s.reset();
    expect(s.snapshot().ADD).toBe(0);
    expect(s.snapshot().cycles).toBe(0);
  });
});

describe("events", () => {
  it("delivers events to subscribers and ignores listener errors", () => {
    const e = createEvents();
    const fired = [];
    e.on("tick", () => fired.push("ok"));
    e.on("tick", () => { throw new Error("boom"); });
    e.emit("tick", { x: 1 });
    expect(fired).toEqual(["ok"]);
  });

  it("supports multiple event types independently", () => {
    const e = createEvents();
    const a = [];
    const b = [];
    e.on("a", () => a.push(1));
    e.on("b", () => b.push(2));
    e.emit("a");
    e.emit("b");
    expect(a).toEqual([1]);
    expect(b).toEqual([2]);
  });

  it("unsubscribes", () => {
    const e = createEvents();
    let count = 0;
    const off = e.on("x", () => count++);
    e.emit("x");
    off();
    e.emit("x");
    expect(count).toBe(1);
  });
});

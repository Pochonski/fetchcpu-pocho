// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

function read(rel) { return readFileSync(resolve(ROOT, rel), "utf8"); }

function makeIO(inputs = []) {
  let i = 0;
  let out = [];
  return {
    readInput: () => inputs[i++] ?? 0,
    writeOutput: (v) => out.push(v),
    reset: () => { i = 0; out = []; },
    outputValue: () => out.slice(),
    inputIndex: () => i,
    setOutput: (v) => { out = v.slice(); },
    setInputIndex: (x) => { i = x; },
  };
}

describe("Memory access fidelity", () => {
  it("MAR for INP/OUT/HLT stays at the instruction address, not 0", async () => {
    const { createCPU } = await import("../js/lmc/cpu.js");
    const { createRAM } = await import("../js/lmc/ram.js");
    const { createExecutor } = await import("../js/lmc/executor.js");
    const { createEvents } = await import("../js/lmc/events.js");

    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO([42]);
    const events = createEvents();
    const ex = createExecutor(cpu, ram, io, events);

    // Program:
    //   0: INP    (901)
    //   1: OUT    (902)
    //   2: HLT    (000)
    ram.write(0, 901);
    ram.write(1, 902);
    ram.write(2, 0);

    ex.step(); // execute INP at PC=0
    // After step: PC=1, MAR should still be 0 (instruction address), not 0 reset
    expect(cpu.state.mar).toBe(0);

    ex.step(); // OUT
    expect(cpu.state.mar).toBe(1);
    expect(io.outputValue()).toEqual([42]);

    ex.step(); // HLT
    expect(cpu.state.mar).toBe(2);
    expect(cpu.state.halted).toBe(true);
  });

  it("emits memory-access events for read/write/in/out", async () => {
    const { createCPU } = await import("../js/lmc/cpu.js");
    const { createRAM } = await import("../js/lmc/ram.js");
    const { createExecutor } = await import("../js/lmc/executor.js");
    const { createEvents } = await import("../js/lmc/events.js");

    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO([5]);
    const events = createEvents();

    const accesses = [];
    events.on("memory-access", (info) => accesses.push(info));

    const ex = createExecutor(cpu, ram, io, events);

    // Program: STA 5 ; LDA 5 ; HLT
    // 0: STA 5 (305)
    // 1: LDA 5 (505)
    // 2: HLT
    ram.write(0, 305);
    ram.write(1, 505);
    ram.write(2, 0);
    cpu.state.acc = 99;

    ex.step(); // STA 5 → write 99 to RAM[5]
    expect(cpu.state.mdr).toBe(99);
    ex.step(); // LDA 5 → read RAM[5] → ACC = 99
    expect(cpu.state.acc).toBe(99);

    const reads = accesses.filter((a) => a.direction === "in");
    const writes = accesses.filter((a) => a.direction === "out");
    expect(writes.length).toBe(1);
    expect(writes[0].address).toBe(5);
    expect(writes[0].value).toBe(99);
    expect(reads.length).toBeGreaterThanOrEqual(2); // fetch + decode + execute reads
    expect(reads.some((r) => r.address === 5 && r.value === 99)).toBe(true);
  });

  it("indirect LDA: emits two reads in sequence (pointer then value)", async () => {
    const { createCPU } = await import("../js/lmc/cpu.js");
    const { createRAM } = await import("../js/lmc/ram.js");
    const { createExecutor } = await import("../js/lmc/executor.js");
    const { createEvents } = await import("../js/lmc/events.js");

    const cpu = createCPU();
    const ram = createRAM();
    const io = makeIO();
    const events = createEvents();
    const accesses = [];
    events.on("memory-access", (info) => accesses.push(info));

    // 0: LDA @5 (instruction)
    // 5: pointer=6
    // 6: value=42
    ram.write(0, 505);
    ram.write(5, 6);
    ram.write(6, 42);
    cpu.state.acc = 0;

    const ex = createExecutor(cpu, ram, io, events);
    ex.setIndirectAddresses(new Set([0]));
    ex.step();

    expect(cpu.state.acc).toBe(42);
    // fetch reads RAM[0]=505
    // decode reads MAR=5 directly
    // execute: read RAM[5]=6 (pointer), read RAM[6]=42 (value)
    const reads = accesses.filter((a) => a.direction === "in");
    const addrs = reads.map((r) => r.address);
    expect(addrs).toContain(0);  // fetch
    expect(addrs).toContain(5);  // ptr read
    expect(addrs).toContain(6);  // value read
  });

  it("the UI access log populates after loading and running", async () => {
    const store = new Map();
    if (!globalThis.localStorage) {
      Object.defineProperty(globalThis, "localStorage", {
        value: {
          getItem: (k) => store.get(k) ?? null,
          setItem: (k, v) => store.set(k, v),
          removeItem: (k) => store.delete(k),
          clear: () => store.clear(),
        },
      });
    }

    document.documentElement.innerHTML = read("index.html").match(/<body>([\s\S]*?)<\/body>/)[1];
    const main = await import("../js/main.js");
    main.resetBoot();
    main.boot();

    // Initially: access log is "idle"
    expect(document.getElementById("access-tag").textContent).toMatch(/—/);
    expect(document.getElementById("access-phase").textContent).toMatch(/idle/);

    // Run a program that does at least one read.
    document.getElementById("files").value = "1";
    document.getElementById("files").dispatchEvent(new Event("change"));
    document.getElementById("btn-try-example").click();

    // Wait for the program to start producing accesses.
    const start = Date.now();
    while (Date.now() - start < 3000) {
      const tag = document.getElementById("access-tag").textContent;
      if (tag === "READ" || tag === "WRITE") break;
      await new Promise((r) => setTimeout(r, 30));
    }

    const tag = document.getElementById("access-tag");
    const addr = document.getElementById("access-addr").textContent;
    const value = document.getElementById("access-value").textContent;
    expect(["READ", "WRITE"]).toContain(tag.textContent);
    expect(addr).toMatch(/^\d{2}$/);
    expect(value).toMatch(/^-?\d{3}$/);

    document.getElementById("btn-pause").click();
    document.getElementById("btn-reset").click();

    // After reset, log should be cleared
    expect(document.getElementById("access-tag").textContent).toMatch(/—/);
    expect(document.getElementById("access-phase").textContent).toMatch(/idle/);
  });
});

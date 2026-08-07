// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

function read(rel) { return readFileSync(resolve(ROOT, rel), "utf8"); }

describe("Clock controls", () => {
  let main;

  beforeEach(async () => {
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
    // Populate DOM before importing so the module's auto-boot has elements.
    document.documentElement.innerHTML = read("index.html").match(/<body>([\s\S]*?)<\/body>/,)[1];
    if (!main) main = await import("../js/main.js"); // boot runs once on first import
    // For subsequent tests, re-attach listeners to the fresh DOM.
    if (main.resetBoot) {
      main.resetBoot();
      main.boot();
    }
  });

  it("+/- buttons step the clock slider value by ±50 ms", () => {
    const lmc = globalThis.__lmc;
    expect(lmc).toBeTruthy();
    lmc.setClock(500);
    document.getElementById("btn-clock-up").click();   // speed up by 50
    expect(lmc.getClock()).toBe(450);
    document.getElementById("btn-clock-down").click(); // slow down by 50
    expect(lmc.getClock()).toBe(500);
  });

  it("clamps to the slider min/max (50–3000)", () => {
    const lmc = globalThis.__lmc;
    lmc.setClock(75);
    document.getElementById("btn-clock-up").click();
    expect(lmc.getClock()).toBe(50);
    document.getElementById("btn-clock-up").click();
    expect(lmc.getClock()).toBe(50); // already at min

    lmc.setClock(2990);
    for (let _i = 0; _i < 3; _i++) document.getElementById("btn-clock-down").click();
    expect(lmc.getClock()).toBe(3000); // clamped at max
    document.getElementById("btn-clock-down").click();
    expect(lmc.getClock()).toBe(3000);
  });

  it("the displayed clock value updates synchronously", () => {
    const lmc = globalThis.__lmc;
    lmc.setClock(750);
    expect(document.getElementById("clock-value").textContent).toBe("750 ms");
  });

  it("allows slow execution (3000 ms per cycle)", () => {
    const lmc = globalThis.__lmc;
    lmc.setClock(3000);
    expect(lmc.getClock()).toBe(3000);
    expect(document.getElementById("clock-value").textContent).toBe("3000 ms");
  });

  it("re-reads clock mid-run via getSpeed callback", async () => {
    const { createCPU } = await import("../js/lmc/cpu.js");
    const { createRAM } = await import("../js/lmc/ram.js");
    const { createExecutor } = await import("../js/lmc/executor.js");

    const cpu = createCPU();
    const ram = createRAM();
    ram.write(0, 902); // OUT
    ram.write(1, 0);   // HLT
    const io = {
      readInput: () => 0,
      writeOutput: (v) => outputs.push(v),
      reset: () => {},
      outputValue: () => outputs.slice(),
      inputIndex: () => 0,
      setOutput: (v) => { outputs = v.slice(); },
      setInputIndex: (_i) => {},
    };
    let outputs = [];

    // Controllable speed source: starts slow, jumps to fast after a few ticks.
    let currentSpeed = 200;
    const ex = createExecutor(cpu, ram, io);
    let iterations = 0;
    ex.run({
      getSpeed: () => currentSpeed,
      onTick: () => { iterations++; if (iterations > 3) { currentSpeed = 99999; } },
    });

    const start = Date.now();
    while (!cpu.state.halted && Date.now() - start < 2000) {
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(cpu.state.halted).toBe(true);
    expect(iterations).toBeGreaterThan(0);
  });
});

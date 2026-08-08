// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("Step button works on fresh boot without manual Load", () => {
  beforeAll(async () => {
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
    const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(
      /<body>([\s\S]*?)<\/body>/,
    )[1];
    document.documentElement.innerHTML = body;
    const main = await import(resolve(ROOT, "js/main.js"));
    main.boot();
  });

  it("RAM contains the program after boot (so Step can fetch the first instruction)", () => {
    // RAM cell 0 should be the first instruction (INP=901) of the default example.
    const ram0 = document.querySelector('#ram-body [data-addr="0"] input');
    expect(ram0.value).toBe("901");
  });

  it("Step works immediately after page load without clicking Load", () => {
    // The default example is "Adding 2 inputs": INP, STA num1, INP, ADD num1, OUT, HLT.
    // First Step should run INP and put 3 in ACC.
    expect(document.getElementById("pc").value).toBe("00");
    expect(document.getElementById("acc").value).toBe("0000");

    document.getElementById("btn-step").click();
    expect(document.getElementById("acc").value).toBe("0003");
    expect(document.getElementById("pc").value).toBe("01");
  });

  it("Six Steps complete the example and produce output 7", () => {
    // We continue stepping from where the previous test left off (PC=01).
    // Need: STA, INP, ADD, OUT, HLT.
    document.getElementById("btn-step").click(); // STA
    document.getElementById("btn-step").click(); // INP
    document.getElementById("btn-step").click(); // ADD
    document.getElementById("btn-step").click(); // OUT
    expect(document.getElementById("output").value.trim()).toBe("7");
    document.getElementById("btn-step").click(); // HLT
    // After HLT, further Steps are no-ops (program halted).
    document.getElementById("btn-step").click();
    // State unchanged.
    expect(document.getElementById("output").value.trim()).toBe("7");
  });
});

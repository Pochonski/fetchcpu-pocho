// @vitest-environment jsdom
// Direct unit tests for views that previously only had indirect coverage
// via the smoke and live_feed suites. These tests focus on the public API
// surface and DOM mutations, not on the integration with main.js.
import { describe, it, expect, beforeEach } from "vitest";
import { createCPUView } from "../js/ui/cpuView.js";
import { createDisassemblerView } from "../js/ui/disassemblerView.js";
import { createHistoryView } from "../js/ui/historyView.js";

function makeEvents() {
  const listeners = new Map();
  return {
    on(name, fn) { listeners.set(name, (listeners.get(name) ?? []).concat([fn])); },
    emit(name, payload) {
      const fns = listeners.get(name) ?? [];
      for (const fn of fns) fn(payload);
    },
    clear() { listeners.clear(); },
  };
}

describe("cpuView.js — render()", () => {
  let cpu, events, view;
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="pc"><span id="pc-diff"></span>
      <input id="cir"><span id="cir-diff"></span>
      <input id="mar"><span id="mar-diff"></span>
      <input id="mdr"><span id="mdr-diff"></span>
      <input id="acc"><span id="acc-diff"></span>
      <span id="flag-z"></span><span id="flag-n"></span><span id="flag-p"></span>
      <span class="fde-step" data-phase="fetch"></span>
      <span class="fde-step" data-phase="decode"></span>
      <span class="fde-step" data-phase="execute"></span>
      <span class="bus-arrow" id="bus-memory-out"></span>
      <span class="bus-arrow" id="bus-memory-in"></span>
      <span id="access-tag"></span><span id="access-addr"></span><span id="access-value"></span><span id="access-phase"></span>
    `;
    cpu = {
      state: { pc: 7, acc: 42, cir: 305, mar: 3, mdr: 5, phase: "fetch", cycle: 1, lastChanged: new Set() },
      getFlag: () => "P",
    };
    events = makeEvents();
    view = createCPUView(cpu, events);
  });

  it("renders register values padded to their widths", () => {
    view.render();
    expect(document.getElementById("pc").value).toBe("07");
    expect(document.getElementById("acc").value).toBe("0042");  // pad4 for acc
    expect(document.getElementById("cir").value).toBe("305");
    expect(document.getElementById("mar").value).toBe("03");
  });

  it("activates the matching FDE phase chip", () => {
    view.render();
    expect(document.querySelector('[data-phase="fetch"]').dataset.active).toBe("true");
    expect(document.querySelector('[data-phase="decode"]').dataset.active).toBe("false");
  });

  it("flag event flips the right flag indicator", () => {
    events.emit("flag", { flag: "N" });
    expect(document.getElementById("flag-z").dataset.active).toBe("false");
    expect(document.getElementById("flag-n").dataset.active).toBe("true");
    expect(document.getElementById("flag-p").dataset.active).toBe("false");
  });

  it("memory-access event flashes the bus and updates the access log", () => {
    events.emit("memory-access", { direction: "in", address: 5, value: 42, phase: "fetch" });
    expect(document.getElementById("bus-memory-in").dataset.active).toBe("true");
    expect(document.getElementById("access-addr").textContent).toBe("05");
    expect(document.getElementById("access-value").textContent).toBe("042");
  });
});

describe("disassemblerView.js — render()", () => {
  it("shows INP for word 901", () => {
    document.body.innerHTML = `<span id="disasm-current"></span><span id="disasm-next"></span>`;
    const ram = { read: () => 902 };
    const cpu = {
      state: { cir: 901, pc: 1, halted: false },
    };
    const view = createDisassemblerView(ram, cpu);
    view.render();
    expect(document.getElementById("disasm-current").textContent).toMatch(/INP/);
    expect(document.getElementById("disasm-next").textContent).toMatch(/OUT/);
    expect(document.getElementById("disasm-current").dataset.mnemonic).toBe("INP");
  });

  it("shows HALTED badge for the next slot when cpu.state.halted is true", () => {
    document.body.innerHTML = `<span id="disasm-current"></span><span id="disasm-next"></span>`;
    const ram = { read: () => 0 };
    const cpu = { state: { cir: 0, pc: 0, halted: true } };
    const view = createDisassemblerView(ram, cpu);
    view.render();
    expect(document.getElementById("disasm-next").textContent).toMatch(/HALTED|/i);
  });

  it("formats indirect operands with a leading @", async () => {
    document.body.innerHTML = `<span id="disasm-current"></span><span id="disasm-next"></span>`;
    const ram = { read: () => 0 };
    const cpu = { state: { cir: 507, pc: 0, halted: false } };
    const view = createDisassemblerView(ram, cpu);
    view.render();
    const cur = document.getElementById("disasm-current");
    expect(cur.textContent).toMatch(/LDA/);
    expect(cur.textContent).toMatch(/07/);
  });
});

describe("historyView.js — render()", () => {
  it("renders the last 50 entries with mnemonic + acc", async () => {
    document.body.innerHTML = `<div id="history-list"></div><span id="tab-history-count"></span>`;
    const ex = {
      history() {
        const arr = [];
        for (let i = 0; i < 60; i++) arr.push({ mnemonic: "INP", address: i, cpu: { acc: i, cycle: i } });
        return arr;
      },
      stepBack() { return false; },
    };
    const view = createHistoryView(ex);
    view.render();
    const items = document.querySelectorAll("#history-list .history-row");
    expect(items.length).toBe(50);
    expect(document.getElementById("tab-history-count").textContent).toBe("60");
  });
});
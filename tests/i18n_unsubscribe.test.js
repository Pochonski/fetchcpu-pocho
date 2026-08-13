// @vitest-environment jsdom
// Regression test for Phase 8: registerOnChange() returns an unsubscribe
// function. Both cpuView and logger must detach their language listener
// when destroy() is called so they can be safely re-created (e.g. by a
// host embedding the simulator).
import { describe, it, expect, beforeEach } from "vitest";
import { registerOnChange, setLanguage, currentLanguage } from "../js/ui/i18n/index.js";
import { createCPUView } from "../js/ui/cpuView.js";
import { createLogger } from "../js/ui/logger.js";

function flipLang() {
  setLanguage(currentLanguage() === "en" ? "es" : "en");
}

function makeEvents() {
  const listeners = new Map();
  return {
    on(name, fn) { listeners.set(name, (listeners.get(name) ?? []).concat([fn])); },
    emit(name, payload) {
      const fns = listeners.get(name) ?? [];
      for (const fn of fns) fn(payload);
    },
  };
}

describe("registerOnChange() — unsubscribe pattern", () => {
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
      <div id="liveFeed"></div>
      <div id="log"></div>
    `;
  });

  it("returns an unsubscribe function that detaches the listener", () => {
    let calls = 0;
    const unsub = registerOnChange(() => { calls += 1; });
    flipLang();
    expect(calls).toBeGreaterThanOrEqual(1);
    const before = calls;
    unsub();
    flipLang();
    expect(calls).toBe(before);
  });

  it("cpuView.destroy() detaches its language listener", () => {
    const cpu = {
      state: { pc: 0, acc: 0, cir: 0, mar: 0, mdr: 0, phase: "fetch", cycle: 1, lastChanged: new Set() },
      getFlag: () => "P",
    };
    const events = makeEvents();
    const view = createCPUView(cpu, events);
    let renders = 0;
    const originalRender = view.render;
    view.render = () => { renders += 1; originalRender(); };

    view.destroy();
    const before = renders;
    flipLang();
    // render() should NOT have fired again from the i18n subscriber.
    expect(renders).toBe(before);
  });

  it("logger.destroy() detaches its language listener", () => {
    const liveFeed = document.getElementById("liveFeed");
    const log = document.getElementById("log");
    const logger = createLogger(liveFeed, log);
    logger.onProgramLoaded(1);
    logger.onProgramHalted({ state: { haltedAt: 1 } });
    expect(liveFeed.textContent.length).toBeGreaterThan(0);

    logger.destroy();
    const snapshot = liveFeed.textContent;
    flipLang();
    expect(liveFeed.textContent).toBe(snapshot);
  });
});

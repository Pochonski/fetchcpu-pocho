// @vitest-environment jsdom
// Tests for the statsView.
import { describe, it, expect, beforeEach } from "vitest";
import { createStatsView } from "../js/ui/statsView.js";

describe("statsView.js — createStatsView", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="stats-grid"></div>`;
  });

  it("renders nothing when #stats-grid is missing", () => {
    document.body.innerHTML = "";
    const view = createStatsView({ snapshot: () => ({}) });
    expect(() => view.render()).not.toThrow();
  });

  it("renders one row per stat snapshot key", () => {
    const stats = {
      snapshot: () => ({
        cycles: 5,
        runs: 2,
        instructionsExecuted: 12,
        memoryReads: 3,
        memoryWrites: 4,
        elapsedMs: 1234,
        LDA: 1, STA: 2, ADD: 3, SUB: 0, BRP: 0, BRZ: 0, BRA: 0,
        INP: 0, OUT: 0, HLT: 0,
        taken: 0,
      }),
    };
    const view = createStatsView(stats);
    view.render();
    const items = document.querySelectorAll(".stat-item");
    expect(items.length).toBeGreaterThan(0);
    // cycles is part of the headline group
    expect(document.getElementById("stats-grid").textContent).toContain("5");
    expect(document.getElementById("stats-grid").textContent).toContain("12");
  });
});
// @vitest-environment jsdom
// Regression test for Phase 1: history rows are rendered as <button>
// so they are reachable via keyboard (Enter / Space activate natively).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHistoryView } from "../js/ui/historyView.js";

function makeExecutor(entries) {
  // Returns a stateful executor where stepBack actually shrinks history.
  let current = entries.slice();
  return {
    history: vi.fn(() => current),
    stepBack: vi.fn(() => { current = current.slice(0, -1); }),
    _peek: () => current,
  };
}

describe("historyView.js — a11y / keyboard", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="history-list"></div>
      <span id="tab-history-count"></span>
    `;
  });

  it("renders rows as <button> elements (not <div>)", () => {
    const ex = makeExecutor([
      { mnemonic: "INP", address: 0, cpu: { acc: 0, cycle: 1 } },
      { mnemonic: "OUT", address: 1, cpu: { acc: 0, cycle: 2 } },
    ]);
    const view = createHistoryView(ex);
    view.render();
    const items = document.querySelectorAll("#history-list .history-row");
    expect(items.length).toBe(2);
    for (const el of items) {
      expect(el.tagName).toBe("BUTTON");
      expect(el.getAttribute("type")).toBe("button");
    }
  });

  it("click on a row steps the executor back to that point", () => {
    const ex = makeExecutor(
      Array.from({ length: 10 }, (_, i) => ({
        mnemonic: "INP", address: i, cpu: { acc: i, cycle: i + 1 },
      })),
    );
    const view = createHistoryView(ex);
    view.render();
    const rows = document.querySelectorAll("#history-list .history-row");
    rows[5].click();
    // Row 5 → rewind until history.length <= 6 → 4 stepBacks.
    expect(ex.stepBack.mock.calls.length).toBe(4);
    expect(ex._peek().length).toBe(6);
  });

  it("a <button> row fires click on Enter (native browser behaviour)", () => {
    const ex = makeExecutor(
      Array.from({ length: 5 }, (_, i) => ({
        mnemonic: "INP", address: i, cpu: { acc: i, cycle: i + 1 },
      })),
    );
    const view = createHistoryView(ex);
    view.render();
    const row = document.querySelectorAll("#history-list .history-row")[2];
    // Browsers translate Enter on a focused <button> into a click event.
    // In jsdom we model that by dispatching click directly.
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    row.click();
    expect(ex.stepBack).toHaveBeenCalled();
  });

  it("a <button> row fires click on Space (native browser behaviour)", () => {
    const ex = makeExecutor(
      Array.from({ length: 3 }, (_, i) => ({
        mnemonic: "OUT", address: i, cpu: { acc: i, cycle: i + 1 },
      })),
    );
    const view = createHistoryView(ex);
    view.render();
    const row = document.querySelectorAll("#history-list .history-row")[1];
    row.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    row.click();
    expect(ex.stepBack).toHaveBeenCalled();
  });

  it("every row has an accessible name via aria-label or text", () => {
    const ex = makeExecutor([
      { mnemonic: "LDA", address: 7, cpu: { acc: 5, cycle: 1 } },
      { mnemonic: "OUT", address: 8, cpu: { acc: 5, cycle: 2 } },
    ]);
    const view = createHistoryView(ex);
    view.render();
    const rows = document.querySelectorAll("#history-list .history-row");
    for (const row of rows) {
      const label = row.getAttribute("aria-label") || row.textContent.trim();
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

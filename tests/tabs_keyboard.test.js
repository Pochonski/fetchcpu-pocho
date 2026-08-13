// @vitest-environment jsdom
// Regression test for Phase 4: tabs.js keyboard handler covers Arrow keys
// (with wrap-around), Home, End, and the non-navigation key pass-through.
import { describe, it, expect, beforeEach } from "vitest";
import { createTabs } from "../js/ui/tabs.js";

describe("tabs.js — keyboard navigation", () => {
  let root;

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="tabs-root">
        <button class="tab" id="tab-one" role="tab" aria-controls="p1" aria-selected="true">One</button>
        <button class="tab" id="tab-two" role="tab" aria-controls="p2" aria-selected="false">Two</button>
        <button class="tab" id="tab-three" role="tab" aria-controls="p3" aria-selected="false">Three</button>
        <div id="p1" role="tabpanel">Panel 1</div>
        <div id="p2" role="tabpanel" hidden>Panel 2</div>
        <div id="p3" role="tabpanel" hidden>Panel 3</div>
      </div>
    `;
    root = document.querySelector(".tabs-root");
  });

  function press(target, key, opts = {}) {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
  }

  it("ArrowRight on the last tab wraps to the first", () => {
    createTabs(root);
    const [one, , three] = root.querySelectorAll(".tab");
    three.focus();
    press(three, "ArrowRight");
    expect(document.activeElement).toBe(one);
    expect(one.getAttribute("aria-selected")).toBe("true");
    expect(three.getAttribute("aria-selected")).toBe("false");
  });

  it("ArrowLeft on the first tab wraps to the last", () => {
    createTabs(root);
    const [one, , three] = root.querySelectorAll(".tab");
    one.focus();
    press(one, "ArrowLeft");
    expect(document.activeElement).toBe(three);
    expect(three.getAttribute("aria-selected")).toBe("true");
    expect(one.getAttribute("aria-selected")).toBe("false");
  });

  it("ArrowRight from the middle advances one tab", () => {
    createTabs(root);
    const [, two, three] = root.querySelectorAll(".tab");
    two.focus();
    press(two, "ArrowRight");
    expect(document.activeElement).toBe(three);
    expect(three.getAttribute("aria-selected")).toBe("true");
  });

  it("Home jumps to the first tab regardless of current focus", () => {
    createTabs(root);
    const [one, , three] = root.querySelectorAll(".tab");
    three.focus();
    press(three, "Home");
    expect(document.activeElement).toBe(one);
    expect(one.getAttribute("aria-selected")).toBe("true");
  });

  it("End jumps to the last tab regardless of current focus", () => {
    createTabs(root);
    const [one, , three] = root.querySelectorAll(".tab");
    one.focus();
    press(one, "End");
    expect(document.activeElement).toBe(three);
    expect(three.getAttribute("aria-selected")).toBe("true");
  });

  it("a non-navigation key leaves the active tab untouched", () => {
    createTabs(root);
    const [one, , three] = root.querySelectorAll(".tab");
    one.focus();
    press(one, "a");
    expect(document.activeElement).toBe(one);
    expect(one.getAttribute("aria-selected")).toBe("true");
    expect(three.getAttribute("aria-selected")).toBe("false");
  });

  it("keyboard navigation dispatches a tab:activate event with the new index", () => {
    createTabs(root);
    const events = [];
    root.addEventListener("tab:activate", (e) => events.push(e.detail));
    const [one] = root.querySelectorAll(".tab");
    one.focus();
    press(one, "ArrowRight");
    expect(events).toEqual([{ index: 1, id: "tab-two" }]);
  });
});

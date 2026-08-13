// @vitest-environment jsdom
// Regression test for Phase 4: jsdom doesn't lay elements out, so
// `offsetParent` returns null by default — focusables() is then empty
// and the trap short-circuits. We stub offsetParent on individual
// elements to drive the real branches.
import { describe, it, expect, beforeEach } from "vitest";
import { openModal, closeModal } from "../js/ui/modal.js";

function makeFocusable(el) {
  // jsdom returns null for offsetParent on every element. Stub it so
  // modal.focusables() recognises the element as focusable.
  Object.defineProperty(el, "offsetParent", {
    value: el.ownerDocument.body,
    configurable: true,
  });
}

describe("modal.js — focus trap branches", () => {
  let modal, first, middle, last;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="m" class="modal" hidden>
        <button class="first">First</button>
        <input class="middle" />
        <button class="last">Last</button>
        <button class="modal-close">×</button>
      </div>
    `;
    modal = document.getElementById("m");
    first = modal.querySelector(".first");
    middle = modal.querySelector(".middle");
    last = modal.querySelector(".last");
    [first, middle, last].forEach(makeFocusable);
  });

  it("Tab on the last focusable wraps to the first", () => {
    openModal(modal);
    last.focus();
    modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(first);
  });

  it("Shift+Tab on the first focusable wraps to the last", () => {
    openModal(modal);
    first.focus();
    modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
  });

  it("Tab in the middle of the focus ring is a no-op (no wrap)", () => {
    openModal(modal);
    middle.focus();
    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    modal.dispatchEvent(ev);
    // preventDefault should NOT have been called, so the browser would
    // move focus naturally. We just assert activeElement hasn't been
    // explicitly jumped to first or last.
    expect([first, last]).not.toContain(document.activeElement);
  });

  it("non-Tab keys are passed through without side-effects", () => {
    openModal(modal);
    last.focus();
    modal.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(document.activeElement).toBe(last);
  });

  it("openModal falls back to modalEl.focus() when no focusables exist", async () => {
    // Remove every focusable from a fresh modal.
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="empty-modal" class="modal" hidden><p>Just text</p></div>
    `;
    const empty = document.getElementById("empty-modal");
    document.getElementById("opener").id = "opener";
    openModal(empty);
    // requestAnimationFrame is the only way to reach the fallback; give
    // it a chance to fire before asserting.
    await new Promise((r) => requestAnimationFrame(r));
    expect(empty.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(empty);
  });

  it("Escape closes the modal AND returns focus to the opener", () => {
    document.getElementById("opener").focus();
    openModal(modal);
    expect(modal.hasAttribute("hidden")).toBe(false);
    modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(modal.hasAttribute("hidden")).toBe(true);
    expect(document.activeElement.id).toBe("opener");
  });

  it("closeModal is idempotent (calling twice doesn't restore twice)", () => {
    document.getElementById("opener").focus();
    openModal(modal);
    closeModal(modal);
    closeModal(modal); // should be a no-op
    expect(modal.hasAttribute("hidden")).toBe(true);
    expect(document.activeElement.id).toBe("opener");
  });
});

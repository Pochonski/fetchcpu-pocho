// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createInputSlots } from "../js/ui/ioSlots.js";

function makeContainer() {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

function makeAddButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  document.body.appendChild(btn);
  return btn;
}

describe("input slots", () => {
  let container;
  let addBtn;
  let slots;
  let onChangeValues;

  beforeEach(() => {
    container = makeContainer();
    addBtn = makeAddButton();
    onChangeValues = [];
    slots = createInputSlots(container, {
      t: (k) => k,
      addButton: addBtn,
      onChange: (vals) => onChangeValues.push(vals),
    });
  });

  it("renders N linear slots without a loop badge", () => {
    slots.setCount(3, false);
    const items = container.querySelectorAll(".io-slot");
    expect(items.length).toBe(3);
    expect(container.querySelector(".io-slot--loop")).toBeNull();
    expect(addBtn.hidden).toBe(true);
  });

  it("renders 1 slot with the loop badge when INP is inside a loop", () => {
    slots.setCount(1, true);
    const items = container.querySelectorAll(".io-slot");
    expect(items.length).toBe(1);
    expect(container.querySelector(".io-slot--loop")).not.toBeNull();
    expect(addBtn.hidden).toBe(false);
    const badge = container.querySelector(".io-slot-loop-badge");
    expect(badge?.textContent).toBe("∞");
  });

  it("numbers slots sequentially as #1, #2, #3", () => {
    slots.setCount(3, false);
    const labels = container.querySelectorAll(".io-slot-label");
    expect(labels[0].textContent).toBe("#1");
    expect(labels[1].textContent).toBe("#2");
    expect(labels[2].textContent).toBe("#3");
  });

  it("setValues populates each slot and emits the values", () => {
    slots.setCount(2, false);
    slots.setValues([3, 4]);
    const inputs = container.querySelectorAll(".io-slot-input");
    expect(inputs[0].value).toBe("3");
    expect(inputs[1].value).toBe("4");
    expect(onChangeValues.at(-1)).toEqual([3, 4]);
  });

  it("truncates overflow values silently (more values than slots)", () => {
    slots.setCount(2, false);
    slots.setValues([1, 2, 3, 4, 5]);
    const inputs = container.querySelectorAll(".io-slot-input");
    expect(inputs[0].value).toBe("1");
    expect(inputs[1].value).toBe("2");
    expect(onChangeValues.at(-1)).toEqual([1, 2]);
  });

  it("getValues returns only the filled numeric slots", () => {
    slots.setCount(3, false);
    const inputs = container.querySelectorAll(".io-slot-input");
    inputs[0].value = "7";
    inputs[1].value = "8";
    inputs[2].value = "";
    inputs[2].dispatchEvent(new Event("input", { bubbles: true }));
    expect(slots.getValues()).toEqual([7, 8]);
  });

  it("addSlot appends a new slot up to the max cap", () => {
    slots.setCount(1, true);
    slots.addSlot();
    slots.addSlot();
    expect(container.querySelectorAll(".io-slot").length).toBe(3);
    slots.addSlot();
    expect(container.querySelectorAll(".io-slot").length).toBe(4);
  });

  it("paste distributes numbers into existing slots and discards overflow", () => {
    slots.setCount(2, false);
    slots.setValues([0, 0]);
    const inputs = container.querySelectorAll(".io-slot-input");
    inputs[0].focus();
    const ev = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", {
      value: { getData: (type) => (type === "text" ? "3\n4\n5\n6" : "") },
    });
    container.dispatchEvent(ev);
    const updated = container.querySelectorAll(".io-slot-input");
    expect(updated[0].value).toBe("3");
    expect(updated[1].value).toBe("4");
  });

  it("paste ignores non-numeric content", () => {
    slots.setCount(2, false);
    slots.setValues([0, 0]);
    const ev = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", {
      value: { getData: (type) => (type === "text" ? "abc\nxyz" : "") },
    });
    container.dispatchEvent(ev);
    expect(container.querySelectorAll(".io-slot-input")[0].value).toBe("0");
  });

  it("isLoop reflects the asLoop flag", () => {
    slots.setCount(2, false);
    expect(slots.isLoop()).toBe(false);
    slots.setCount(1, true);
    expect(slots.isLoop()).toBe(true);
  });

  it("count reflects the last setCount call", () => {
    slots.setCount(2, false);
    expect(slots.count()).toBe(2);
    slots.setCount(5, false);
    expect(slots.count()).toBe(5);
  });

  it("setCount with 0 renders nothing and hides the loop flag", () => {
    slots.setCount(0, true);
    expect(container.querySelectorAll(".io-slot").length).toBe(0);
    expect(slots.isLoop()).toBe(false);
  });

  it("flags slots whose value is outside the 3-digit LMC range", () => {
    slots.setCount(3, false);
    const inputs = container.querySelectorAll(".io-slot-input");
    inputs[0].value = "500";    // in range (max)
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1].value = "501";    // out of range
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[2].value = "-499";   // in range (min)
    inputs[2].dispatchEvent(new Event("input", { bubbles: true }));

    expect(inputs[0].classList.contains("io-slot-input--invalid")).toBe(false);
    expect(inputs[1].classList.contains("io-slot-input--invalid")).toBe(true);
    expect(inputs[2].classList.contains("io-slot-input--invalid")).toBe(false);
  });

  it("flags values above 500 and below -499", () => {
    slots.setCount(2, false);
    const inputs = container.querySelectorAll(".io-slot-input");
    for (const v of ["501", "1000", "9999", "-500", "-999"]) {
      inputs[0].value = v;
      inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      expect(inputs[0].classList.contains("io-slot-input--invalid")).toBe(true);
    }
  });

  it("treats empty slots as valid (they are skipped by readInput)", () => {
    slots.setCount(2, false);
    const inputs = container.querySelectorAll(".io-slot-input");
    inputs[0].value = "10";
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1].value = "";
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    expect(slots.isValid()).toBe(true);
  });

  it("isValid() returns false when any non-empty slot is out of range", () => {
    slots.setCount(2, false);
    const inputs = container.querySelectorAll(".io-slot-input");
    inputs[0].value = "10";
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1].value = "1234";
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    expect(slots.isValid()).toBe(false);
  });

  it("isValid() returns true when every non-empty slot is in range", () => {
    slots.setCount(3, false);
    const inputs = container.querySelectorAll(".io-slot-input");
    inputs[0].value = "-499";
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1].value = "0";
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[2].value = "500";
    inputs[2].dispatchEvent(new Event("input", { bubbles: true }));
    expect(slots.isValid()).toBe(true);
  });

  it("firstInvalid() returns the first out-of-range slot, or null", () => {
    slots.setCount(2, false);
    const inputs = container.querySelectorAll(".io-slot-input");
    inputs[0].value = "999";
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    expect(slots.firstInvalid()).toBe(inputs[0]);
    inputs[0].value = "10";
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    expect(slots.firstInvalid()).toBeNull();
  });

  it("rangeMin/rangeMax return the LMC limits", () => {
    expect(slots.rangeMin()).toBe(-499);
    expect(slots.rangeMax()).toBe(500);
  });

  it("setValues flags out-of-range values too", () => {
    slots.setCount(2, false);
    slots.setValues([1000, 5]);
    const inputs = container.querySelectorAll(".io-slot-input");
    expect(inputs[0].classList.contains("io-slot-input--invalid")).toBe(true);
    expect(inputs[1].classList.contains("io-slot-input--invalid")).toBe(false);
    expect(slots.isValid()).toBe(false);
  });
});

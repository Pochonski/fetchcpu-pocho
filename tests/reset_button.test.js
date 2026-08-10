// @vitest-environment jsdom
// Tests for the "↺ Ejemplo" (Reset to example) button — restores the
// example's input values into the slots and IO queue, and re-sizes the
// slots to match the current program's INP count.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

function read(rel) { return readFileSync(resolve(ROOT, rel), "utf8"); }

describe("Reset to example button", () => {
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
    document.documentElement.innerHTML = read("index.html").match(/<body>([\s\S]*?)<\/body>/)[1];
    const main = await import("../js/main.js");
    main.resetBoot();
    main.boot();
  });

  function loadExample(value) {
    const sel = document.getElementById("files");
    sel.value = value;
    sel.dispatchEvent(new Event("change"));
    document.getElementById("btn-select-program").click();
  }

  it("is hidden when an example without input is loaded (program 7)", () => {
    loadExample("7");
    const btn = document.getElementById("btn-reset-input");
    expect(btn.hidden).toBe(true);
  });

  it("is visible when an example with input is loaded (program 2)", () => {
    loadExample("2");
    const btn = document.getElementById("btn-reset-input");
    expect(btn.hidden).toBe(false);
  });

  it("restores the example's input values after the user edits a slot", () => {
    loadExample("2");
    const slots = document.querySelectorAll(".io-slot-input");
    expect(slots.length).toBe(2);
    expect(slots[0].value).toBe("7");
    expect(slots[1].value).toBe("12");

    // User edits the values.
    slots[0].value = "99";
    slots[0].dispatchEvent(new Event("input", { bubbles: true }));
    slots[1].value = "1";
    slots[1].dispatchEvent(new Event("input", { bubbles: true }));

    // Click reset.
    document.getElementById("btn-reset-input").click();

    const restored = document.querySelectorAll(".io-slot-input");
    expect(restored[0].value).toBe("7");
    expect(restored[1].value).toBe("12");

    // Hidden input mirrors the IO queue.
    expect(document.getElementById("input").value).toBe("7\n12");
  });

  it("removes extra slots the user added via '+ Add value' on a loop program", () => {
    // Program 3 has a loop around INP — the "+ Add value" button is shown.
    loadExample("3");
    const slots = document.querySelectorAll(".io-slot-input");
    expect(slots.length).toBe(1);

    document.getElementById("btn-add-input").click();
    document.getElementById("btn-add-input").click();
    expect(document.querySelectorAll(".io-slot-input").length).toBe(3);

    // Reset re-sizes to the program's INP count and drops the extras.
    document.getElementById("btn-reset-input").click();
    expect(document.querySelectorAll(".io-slot-input").length).toBe(1);
    expect(document.querySelector(".io-slot-input").value).toBe("5");
  });

  it("persists the restored input to localStorage", () => {
    loadExample("1");
    document.getElementById("btn-reset-input").click();
    expect(localStorage.getItem("fetchcpu.input")).toBe("3\n4");
  });

  it("changing the dropdown alone (no Load click) loads the example", () => {
    // Regression: previously `change` only updated the blurb, so the
    // dropdown said e.g. "Max of 2 inputs" while the slots still showed
    // the previous program's values — looked like the new program had
    // the wrong slot count.
    loadExample("1");
    const sel = document.getElementById("files");
    sel.value = "2";
    sel.dispatchEvent(new Event("change"));
    // No btn-select-program click.
    const slots = document.querySelectorAll(".io-slot-input");
    expect(slots.length).toBe(2);
    expect(slots[0].value).toBe("7");
    expect(slots[1].value).toBe("12");
  });
});
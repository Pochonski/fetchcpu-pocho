// @vitest-environment jsdom
// Integration test for the full chain that drives the input panel:
// `parse(source)` → `countInps(instructions, labels)` →
// `inputSlots.setCount(count, isLoop)` → `inputSlots.setValues(io.getInputValues())`.
//
// This is the regression test for the original bug: with the old
// countInps, every label-based branch was treated as a jump to address 0,
// which collapsed "Max of 2 inputs" (and programs 1 and 4) into a single
// loop slot and silently dropped the second input value.
import { describe, it, expect } from "vitest";
import { PROGRAMS } from "../js/programs/examples.js";
import { parse } from "../js/cpu/parser.js";
import { countInps } from "../js/ui/inputShape.js";
import { createInputSlots } from "../js/ui/ioSlots.js";
import { createIO } from "../js/ui/io.js";

function setupPanel(program) {
  document.body.innerHTML = `
    <div id="input-list"></div>
    <button id="btn-add-input" hidden></button>
    <input type="hidden" id="input" />
  `;
  const container = document.getElementById("input-list");
  const addBtn = document.getElementById("btn-add-input");
  const hiddenInput = document.getElementById("input");

  hiddenInput.value = program.input || "";
  const io = createIO(hiddenInput, document.createElement("textarea"));
  io.setInputText(program.input || "");

  const result = parse(program.code);
  if (!result.ok) throw new Error("parse failed: " + JSON.stringify(result.errors));

  const inpShape = countInps(result.program.instructions, result.program.labels);

  const slots = createInputSlots(container, {
    t: (k) => k,
    addButton: addBtn,
    onChange: () => {},
  });
  slots.setCount(inpShape.count, inpShape.isLoop);
  slots.setValues(io.getInputValues());

  return { container, addBtn, slots, inpShape, io };
}

// Pin expected (slotCount, pre-filledValues) per program. The values come
// straight from `PROGRAMS`; the counts are derived from the program
// shape (top-level INPs, with a floor of 1 for programs that have none).
const EXPECTED = [
  ["1",  2, ["3", "4"]],
  ["2",  2, ["7", "12"]],   // the bug: was 1 slot pre-fix
  ["3",  1, ["5"]],
  ["4",  2, ["4", "5"]],   // also affected pre-fix
  ["5",  1, [""]],         // no INPs → empty slot (still rendered)
  ["6",  1, ["5"]],
  ["7",  1, [""]],
  ["8",  1, ["2"]],
  ["9",  1, [""]],
  ["10", 1, ["10"]],
  ["11", 1, ["5"]],
  ["12", 1, ["-8"]],
];

describe("input panel — load program → size slots → fill values", () => {
  for (const [value, expectedCount, expectedValues] of EXPECTED) {
    it(`program ${value} renders ${expectedCount} slot(s) with the example input`, () => {
      const program = PROGRAMS.find((p) => p.value === value);
      const { container, addBtn } = setupPanel(program);

      const inputs = container.querySelectorAll(".io-slot-input");
      expect(inputs.length).toBe(expectedCount);

      // Programs without a loop should never expose the "+ Add value" button
      // — the user isn't allowed to invent extra inputs.
      expect(addBtn.hidden).toBe(true);

      // The slots that exist must carry the example's input values, in order.
      const actualValues = Array.from(inputs).map((n) => n.value);
      expect(actualValues).toEqual(expectedValues);
    });
  }

  it("the IO queue is large enough for the executor to consume every value", () => {
    // Regression: pre-fix, program 2's IO queue had [7, 12] but only one
    // slot existed, so the second INP hit EndOfInputError mid-run.
    const program = PROGRAMS.find((p) => p.value === "2");
    const { io } = setupPanel(program);
    expect(io.getInputValues()).toEqual([7, 12]);
  });
});
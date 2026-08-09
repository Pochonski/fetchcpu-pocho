// @vitest-environment jsdom
// Direct unit tests for the io.js module — previously tested only via
// integration tests.
import { describe, it, expect, beforeEach } from "vitest";
import { createIO, EndOfInputError } from "../js/ui/io.js";

describe("io.js — createIO", () => {
  let inputEl, outputEl, io;
  beforeEach(() => {
    document.body.innerHTML = `<textarea id="in"></textarea><textarea id="out"></textarea>`;
    inputEl = document.getElementById("in");
    outputEl = document.getElementById("out");
    io = createIO(inputEl, outputEl);
  });

  it("returns an object with the documented surface", () => {
    expect(typeof io.readInput).toBe("function");
    expect(typeof io.writeOutput).toBe("function");
    expect(typeof io.reset).toBe("function");
    expect(typeof io.destroy).toBe("function");
    expect(typeof io.onChange).toBe("function");
  });

  it("readInput throws EndOfInputError when the queue is exhausted", () => {
    inputEl.value = "1\n2";
    io.reset();
    expect(io.readInput()).toBe(1);
    expect(io.readInput()).toBe(2);
    expect(() => io.readInput()).toThrow(EndOfInputError);
  });

  it("writeOutput appends to the textarea", () => {
    io.writeOutput(42);
    io.writeOutput(99);
    expect(outputEl.value).toBe("42\n99");
  });

  it("setInputValues mirrors the queue into the textarea", () => {
    io.setInputValues([10, 20, 30]);
    expect(inputEl.value).toBe("10\n20\n30");
    expect(io.inputIndex()).toBe(0);
  });

  it("setInputText parses a free-form string", () => {
    io.setInputText("5\n7\n-3");
    expect(io.getInputValues()).toEqual([5, 7, -3]);
  });

  it("onChange listeners fire on setInputValues", () => {
    const calls = [];
    io.onChange(() => calls.push("c"));
    io.setInputValues([1]);
    expect(calls).toEqual(["c"]);
  });

  it("destroy() removes the input listener — no fires after destroy", () => {
    const calls = [];
    io.onChange(() => calls.push("c"));
    io.destroy();
    inputEl.dispatchEvent(new Event("input"));
    expect(calls).toEqual([]);
  });

  it("reset returns the queue to the inputEl value", () => {
    inputEl.value = "11\n22";
    io.reset();
    expect(io.getInputValues()).toEqual([11, 22]);
    expect(io.inputIndex()).toBe(0);
  });
});
// IO handling: input is a queue of values parsed from the input slots;
// output is a list of values written to the output textarea.

export class EndOfInputError extends Error {
  constructor() {
    super("No more input");
    this.name = "EndOfInputError";
  }
}

export function createIO(inputEl, outputEl) {
  let inputQueue = [];
  let inputIdx = 0;
  let outputLog = [];
  const listeners = new Set();

  function readInput() {
    if (inputIdx >= inputQueue.length) {
      // Halt execution cleanly: the executor catches this and stops the run loop.
      throw new EndOfInputError();
    }
    const value = inputQueue[inputIdx++];
    return value;
  }

  function writeOutput(value) {
    outputLog.push(value);
    renderOutput();
  }

  function renderOutput() {
    outputEl.value = outputLog.join("\n");
  }

  function reset() {
    inputIdx = 0;
    outputLog = [];
    parseInput();
    renderOutput();
  }

  function parseText(text) {
    return text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => {
        const n = Number(s);
        if (!Number.isFinite(n)) {
          throw new Error(`Invalid input value "${s}"`);
        }
        return n;
      });
  }

  function parseInput() {
    inputQueue = parseText(inputEl.value || "");
    inputIdx = 0;
  }

  function setOutput(values) {
    outputLog = values.slice();
    renderOutput();
  }

  function setInputIndex(idx) {
    inputIdx = idx;
  }

  function setInputValues(values) {
    inputQueue = values.slice();
    inputIdx = 0;
    if (inputEl && "value" in inputEl) {
      inputEl.value = inputQueue.join("\n");
    }
    for (const l of listeners) l();
  }

  function getInputValues() {
    return inputQueue.slice();
  }

  function setInputText(text) {
    inputQueue = parseText(text || "");
    inputIdx = 0;
    if (inputEl && "value" in inputEl) {
      inputEl.value = inputQueue.join("\n");
    }
    for (const l of listeners) l();
  }

  function getInputText() {
    return inputQueue.join("\n");
  }

  // Re-parse input whenever the user edits the underlying element.
  // (The slot UI calls setInputValues/setInputText directly; this listener
  // remains as a safety net for any other path that mutates inputEl.value.)
  if (inputEl && typeof inputEl.addEventListener === "function") {
    inputEl.addEventListener("input", () => {
      try {
        parseInput();
        for (const l of listeners) l();
      } catch {
        // ignore while typing
      }
    });
  }

  return {
    readInput,
    writeOutput,
    reset,
    outputValue: () => outputLog.slice(),
    inputIndex: () => inputIdx,
    setOutput,
    setInputIndex,
    setInputValues,
    getInputValues,
    setInputText,
    getInputText,
    onChange: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  };
}

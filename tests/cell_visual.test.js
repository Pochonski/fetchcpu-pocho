// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("RAM cell visual layout", () => {
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
    const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(/<body>([\s\S]*?)<\/body>/)[1];
    document.documentElement.innerHTML = body;
    const main = await import(resolve(ROOT, "js/main.js"));
    main.boot();
  });

  it("an instruction cell shows addr, tag, value, and (empty) label", () => {
    const td = document.querySelector('#ram-body [data-addr="0"]');
    expect(td.querySelector(".cell-addr").textContent).toBe("00");
    expect(td.querySelector(".cell-tag").textContent).toBe("INP");
    expect(td.querySelector(".cell-value").textContent).toBe("901");
    expect(td.querySelector(".cell-label").textContent).toBe("");
  });

  it("a data cell shows addr, DAT tag, value, and its label", () => {
    const td = document.querySelector('#ram-body [data-addr="6"]');
    expect(td.querySelector(".cell-addr").textContent).toBe("06");
    expect(td.querySelector(".cell-tag").textContent).toBe("DAT");
    expect(td.querySelector(".cell-value").textContent).toBe("000");
    expect(td.querySelector(".cell-label").textContent).toBe("num1");
  });

  it("the editable input is in the cell DOM but visually hidden", () => {
    const td = document.querySelector('#ram-body [data-addr="0"]');
    const input = td.querySelector(".cell-input");
    expect(input).toBeTruthy();
    expect(input.value).toBe("901");
  });

  it("STA writes the new value into the visible .cell-value span", () => {
    document.getElementById("codeListing").value = `INP\nSTA 4\nHLT\nDAT`;
    document.getElementById("input").value = "42";
    document.getElementById("btn-load").click();
    document.getElementById("btn-step").click(); // INP -> ACC=42
    document.getElementById("btn-step").click(); // STA 4 -> RAM[4]=42
    const td = document.querySelector('#ram-body [data-addr="4"]');
    expect(td.querySelector(".cell-value").textContent).toBe("042");
  });

  it("a freshly written cell gets data-modified='true' (single getLastWritten call)", () => {
    // Regression test: ramView.sync() used to call ram.getLastWritten() twice
    // in the same expression. Because getLastWritten() CONSUMES the slot, the
    // second call always returned -1 and the modified-cell flash never fired.
    document.getElementById("codeListing").value = `INP\nSTA 5\nHLT\nDAT 0`;
    document.getElementById("input").value = "17";
    document.getElementById("btn-load").click();
    document.getElementById("btn-step").click(); // INP -> ACC=17
    document.getElementById("btn-step").click(); // STA 5 -> RAM[5]=17
    const modifiedCell = document.querySelector('#ram-body [data-addr="5"]');
    const untouchedCell = document.querySelector('#ram-body [data-addr="0"]');
    expect(modifiedCell.dataset.modified).toBe("true");
    expect(untouchedCell.dataset.modified).toBe("false");
  });
});

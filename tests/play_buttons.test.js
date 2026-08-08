// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("Both play buttons", () => {
  let main;

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
    const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(
      /<body>([\s\S]*?)<\/body>/,
    )[1];
    document.documentElement.innerHTML = body;
    main = await import(resolve(ROOT, "js/main.js"));
    main.boot();
  });

  function load(src, inp) {
    document.getElementById("codeListing").value = src;
    document.getElementById("input").value = inp;
    document.getElementById("btn-load").click();
  }

  it("only two buttons exist in .control-buttons", () => {
    const strip = document.querySelector(".control-buttons");
    expect(strip.children.length).toBe(2);
    expect(document.getElementById("btn-pause")).toBeTruthy();
    expect(document.getElementById("btn-step")).toBeTruthy();
  });

  it("Step (F9) advances one FDE cycle per click", () => {
    load(`INP
STA num1
INP
ADD num1
OUT
HLT

num1 DAT
`, "3\n4");

    expect(document.getElementById("pc").value).toBe("00");
    expect(document.getElementById("acc").value).toBe("0000");

    document.getElementById("btn-step").click();
    expect(document.getElementById("pc").value).toBe("01");
    expect(document.getElementById("acc").value).toBe("0003");

    document.getElementById("btn-step").click();
    expect(document.getElementById("pc").value).toBe("02");
    // num1 is at addr 6 in this layout.
    expect(document.querySelector('#ram-body [data-addr="6"] input').value).toBe("003");

    document.getElementById("btn-step").click();
    expect(document.getElementById("acc").value).toBe("0004");

    document.getElementById("btn-step").click();
    expect(document.getElementById("acc").value).toBe("0007");

    document.getElementById("btn-step").click();
    expect(document.getElementById("output").value.trim()).toBe("7");

    document.getElementById("btn-step").click();
  });

  it("Run (F5) starts execution at clock speed and halts cleanly", async () => {
    document.getElementById("clock").value = "50";
    document.getElementById("clock").dispatchEvent(new Event("input"));
    load(`INP
OUT
HLT
`, "9");

    document.getElementById("btn-pause").click();
    expect(document.getElementById("btn-pause").querySelector("span").textContent).toBe("⏸");

    // Wait for halt: output=9 AND icon back to ▶.
    const start = Date.now();
    while (Date.now() - start < 4000) {
      await new Promise((r) => setTimeout(r, 50));
      const out = document.getElementById("output").value.trim();
      const icon = document.getElementById("btn-pause").querySelector("span").textContent;
      if (out === "9" && icon === "▶") break;
    }
    expect(document.getElementById("output").value.trim()).toBe("9");
    expect(document.getElementById("btn-pause").querySelector("span").textContent).toBe("▶");
  });

  it("Run toggle: clicking again pauses mid-execution and freezes state", async () => {
    document.getElementById("clock").value = "200";
    document.getElementById("clock").dispatchEvent(new Event("input"));
    load(`INP
OUT
HLT
`, "5");

    document.getElementById("btn-pause").click();
    await new Promise((r) => setTimeout(r, 250));
    document.getElementById("btn-pause").click(); // pause

    expect(document.getElementById("btn-pause").querySelector("span").textContent).toBe("▶");
    const snapshot = document.getElementById("output").value;
    await new Promise((r) => setTimeout(r, 800));
    expect(document.getElementById("output").value).toBe(snapshot);
  });
});

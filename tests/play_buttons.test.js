// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("Play / Step / Restart buttons", () => {
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

  function playButtonPath() {
    return document.getElementById("btn-pause").querySelector("svg.icon path").getAttribute("d");
  }
  function isPauseIcon() {
    return document.getElementById("btn-pause").getAttribute("data-running") === "true";
  }

  it("renders three icon-only buttons in the play strip", () => {
    const strip = document.querySelector(".control-buttons");
    expect(strip.children.length).toBe(3);
    expect(document.getElementById("btn-pause")).toBeTruthy();
    expect(document.getElementById("btn-step")).toBeTruthy();
    expect(document.getElementById("btn-restart")).toBeTruthy();
  });

  it("uses SVG icons (not unicode text) for every play button", () => {
    for (const id of ["btn-pause", "btn-step", "btn-restart"]) {
      const btn = document.getElementById(id);
      expect(btn.querySelector("svg.icon")).toBeTruthy();
      expect(btn.querySelector("span")).toBeNull();
    }
  });

  it("restart button has the right ARIA label and tooltip keys", () => {
    const btn = document.getElementById("btn-restart");
    expect(btn.getAttribute("aria-label")).toMatch(/Restart|Reiniciar/);
    expect(btn.getAttribute("title")).toMatch(/Restart|Reiniciar/);
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
    expect(isPauseIcon()).toBe(true);

    const start = Date.now();
    while (Date.now() - start < 4000) {
      await new Promise((r) => setTimeout(r, 50));
      const out = document.getElementById("output").value.trim();
      if (out === "9" && !isPauseIcon()) break;
    }
    expect(document.getElementById("output").value.trim()).toBe("9");
    expect(isPauseIcon()).toBe(false);
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

    expect(isPauseIcon()).toBe(false);
    const snapshot = document.getElementById("output").value;
    await new Promise((r) => setTimeout(r, 800));
    expect(document.getElementById("output").value).toBe(snapshot);
  });

  it("Restart reloads the program from RAM and resets IO", () => {
    load(`INP
OUT
HLT
`, "42");

    // Step a couple of cycles so the state advances.
    document.getElementById("btn-step").click();
    document.getElementById("btn-step").click();
    expect(document.getElementById("pc").value).not.toBe("00");
    expect(document.getElementById("output").value).not.toBe("");

    // Restart resets everything.
    document.getElementById("btn-restart").click();

    expect(document.getElementById("pc").value).toBe("00");
    expect(document.getElementById("acc").value).toBe("0000");
    expect(document.getElementById("output").value).toBe("");
    expect(document.getElementById("input").value).toBe("42");
  });

  it("Restart halts a running program before reloading", async () => {
    document.getElementById("clock").value = "200";
    document.getElementById("clock").dispatchEvent(new Event("input"));
    load(`INP
OUT
HLT
`, "7");

    document.getElementById("btn-pause").click(); // start
    await new Promise((r) => setTimeout(r, 100));
    expect(isPauseIcon()).toBe(true);

    document.getElementById("btn-restart").click();
    expect(isPauseIcon()).toBe(false);
    expect(document.getElementById("pc").value).toBe("00");
    expect(document.getElementById("output").value).toBe("");
  });

  it("F4 keyboard shortcut restarts the program", () => {
    load(`INP
OUT
HLT
`, "1");
    document.getElementById("btn-step").click();
    document.getElementById("btn-step").click();
    expect(document.getElementById("pc").value).not.toBe("00");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "F4" }));
    expect(document.getElementById("pc").value).toBe("00");
  });

  it("Restart does not start execution again automatically", () => {
    load(`INP
OUT
HLT
`, "9");
    document.getElementById("btn-step").click();
    expect(isPauseIcon()).toBe(false);

    document.getElementById("btn-restart").click();
    expect(isPauseIcon()).toBe(false);
    expect(document.getElementById("pc").value).toBe("00");
  });
});

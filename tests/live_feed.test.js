// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("Live feed shows rich cycle information", () => {
  let main;

  beforeAll(async () => {
    const store = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, v),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
      },
    });
    const body = readFileSync(resolve(ROOT, "index.html"), "utf8").match(
      /<body>([\s\S]*?)<\/body>/,
    )[1];
    document.documentElement.innerHTML = body;
    main = await import(resolve(ROOT, "js/main.js"));
    main.boot();
  });

  it("renders structured cycle rows with cycle counter, phase, mnemonic", () => {
    document.getElementById("codeListing").value = `INP
OUT
HLT
`;
    document.getElementById("input").value = "5";
    document.getElementById("btn-load").click();

    // Step twice: first INP, then OUT (which halts).
    document.getElementById("btn-step").click();
    document.getElementById("btn-step").click();

    const feed = document.getElementById("liveFeed");
    const rows = feed.querySelectorAll(".log-entry-wrap");
    expect(rows.length).toBeGreaterThanOrEqual(2);

    // Most recent row is OUT (HLT hasn't fired yet — we only stepped twice).
    const last = rows[0];
    expect(last.classList.contains("log-entry-execute")).toBe(true);

    // It contains a cycle counter, a phase badge and a mnemonic badge.
    expect(last.querySelector(".lf-cycle").textContent).toMatch(/^#\d{4}$/);
    const phase = last.querySelector(".lf-phase");
    expect(phase).toBeTruthy();
    expect(phase.classList.toString()).toMatch(/lf-phase-(fetch|decode|execute)/);
    const mnem = last.querySelector(".lf-mnem");
    expect(mnem).toBeTruthy();
    expect(["INP", "OUT", "HLT", "LDA", "STA", "ADD", "SUB", "BRP", "BRZ", "BRA"]).toContain(mnem.textContent);
  });

  it("shows diffs (old→new) for changed registers only", () => {
    // Fresh load
    document.getElementById("codeListing").value = `INP
OUT
HLT
`;
    document.getElementById("input").value = "7";
    document.getElementById("btn-load").click();

    // First step (INP) changes ACC from 0 to 7.
    document.getElementById("btn-step").click();

    const feed = document.getElementById("liveFeed");
    const rows = feed.querySelectorAll(".log-entry-wrap");
    // First row should be the most recent (prepended). Find an "execute"
    // row containing the INP mnemonic and an ACC diff.
    const inpRow = Array.from(rows).find((r) =>
      r.querySelector(".lf-mnem")?.textContent === "INP" &&
      r.classList.contains("log-entry-execute"),
    );
    expect(inpRow).toBeTruthy();

    // The ACC row should contain both the old (struck-through) and new values.
    const accDiff = Array.from(inpRow.querySelectorAll(".lf-reg")).find((r) =>
      r.textContent.startsWith("ACC:"),
    );
    expect(accDiff).toBeTruthy();
    expect(accDiff.querySelector("s")).toBeTruthy();
    expect(accDiff.querySelector("b")).toBeTruthy();
    expect(accDiff.textContent).toMatch(/0/);
    expect(accDiff.textContent).toMatch(/7/);
  });

  it("shows flag indicators (Z / N / P) with the active one highlighted", () => {
    document.getElementById("codeListing").value = `INP
OUT
HLT
`;
    document.getElementById("input").value = "3";
    document.getElementById("btn-load").click();
    document.getElementById("btn-step").click(); // INP — ACC becomes 3 (Positive)

    const feed = document.getElementById("liveFeed");
    const rows = feed.querySelectorAll(".log-entry-wrap");
    const inpRow = Array.from(rows).find((r) =>
      r.querySelector(".lf-mnem")?.textContent === "INP" &&
      r.classList.contains("log-entry-execute"),
    );
    expect(inpRow).toBeTruthy();

    const flags = inpRow.querySelectorAll(".lf-flag");
    expect(flags.length).toBe(3);
    expect(flags[0].textContent).toBe("Z");
    expect(flags[1].textContent).toBe("N");
    expect(flags[2].textContent).toBe("P");

    // After reading 3, P (Positive) is active.
    expect(flags[2].classList.contains("lf-flag-on")).toBe(true);
    expect(flags[0].classList.contains("lf-flag-on")).toBe(false);
    expect(flags[1].classList.contains("lf-flag-on")).toBe(false);
  });

  it("shows the human-readable note on a second line", () => {
    document.getElementById("codeListing").value = `INP
OUT
HLT
`;
    document.getElementById("input").value = "5";
    document.getElementById("btn-load").click();
    document.getElementById("btn-step").click();

    const feed = document.getElementById("liveFeed");
    const rows = feed.querySelectorAll(".log-entry-wrap");
    const inpRow = Array.from(rows).find((r) =>
      r.querySelector(".lf-mnem")?.textContent === "INP",
    );
    expect(inpRow).toBeTruthy();

    const note = inpRow.querySelector(".lf-note");
    expect(note).toBeTruthy();
    expect(note.textContent.length).toBeGreaterThan(5);
  });

  it("uses phase-coloured left border per row", () => {
    document.getElementById("codeListing").value = `INP
OUT
HLT
`;
    document.getElementById("input").value = "1";
    document.getElementById("btn-load").click();
    document.getElementById("btn-step").click();

    const feed = document.getElementById("liveFeed");
    const rows = Array.from(feed.querySelectorAll(".log-entry-wrap"));
    // Each FDE cycle emits a single tick whose phase is the final phase
    // (execute). The wrap carries that phase as a class for the left border.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.classList.contains("log-entry-execute"))).toBe(true);
  });

  it("shows mnemonic colour-coded by category (IO/branch/halt)", () => {
    document.getElementById("codeListing").value = `INP
STA x
HLT
x DAT
`;
    document.getElementById("input").value = "9";
    document.getElementById("btn-load").click();
    document.getElementById("btn-step").click();
    document.getElementById("btn-step").click();
    document.getElementById("btn-step").click();

    const feed = document.getElementById("liveFeed");
    const rows = Array.from(feed.querySelectorAll(".log-entry-wrap"));

    const inp = Array.from(rows).find((r) =>
      r.querySelector(".lf-mnem")?.textContent === "INP" &&
      r.classList.contains("log-entry-execute"),
    );
    expect(inp.querySelector(".lf-mnem").classList.contains("lf-mnem-io")).toBe(true);

    const hlt = Array.from(rows).find((r) =>
      r.querySelector(".lf-mnem")?.textContent === "HLT" &&
      r.classList.contains("log-entry-execute"),
    );
    expect(hlt.querySelector(".lf-mnem").classList.contains("lf-mnem-hlt")).toBe(true);
  });

  it("lifecycle events (loaded / halted / error) still render as plain text rows", () => {
    document.getElementById("codeListing").value = `INP
OUT
HLT
`;
    document.getElementById("input").value = "2";
    document.getElementById("btn-load").click();
    // Should see a "Loaded program with N instructions." row.
    const feed = document.getElementById("liveFeed");
    const lifecycle = Array.from(feed.querySelectorAll(".log-entry"))
      .map((el) => el.textContent);
    expect(lifecycle.some((t) => /Loaded program/i.test(t))).toBe(true);

    // Step until HLT.
    document.getElementById("btn-step").click();
    document.getElementById("btn-step").click();
    document.getElementById("btn-step").click();
    // Halt row.
    const halted = Array.from(feed.querySelectorAll(".log-entry-halt"))
      .map((el) => el.textContent);
    expect(halted.length).toBeGreaterThan(0);
  });

  it("CSS defines styles for every part of the rich live feed", () => {
    // css/components.css is now a thin facade that @imports per-concern
    // files; the live-feed rules live in components/log.css.
    const logCss = readFileSync(resolve(ROOT, "css/components/log.css"), "utf8");
    expect(logCss).toMatch(/\.lf-cycle/);
    expect(logCss).toMatch(/\.lf-phase/);
    expect(logCss).toMatch(/\.lf-mnem/);
    expect(logCss).toMatch(/\.lf-reg/);
    expect(logCss).toMatch(/\.lf-flag/);
    expect(logCss).toMatch(/\.lf-note/);
    expect(logCss).toMatch(/\.lf-mnem-io/);
    expect(logCss).toMatch(/\.lf-mnem-hlt/);
    expect(logCss).toMatch(/\.lf-mnem-branch/);
    expect(logCss).toMatch(/\.lf-flag-on/);
  });
});
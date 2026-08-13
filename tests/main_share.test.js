// @vitest-environment jsdom
// Tests for the share URL consumption path in main.js: a valid #fcpu=…
// hash must populate the editor + input + localStorage and clear the hash,
// while an invalid or absent hash must fall through to localStorage / default.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function read(rel) { return readFileSync(resolve(ROOT, rel), "utf8"); }
function injectBody() {
  const body = read("index.html").match(/<body>([\s\S]*?)<\/body>/)[1];
  document.documentElement.innerHTML = body;
}

function encodeShare(source, input = "") {
  const payload = JSON.stringify({ s: source, i: input });
  const bytes = new TextEncoder().encode(payload);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `fcpu=${btoa(bin)}`;
}

let main;

describe("Share URL consumption in main.js boot()", () => {
  beforeAll(async () => {
    if (!globalThis.localStorage) {
      const store = new Map();
      Object.defineProperty(globalThis, "localStorage", {
        value: {
          getItem: (k) => store.get(k) ?? null,
          setItem: (k, v) => store.set(k, v),
          removeItem: (k) => store.delete(k),
          clear: () => store.clear(),
        },
      });
    }
    injectBody();
    main = await import(resolve(ROOT, "js/main.js"));
  });

  beforeEach(() => {
    // Reset persisted state before each scenario.
    localStorage.clear();
    location.hash = "";
  });

  it("a valid #fcpu= hash populates the editor with the shared source", () => {
    const sharedSource = "INP\nOUT\nHLT";
    const sharedInput = "42";
    location.hash = `#${encodeShare(sharedSource, sharedInput)}`;

    main.resetBoot();
    main.boot();

    const editor = document.getElementById("codeListing");
    expect(editor.value).toBe(sharedSource);
  });

  it("populates the hidden input + mirrors into localStorage on a valid hash", () => {
    const sharedSource = "INP\nOUT\nHLT";
    const sharedInput = "7";
    location.hash = `#${encodeShare(sharedSource, sharedInput)}`;

    main.resetBoot();
    main.boot();

    const hidden = document.getElementById("input");
    expect(hidden.value).toBe(sharedInput);
    expect(localStorage.getItem("fetchcpu.input")).toBe(sharedInput);
    expect(localStorage.getItem("fetchcpu.source")).toBe(sharedSource);
  });

  it("clears the consumed hash so a reload does not re-import it", () => {
    const sharedSource = "INP\nOUT\nHLT";
    location.hash = `#${encodeShare(sharedSource, "")}`;

    main.resetBoot();
    main.boot();

    expect(location.hash).toBe("");
  });

  it("falls back to localStorage when the hash is absent", () => {
    const saved = "LDA 10\nOUT\nHLT";
    localStorage.setItem("fetchcpu.source", saved);

    main.resetBoot();
    main.boot();

    const editor = document.getElementById("codeListing");
    expect(editor.value).toBe(saved);
  });

  it("falls back to the default example when there is no hash and no localStorage", () => {
    main.resetBoot();
    main.boot();

    const editor = document.getElementById("codeListing");
    expect(editor.value.length).toBeGreaterThan(0);
  });

  it("a malformed #fcpu= hash is ignored and falls back gracefully", () => {
    const malformed = "#fcpu=this-is-not-valid-base64-$$$";
    location.hash = malformed;
    const saved = "ADD 5\nOUT\nHLT";
    localStorage.setItem("fetchcpu.source", saved);

    main.resetBoot();
    main.boot();

    const editor = document.getElementById("codeListing");
    expect(editor.value).toBe(saved);
    expect(location.hash).toBe(malformed);
  });

  it("a #fcpu= hash with empty source is treated as a valid (empty) import", () => {
    location.hash = `#${encodeShare("", "")}`;

    main.resetBoot();
    main.boot();

    const editor = document.getElementById("codeListing");
    expect(editor.value).toBe("");
    expect(location.hash).toBe("");
  });
});

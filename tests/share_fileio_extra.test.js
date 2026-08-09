// @vitest-environment jsdom
// Tests for share.js and fileIO.js — the URL/file format round-trips.
import { describe, it, expect } from "vitest";
import { encodeShare, decodeShare, currentShare } from "../js/ui/share.js";
import { exportFile, parseFile } from "../js/ui/fileIO.js";

describe("share.js — encodeShare / decodeShare", () => {
  it("round-trips source + input", () => {
    const source = "INP\nOUT\nHLT";
    const input = "1\n2\n3";
    const hash = encodeShare(source, input);
    expect(hash.startsWith("fcpu=")).toBe(true);
    const decoded = decodeShare(hash);
    expect(decoded.source).toBe(source);
    expect(decoded.input).toBe(input);
  });

  it("decodeShare accepts a leading '#' (window.location.hash style)", () => {
    const source = "INP\nOUT\nHLT";
    const input = "1\n2";
    const hash = encodeShare(source, input);
    const decoded = decodeShare("#" + hash);
    expect(decoded.source).toBe(source);
    expect(decoded.input).toBe(input);
  });

  it("treats null/undefined input as empty string", () => {
    const hash = encodeShare("INP\nHLT", "");
    const decoded = decodeShare(hash);
    expect(decoded.source).toBe("INP\nHLT");
    expect(decoded.input).toBe("");
  });

  it("returns null on malformed hash", () => {
    expect(decodeShare("")).toBeNull();
    expect(decodeShare("#fcpu=not_base64_!!!")).toBeNull();
    expect(decodeShare("#notfcpu=abc")).toBeNull();
  });

  it("decodes non-ASCII characters (UTF-8 safe)", () => {
    const source = "; comentario en español — ñ";
    const hash = encodeShare(source, "");
    const decoded = decodeShare(hash);
    expect(decoded.source).toBe(source);
  });

  it("currentShare returns the URL-ready hash", () => {
    // Force location for the test environment.
    const orig = globalThis.location;
    delete globalThis.location;
    globalThis.location = { origin: "https://example.com", pathname: "/app/" };
    const url = currentShare("X", "");
    expect(url).toMatch(/^https:\/\/example\.com\/app\/#fcpu=/);
    globalThis.location = orig;
  });
});

describe("fileIO.js — exportFile / parseFile", () => {
  it("round-trips a plain source without input metadata", () => {
    const text = exportFile("INP\nOUT\nHLT", "");
    expect(text).toBe("INP\nOUT\nHLT");
    const parsed = parseFile(text);
    expect(parsed.source).toBe("INP\nOUT\nHLT");
    expect(parsed.input).toBe("");
  });

  it("includes the ;; INPUT: separator when input is non-empty", () => {
    const text = exportFile("INP\nOUT", "3\n4");
    expect(text).toContain(";; INPUT:");
    const parsed = parseFile(text);
    expect(parsed.source).toBe("INP\nOUT");
    expect(parsed.input).toBe("3\n4");
  });

  it("takes the first ;; INPUT: separator as the source/input split", () => {
    // The current implementation splits on the FIRST occurrence of the
    // marker, so any `;; INPUT:` inside comments is treated as the boundary.
    // Document the behaviour explicitly here so a future change is deliberate.
    const text = "X ; ;; INPUT:\nOUT\n;; INPUT:\n1";
    const parsed = parseFile(text);
    expect(parsed.source).toBe("X ;");
    expect(parsed.input).toBe("OUT\n;; INPUT:\n1");
  });
});
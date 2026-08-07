import { describe, it, expect } from "vitest";
import { encodeShare, decodeShare } from "../js/ui/share.js";
import { parseFile, exportFile } from "../js/ui/fileIO.js";

describe("URL share", () => {
  it("round-trips source and input", () => {
    const src = "INP\nOUT\nHLT\n";
    const inp = "5\n7\n";
    const enc = encodeShare(src, inp);
    expect(enc).toMatch(/^lmc=/);
    const decoded = decodeShare(enc);
    expect(decoded).toEqual({ source: src, input: inp });
  });

  it("handles missing hash", () => {
    expect(decodeShare("not-a-share-hash")).toBeNull();
  });

  it("survives unicode source", () => {
    const src = "; programa: ñoño\nINP\nOUT\n";
    const enc = encodeShare(src, "");
    const dec = decodeShare(enc);
    expect(dec.source).toBe(src);
  });
});

describe("file IO", () => {
  it("exports without input when input empty", () => {
    const src = "INP\nOUT\n";
    const out = exportFile(src, "");
    expect(out).toBe(src);
  });

  it("exports with input metadata when present", () => {
    const src = "INP\nOUT\n";
    const out = exportFile(src, "5\n7\n");
    expect(out).toContain(";; INPUT:");
    expect(out).toContain("5\n7");
  });

  it("parses files with metadata", () => {
    const text = "INP\nOUT\n;; INPUT:\n5";
    const { source, input } = parseFile(text);
    expect(source).toBe("INP\nOUT");
    expect(input).toBe("5");
  });

  it("parses plain files", () => {
    const text = "INP\nOUT\n";
    const { source, input } = parseFile(text);
    expect(source).toBe("INP\nOUT\n");
    expect(input).toBe("");
  });
});

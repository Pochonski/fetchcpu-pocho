import { describe, it, expect } from "vitest";
import { parse, encodeInstruction, resolveLabels } from "../js/lmc/parser.js";

describe("parser", () => {
  it("parses labels and mnemonics", () => {
    const src = `      INP
      STA num1
      HLT

num1  DAT
`;
    const r = parse(src);
    expect(r.ok).toBe(true);
    expect(r.program.labels.num1).toBe(3);
    expect(r.program.instructions.map((i) => i.mnemonic)).toEqual(["INP", "STA", "HLT", "DAT"]);
  });

  it("flags unknown mnemonics", () => {
    const r = parse("FOO\n");
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/Unknown mnemonic/);
  });

  it("supports immediate and indirect addressing", () => {
    const r = parse("LDA #5\nADD @7\n");
    expect(r.ok).toBe(true);
    expect(r.program.instructions[0].operand.mode).toBe("immediate");
    expect(r.program.instructions[1].operand.mode).toBe("indirect");
  });

  it("ignores comments", () => {
    const r = parse("; full line comment\nINP ; trailing\n");
    expect(r.ok).toBe(true);
    expect(r.program.instructions.length).toBe(1);
  });

  it("encodes a known program correctly", () => {
    const r = parse(`INP
OUT
HLT
`);
    expect(r.ok).toBe(true);
    const encoded = r.program.instructions.map((i) => ({
      src: i.mnemonic,
      word: encodeInstruction(i).value,
    }));
    expect(encoded[0].word).toBe(901);
    expect(encoded[1].word).toBe(902);
    expect(encoded[2].word).toBe(0);
  });

  it("resolves labels for branches", () => {
    const r = parse(`BRA end
HLT
end HLT
`);
    expect(r.ok).toBe(true);
    const entries = r.program.instructions.map((i) => ({
      ...i,
      code: encodeInstruction(i),
    }));
    resolveLabels(entries, r.program.labels);
    expect(entries[0].code.value).toBe(602); // BRA + addr 2
  });

  it("rejects programs that exceed RAM size", () => {
    // 101 NOP-style instructions (each is a DAT 0 line) overflow the 100 cells.
    const source = Array.from({ length: 101 }, () => "DAT 0").join("\n") + "\n";
    const r = parse(source);
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/too large/i);
  });

  it("accepts programs that exactly fill RAM", () => {
    const source = Array.from({ length: 100 }, () => "DAT 0").join("\n") + "\n";
    const r = parse(source);
    expect(r.ok).toBe(true);
    expect(r.program.instructions.length).toBe(100);
  });
});

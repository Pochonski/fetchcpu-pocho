// FetchCPU opcodes - 3-digit numeric code mapping
// Source: ISA specification

export const OPCODES = Object.freeze({
  INP: { code: 901, size: 1, type: "io" },     // read from input to ACC
  OUT: { code: 902, size: 1, type: "io" },     // output ACC
  LDA: { code: 5, size: 1, type: "memory" },   // 5xx
  STA: { code: 3, size: 1, type: "memory" },   // 3xx
  ADD: { code: 1, size: 1, type: "memory" },   // 1xx
  SUB: { code: 2, size: 1, type: "memory" },   // 2xx
  BRP: { code: 8, size: 1, type: "branch" },   // 8xx
  BRZ: { code: 7, size: 1, type: "branch" },   // 7xx
  BRA: { code: 6, size: 1, type: "branch" },   // 6xx
  HLT: { code: 0, size: 1, type: "control" }, // halt
  DAT: { code: null, size: 1, type: "data" },  // handled separately
});

// Inverse map: numeric opcode -> mnemonic for memory/branch opcodes only.
// HLT is excluded because its encoding (000) collides with stray short
// literals like 42 (DAT) — callers must handle 000 explicitly.
export const REVERSE_OPCODES = Object.freeze(
  Object.entries(OPCODES)
    .filter(([, v]) => v.code !== null && (v.type === "memory" || v.type === "branch"))
    .reduce((acc, [mnem, info]) => {
      acc[info.code] = mnem;
      return acc;
    }, {}),
);

// Decode a raw RAM word into mnemonic + operand. Single source of truth
// shared by every UI surface (ramView, disassemblerView) so the views can
// never drift from the canonical ISA.
//
// Returns:
//   { mnemonic: "INP" | "OUT" | "HLT" | "DAT" | <memory/branch mnem>,
//     operand: <string>,  // formatted operand ("" for no-operand mnemonics,
//                         // padded "NN" for memory/branch, raw word for DAT)
//     type:     "io" | "control" | "memory" | "branch" | "data" }
export function disassemble(word) {
  const n = Number(word);
  // HLT is the only control-flow instruction with no operand; its encoding
  // is exactly 000 (a stray word like 42 with opcode=0 is a DAT literal).
  if (n === 0)   return { mnemonic: "HLT", operand: "", type: "control" };
  // IO instructions use the full 3-digit code; there is no operand.
  if (n === 901) return { mnemonic: "INP", operand: "", type: "io" };
  if (n === 902) return { mnemonic: "OUT", operand: "", type: "io" };
  // Anything outside [0, 999] can't be a valid instruction encoding —
  // treat as a DAT literal (supports signed storage and oversized values).
  if (n < 0 || n > 999) return { mnemonic: "DAT", operand: String(n), type: "data" };
  // The instruction-word form is `opcode * 100 + operand` where opcode is
  // one of {1, 2, 3, 5, 6, 7, 8} and operand is 0..99.
  const opcode = Math.floor(n / 100);
  const operand = n % 100;
  const mnem = REVERSE_OPCODES[opcode];
  if (mnem) {
    return {
      mnemonic: mnem,
      operand: String(operand).padStart(2, "0"),
      type: OPCODES[mnem].type,
    };
  }
  return { mnemonic: "DAT", operand: String(n), type: "data" };
}

// FetchCPU opcodes - 3-digit numeric code mapping
// Source: ISA specification

export const OPCODES = Object.freeze({
  INP: { code: 901, size: 1, type: "io" },     // read from input to ACC
  OUT: { code: 902, size: 1, type: "io" },     // output ACC
  LDA: { code: 5, size: 1, type: "memory", hasOperand: true },   // 5xx
  STA: { code: 3, size: 1, type: "memory", hasOperand: true },   // 3xx
  ADD: { code: 1, size: 1, type: "memory", hasOperand: true },   // 1xx
  SUB: { code: 2, size: 1, type: "memory", hasOperand: true },   // 2xx
  BRP: { code: 8, size: 1, type: "branch", hasOperand: true },   // 8xx
  BRZ: { code: 7, size: 1, type: "branch", hasOperand: true },   // 7xx
  BRA: { code: 6, size: 1, type: "branch", hasOperand: true },   // 6xx
  HLT: { code: 0, size: 1, type: "control" }, // halt
  DAT: { code: null, size: 1, type: "data" },  // handled separately
});

// Inverse map: numeric opcode -> mnemonic (used internally)
export const REVERSE_OPCODES = Object.freeze(
  Object.entries(OPCODES)
    .filter(([, v]) => v.code !== null && v.type !== "io")
    .reduce((acc, [mnem, info]) => {
      acc[info.code] = mnem;
      return acc;
    }, {}),
);

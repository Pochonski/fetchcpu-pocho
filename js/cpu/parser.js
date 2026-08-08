// Two-pass assembler for the assembly dialect used in the simulator.
// Supports labels, comments (';' or '//'), immediate addressing (#5) and
// indirect addressing (@label), and DAT declarations with optional initial values.
//
// Returns:
//   {
//     ok: true,
//     program: { sourceLine: [..], address: [..], instruction: [..], labels: { name -> addr } }
//   }
// or:
//   {
//     ok: false,
//     errors: [{ line, column, message }]
//   }

import { OPCODES } from "./opcodes.js";
import { RAM_SIZE } from "./ram.js";

const COMMENT_RE = /[;]|(\/\/)/;

function stripComment(line) {
  const idx = line.search(COMMENT_RE);
  if (idx === -1) return line;
  return line.slice(0, idx);
}

function tokenize(rawLine) {
  const line = stripComment(rawLine);
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens;
}

/**
 * @param {string} source
 * @returns {{ ok: boolean, program?: object, errors?: object[] }}
 */
export function parse(source) {
  const errors = [];
  const lines = source.split(/\r?\n/);

  // First pass: collect labels and identify instruction lines.
  const items = []; // { sourceLine, raw, label?, mnemonic?, operandText? }
  const labels = new Map();
  let addr = 0;

  lines.forEach((raw, i) => {
    const lineNumber = i + 1;
    const tokens = tokenize(raw);
    if (tokens.length === 0) return; // blank or comment-only

    let cursor = 0;
    let label = null;
    let mnemonic = null;
    let operandText = null;

    // Label form: "label rest of line...". A label is recognised if the first
    // token ends with a colon, OR if there is more than one token and the first
    // token is not a known mnemonic and the line has a mnemonic later.
    if (tokens[0].endsWith(":")) {
      label = tokens[0].slice(0, -1);
      cursor = 1;
    } else if (
      tokens.length > 1 &&
      !Object.hasOwn(OPCODES, tokens[0].toUpperCase()) &&
      !looksNumeric(tokens[0])
    ) {
      label = tokens[0];
      cursor = 1;
    }

    if (cursor >= tokens.length) {
      errors.push({
        line: lineNumber,
        column: raw.indexOf(label) + 1,
        message: `Label "${label}" is missing an instruction`,
      });
      return;
    }

    mnemonic = tokens[cursor].toUpperCase();
    if (!Object.hasOwn(OPCODES, mnemonic)) {
      errors.push({
        line: lineNumber,
        column: 1,
        message: `Unknown mnemonic "${tokens[cursor]}"`,
      });
      return;
    }

    if (cursor + 1 < tokens.length) {
      operandText = tokens.slice(cursor + 1).join(" ");
    }

    if (label) {
      if (labels.has(label)) {
        errors.push({
          line: lineNumber,
          column: raw.indexOf(label) + 1,
          message: `Duplicate label "${label}"`,
        });
      } else {
        labels.set(label, addr);
      }
    }

    items.push({ sourceLine: lineNumber, raw, label, mnemonic, operandText, address: addr });
    addr += 1;
  });

  if (errors.length > 0) return { ok: false, errors };

  // Reject programs that exceed the RAM size.
  if (addr > RAM_SIZE) {
    errors.push({
      line: items[items.length - 1].sourceLine,
      column: 1,
      message: `Program is too large: ${addr} instructions exceed RAM size ${RAM_SIZE}`,
    });
    return { ok: false, errors };
  }

  // Second pass: resolve operands.
  const instructions = [];
  items.forEach((item) => {
    const op = operandFromText(item.operandText, item.mnemonic, item.sourceLine, labels, errors);
    instructions.push({
      sourceLine: item.sourceLine,
      address: item.address,
      label: item.label,
      mnemonic: item.mnemonic,
      operand: op,
      raw: item.raw,
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    program: {
      lines: instructions.map((i) => i.sourceLine),
      addresses: instructions.map((i) => i.address),
      instructions, // [{sourceLine, address, label, mnemonic, operand}]
      labels: Object.fromEntries(labels),
    },
  };
}

/**
 * Convert operand text into a structured operand descriptor.
 * Forms supported:
 *    "5"          -> { mode: "direct",      value: "5",   ref: null }
 *    "label"      -> { mode: "direct",      value: null,  ref: "label" }
 *    "#5"         -> { mode: "immediate",   value: "5",   ref: null }
 *    "@label"     -> { mode: "indirect",    value: null,  ref: "label" }
 *    "@5"         -> { mode: "indirect",    value: "5",   ref: null }
 */
function operandFromText(text, mnemonic, sourceLine, labels, errors) {
  if (mnemonic === "DAT") {
    if (text == null || text.trim() === "") return { mode: "data", value: null };
    const v = text.trim();
    if (!looksNumeric(v)) {
      errors.push({
        line: sourceLine,
        column: 1,
        message: `DAT value must be numeric (got "${v}")`,
      });
    }
    return { mode: "data", value: v };
  }
  if (mnemonic === "HLT" || mnemonic === "INP" || mnemonic === "OUT") {
    if (text != null && text.trim() !== "") {
      errors.push({
        line: sourceLine,
        column: 1,
        message: `"${mnemonic}" does not take an operand`,
      });
    }
    return null;
  }
  if (text == null || text.trim() === "") {
    errors.push({
      line: sourceLine,
      column: 1,
      message: `"${mnemonic}" requires an operand`,
    });
    return null;
  }
  const trimmed = text.trim();

  // Immediate
  if (trimmed.startsWith("#")) {
    const v = trimmed.slice(1);
    if (!looksNumeric(v)) {
      errors.push({
        line: sourceLine,
        column: 1,
        message: `Immediate operand must be numeric (got "${v}")`,
      });
    }
    return { mode: "immediate", value: v, ref: null };
  }
  // Indirect
  if (trimmed.startsWith("@")) {
    const ref = trimmed.slice(1);
    if (looksNumeric(ref)) return { mode: "indirect", value: ref, ref: null };
    return { mode: "indirect", value: null, ref };
  }
  // Direct
  if (looksNumeric(trimmed)) {
    return { mode: "direct", value: trimmed, ref: null };
  }
  return { mode: "direct", value: null, ref: trimmed };
}

function looksNumeric(t) {
  if (t == null) return false;
  return /^-?\d+$/.test(t);
}

/**
 * Encode a parsed instruction into the numeric word stored in RAM.
 */
export function encodeInstruction(instr) {
  const info = OPCODES[instr.mnemonic];
  if (instr.mnemonic === "DAT") {
    if (instr.operand == null || instr.operand.value == null) return { value: 0, mode: "data" };
    const t = String(instr.operand.value).trim();
    const v = t === "" ? 0 : Number(t);
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid DAT value "${t}" on line ${instr.sourceLine}`);
    }
    return { value: v, mode: "data" };
  }

  let operandValue = 0;
  if (instr.operand != null) {
    if (instr.operand.mode === "immediate") {
      operandValue = Number(instr.operand.value);
    } else if (instr.operand.ref != null) {
      // Labels resolved later by resolve(); record raw ref instead.
      return { ref: instr.operand.ref, mode: instr.operand.mode, mnemonic: instr.mnemonic };
    } else {
      operandValue = Number(instr.operand.value);
    }
  }
  if (info.type === "io" || info.type === "control") {
    return { value: info.code, mode: "control" };
  }
  return { value: info.code * 100 + operandValue, mode: "code" };
}

/**
 * Apply pending label references to instructions whose numeric value was not yet known.
 * Mutates `targetAddressed` in-place.
 */
export function resolveLabels(entries, labels) {
  for (const e of entries) {
    if (e == null || e.code == null) continue;
    if (e.code.ref != null && e.code.mode !== "data" && e.code.mode !== "control") {
      const addr = labels[e.code.ref];
      if (addr == null) {
        throw new Error(`Unresolved label "${e.code.ref}"`);
      }
      const op = OPCODES[e.code.mnemonic];
      e.code = { value: op.code * 100 + addr, mode: "code" };
    }
  }
}

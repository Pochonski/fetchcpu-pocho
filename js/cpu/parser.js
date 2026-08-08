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
//     errors: [{ line, column, key, args, message }]
//   }
// `key` and `args` are i18n-friendly. `message` is kept as the English
// fallback so unit tests and non-i18n consumers still get a usable string.

import { OPCODES } from "./opcodes.js";
import { RAM_SIZE } from "./ram.js";

const COMMENT_RE = /[;]|(\/\/)/;

function stripComment(line) {
  const idx = line.search(COMMENT_RE);
  if (idx === -1) return line;
  return line.slice(0, idx);
}

// English fallbacks for parser errors. Keys are dotted so the UI layer can
// look them up in the dictionaries (en / es) via t(key, args).
const EN = {
  "parser.labelMissingInstruction": (label) => `Label "${label}" is missing an instruction`,
  "parser.unknownMnemonic":          (tok)   => `Unknown mnemonic "${tok}"`,
  "parser.duplicateLabel":           (label) => `Duplicate label "${label}"`,
  "parser.programTooLarge":          (n, max) => `Program is too large: ${n} instructions exceed RAM size ${max}`,
  "parser.datNotNumeric":            (v)     => `DAT value must be numeric (got "${v}")`,
  "parser.mnemonicNoOperand":        (m)     => `"${m}" does not take an operand`,
  "parser.mnemonicRequiresOperand":  (m)     => `"${m}" requires an operand`,
  "parser.immediateNotNumeric":      (v)     => `Immediate operand must be numeric (got "${v}")`,
  "parser.invalidDatValue":          (v, line) => `Invalid DAT value "${v}" on line ${line}`,
  "parser.unresolvedLabel":          (ref)   => `Unresolved label "${ref}"`,
};

function error(key, args, line, column) {
  const fn = EN[key];
  return { line, column, key, args, message: fn ? fn(...args) : key };
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
      errors.push(error("parser.labelMissingInstruction", [label], lineNumber, raw.indexOf(label) + 1));
      return;
    }

    mnemonic = tokens[cursor].toUpperCase();
    if (!Object.hasOwn(OPCODES, mnemonic)) {
      errors.push(error("parser.unknownMnemonic", [tokens[cursor]], lineNumber, 1));
      return;
    }

    if (cursor + 1 < tokens.length) {
      operandText = tokens.slice(cursor + 1).join(" ");
    }

    if (label) {
      if (labels.has(label)) {
        errors.push(error("parser.duplicateLabel", [label], lineNumber, raw.indexOf(label) + 1));
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
    errors.push(error("parser.programTooLarge", [addr, RAM_SIZE], items[items.length - 1].sourceLine, 1));
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
      errors.push(error("parser.datNotNumeric", [v], sourceLine, 1));
    }
    return { mode: "data", value: v };
  }
  if (mnemonic === "HLT" || mnemonic === "INP" || mnemonic === "OUT") {
    if (text != null && text.trim() !== "") {
      errors.push(error("parser.mnemonicNoOperand", [mnemonic], sourceLine, 1));
    }
    return null;
  }
  if (text == null || text.trim() === "") {
    errors.push(error("parser.mnemonicRequiresOperand", [mnemonic], sourceLine, 1));
    return null;
  }
  const trimmed = text.trim();

  // Immediate
  if (trimmed.startsWith("#")) {
    const v = trimmed.slice(1);
    if (!looksNumeric(v)) {
      errors.push(error("parser.immediateNotNumeric", [v], sourceLine, 1));
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
      throw new Error(EN["parser.invalidDatValue"](t, instr.sourceLine));
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
        throw new Error(EN["parser.unresolvedLabel"](e.code.ref));
      }
      const op = OPCODES[e.code.mnemonic];
      e.code = { value: op.code * 100 + addr, mode: "code" };
    }
  }
}

// Renders the current and next instructions in mnemonics form, plus a
// unified view of the program in memory.

import { t, registerOnChange } from "./i18n/index.js";

export function createDisassemblerView(executor, ram, cpu) {
  const current = document.getElementById("disasm-current");
  const next = document.getElementById("disasm-next");
  if (!current || !next) {
    return { render() {} }; // not mounted
  }

  let halted = false;

  function fmtOperand(addr, mode) {
    if (mode === "indirect") return `@${String(addr).padStart(2, "0")}`;
    return String(addr).padStart(2, "0");
  }

  function describe(word) {
    if (word === 901) return { mnemonic: "INP", operand: "" };
    if (word === 902) return { mnemonic: "OUT", operand: "" };
    if (word === 0)   return { mnemonic: "HLT", operand: "" };
    const opcode = Math.floor(word / 100);
    const operand = word % 100;
    switch (opcode) {
      case 5: return { mnemonic: "LDA", operand: ` ${fmtOperand(operand, "direct")}` };
      case 3: return { mnemonic: "STA", operand: ` ${fmtOperand(operand, "direct")}` };
      case 1: return { mnemonic: "ADD", operand: ` ${fmtOperand(operand, "direct")}` };
      case 2: return { mnemonic: "SUB", operand: ` ${fmtOperand(operand, "direct")}` };
      case 8: return { mnemonic: "BRP", operand: ` ${fmtOperand(operand, "direct")}` };
      case 7: return { mnemonic: "BRZ", operand: ` ${fmtOperand(operand, "direct")}` };
      case 6: return { mnemonic: "BRA", operand: ` ${fmtOperand(operand, "direct")}` };
      default: return { mnemonic: "DAT", operand: ` ${word}` };
    }
  }

  function render() {
    const cirWord = cpu.state.cir;
    const cur = describe(cirWord);
    current.innerHTML = `<span class="disasm-mnemonic">${cur.mnemonic}</span><span class="disasm-operand">${cur.operand}</span>`;
    current.dataset.mnemonic = cur.mnemonic;

    halted = cpu.state.halted;
    if (halted) {
      next.innerHTML = `<span class="disasm-mnemonic disasm-halted">${t("disasm.halted")}</span>`;
    } else {
      const nextAddr = cpu.state.pc;
      const nextWord = ram.read(nextAddr);
      const n = describe(nextWord);
      next.innerHTML = `<span class="disasm-mnemonic">${n.mnemonic}</span><span class="disasm-operand">${n.operand}</span>`;
      next.dataset.mnemonic = n.mnemonic;
    }
  }

  // Re-render on language switch so the "HALTED" badge updates.
  registerOnChange(() => { if (halted) render(); });

  return { render };
}

// Renders the current and next instructions in mnemonics form, plus a
// unified view of the program in memory.

import { t, registerOnChange } from "./i18n/index.js";
import { disassemble } from "../cpu/opcodes.js";

export function createDisassemblerView(ram, cpu) {
  const current = document.getElementById("disasm-current");
  const next = document.getElementById("disasm-next");
  if (!current || !next) {
    return { render() {} }; // not mounted
  }

  let halted = false;

  function describe(word, mode = "direct") {
    const d = disassemble(word);
    if (d.mnemonic === "DAT" || d.operand === "") return { mnemonic: d.mnemonic, operand: d.operand ? ` ${d.operand}` : "" };
    const prefix = mode === "indirect" ? "@" : "";
    return { mnemonic: d.mnemonic, operand: ` ${prefix}${d.operand}` };
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

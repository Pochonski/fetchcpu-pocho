// Analyze a parsed program to decide how many input slots the UI should
// render and whether any of them live inside a loop (so the "+ Add value"
// button can be shown).
//
// Pure function over `instructions` and `labels` — no DOM, no IO. Lives in
// the UI layer because its only consumer sizes the input panel.

export function countInps(instructions, labels) {
  const branchAddrs = [];
  for (const instr of instructions) {
    if (
      instr.mnemonic === "BRA" ||
      instr.mnemonic === "BRP" ||
      instr.mnemonic === "BRZ"
    ) {
      let target;
      if (instr.operand?.ref != null && labels) {
        target = labels[instr.operand.ref];
      } else {
        target = Number(instr.operand?.value);
      }
      if (Number.isFinite(target)) branchAddrs.push({ addr: instr.address, target });
    }
  }
  const inLoop = new Set();
  for (const { addr, target } of branchAddrs) {
    if (target < addr) {
      for (let i = target; i <= addr; i++) inLoop.add(i);
    }
  }
  let linear = 0;
  let loopHasInp = false;
  for (const instr of instructions) {
    if (instr.mnemonic !== "INP") continue;
    if (inLoop.has(instr.address)) loopHasInp = true;
    else linear += 1;
  }
  if (loopHasInp) return { count: Math.max(1, linear), isLoop: true };
  return { count: Math.max(1, linear), isLoop: false };
}
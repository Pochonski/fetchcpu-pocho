// Tracks runtime metrics: cycle count, instruction counts per opcode, runtime.

export function createStats() {
  let startedAt = null;
  let elapsedMs = 0;
  let runs = 0;
  let instructionsExecuted = 0;

  const counts = Object.create(null);

  function reset() {
    counts.cycles = 0;
    counts.INP = 0;
    counts.OUT = 0;
    counts.LDA = 0;
    counts.STA = 0;
    counts.ADD = 0;
    counts.SUB = 0;
    counts.BRP = 0;
    counts.BRZ = 0;
    counts.BRA = 0;
    counts.HLT = 0;
    counts.taken = 0;
    counts.memoryReads = 0;
    counts.memoryWrites = 0;
    startedAt = null;
    elapsedMs = 0;
    runs = 0;
    instructionsExecuted = 0;
  }
  reset();

  return {
    reset,
    snapshot() {
      return {
        ...counts,
        elapsedMs: startedAt ? elapsedMs + (Date.now() - startedAt) : elapsedMs,
        runs,
        instructionsExecuted,
      };
    },
    startRun() {
      runs += 1;
      startedAt = Date.now();
    },
    stopRun() {
      if (startedAt) {
        elapsedMs += Date.now() - startedAt;
        startedAt = null;
      }
    },
    bump(metric, n = 1) {
      if (counts[metric] == null) counts[metric] = 0;
      counts[metric] += n;
    },
    tickCycle() { counts.cycles = (counts.cycles || 0) + 1; },
    onInstruction(mnemonic) {
      if (mnemonic == null) return;
      instructionsExecuted += 1;
      counts[mnemonic] = (counts[mnemonic] || 0) + 1;
    },
    onBranchTaken() { counts.taken = (counts.taken || 0) + 1; },
    onMemoryRead() { counts.memoryReads = (counts.memoryReads || 0) + 1; },
    onMemoryWrite() { counts.memoryWrites = (counts.memoryWrites || 0) + 1; },
  };
}

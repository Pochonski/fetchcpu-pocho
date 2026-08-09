// Central Processing Unit state.
// Holds PC, ACC, CIR, MAR, MDR plus execution flags.
// Pure state container — no DOM access here.

export function createCPU() {
  const state = {
    pc: 0,
    acc: 0,
    cir: 0,         // holds the raw instruction word at the start of decode
    mar: 0,
    mdr: 0,
    halted: false,
    haltedAt: 0,    // PC where the program halted
    phase: "fetch", // 'fetch' | 'decode' | 'execute'
    cycle: 0,       // increments each FDE cycle completed
    lastChanged: new Set(),
    flag: "P",      // 'Z' | 'N' | 'P' — single active flag derived from acc
  };

  // Derive the active flag from the accumulator. Mirrors the LMC convention
  // where exactly one of {Z, N, P} is asserted at any time. Exposed as a
  // method so callers can also recompute it on the fly without an event.
  function computeFlag() {
    if (state.acc === 0) return "Z";
    return state.acc < 0 ? "N" : "P";
  }

  return {
    state,

    /** Read the currently-active flag derived from acc. */
    getFlag: computeFlag,

    /** Recompute and store the flag in state.acc-aware form. */
    refreshFlag() {
      state.flag = computeFlag();
      return state.flag;
    },

    reset() {
      state.pc = 0;
      state.acc = 0;
      state.cir = 0;
      state.mar = 0;
      state.mdr = 0;
      state.halted = false;
      state.haltedAt = 0;
      state.phase = "fetch";
      state.cycle = 0;
      state.lastChanged.clear();
      state.flag = "P";
    },

    /** Snapshot for step-backward. */
    snapshot() {
      return JSON.parse(JSON.stringify({
        pc: state.pc,
        acc: state.acc,
        cir: state.cir,
        mar: state.mar,
        mdr: state.mdr,
        halted: state.halted,
        haltedAt: state.haltedAt,
        phase: state.phase,
        cycle: state.cycle,
        lastChanged: [...state.lastChanged],
        flag: state.flag,
      }));
    },

    restore(snap) {
      Object.assign(state, snap);
      state.lastChanged = new Set(snap.lastChanged);
    },

    /** Mark a register as changed in the current cycle (for diff display). */
    markChanged(name) {
      state.lastChanged.add(name);
    },

    clearChanged() {
      state.lastChanged.clear();
    },
  };
}

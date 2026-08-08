// LMC Executor - performs the Fetch / Decode / Execute cycle.
//
// Emits events and updates a stats counter along the way. The numeric word
// stored in RAM uses the standard LMC encoding:
//   INP=901, OUT=902, HLT=000, LDA=5xx, STA=3xx, ADD=1xx, SUB=2xx,
//   BRP=8xx, BRZ=7xx, BRA=6xx (xx = memory address 00..99).
//
// Immediate addressing is handled by the LOADER: literals are pre-stored in
// allocated data cells and the instruction is rewritten to reference them.
// Indirect addressing is preserved by a Set of instruction addresses that
// the executor consults during decode.

import { OPCODES } from "./opcodes.js";

export function createExecutor(cpu, ram, io, events = null, stats = null) {
  const history = []; // {cpu, ram, output, inputIndex, mnemonic, phase}
  let running = false;
  let timer = null;
  let indirectAddresses = new Set();

  // Build a localized note describing the most recently executed
  // instruction. The t() function is injected so the executor module
  // does not import i18n directly.
  let tFn = (key) => key;
  function setTranslator(fn) {
    tFn = typeof fn === "function" ? fn : (key, args) => (args ? `${key}(${JSON.stringify(args)})` : key);
  }

  function readOperand(addr, mode) {
    if (mode === "indirect") return ram.read(ram.read(addr));
    return ram.read(addr);
  }

  function buildInstructionNote(decoded, prevAcc) {
    const { mnemonic, operandValue, mode } = decoded;
    const acc = cpu.state.acc;
    const addr = String(operandValue).padStart(2, "0");
    switch (mnemonic) {
      case "INP":
        return tFn("explanation.inp", { value: acc });
      case "OUT":
        return tFn("explanation.out", { value: acc });
      case "LDA": {
        const value = ram.read(operandValue);
        return tFn("explanation.lda", { addr, value });
      }
      case "STA":
        return tFn("explanation.sta", { addr, value: acc });
      case "ADD": {
        const value = readOperand(operandValue, mode);
        return tFn("explanation.add", { addr, acc: prevAcc, value, result: acc });
      }
      case "SUB": {
        const value = readOperand(operandValue, mode);
        return tFn("explanation.sub", { addr, acc: prevAcc, value, result: acc });
      }
      case "BRP":
        return prevAcc >= 0
          ? tFn("explanation.brpTaken", { addr, acc: prevAcc })
          : tFn("explanation.brpSkip", { addr, acc: prevAcc });
      case "BRZ":
        return prevAcc === 0
          ? tFn("explanation.brzTaken", { addr, acc: prevAcc })
          : tFn("explanation.brzSkip", { addr, acc: prevAcc });
      case "BRA":
        return tFn("explanation.bra", { addr });
      case "HLT":
        return tFn("explanation.hlt");
      default:
        return null;
    }
  }

  function snapshot() {
    return {
      cpu: cpu.snapshot(),
      ram: ram.snapshot(),
      output: io.outputValue(),
      inputIndex: io.inputIndex(),
    };
  }

  function restore(snap) {
    cpu.restore(snap.cpu);
    ram.load(arrayToObject(snap.ram));
    io.setOutput(snap.output);
    io.setInputIndex(snap.inputIndex);
  }

  function arrayToObject(arr) {
    const o = {};
    arr.forEach((v, i) => { if (v !== 0) o[i] = v; });
    return o;
  }

  function record(prevPc, decoded) {
    history.push({
      ...snapshot(),
      mnemonic: decoded?.mnemonic ?? null,
      address: prevPc,
    });
  }

  function performFetch() {
    cpu.state.phase = "fetch";
    cpu.clearChanged();
    cpu.state.mar = cpu.state.pc;
    cpu.markChanged("mar");
    cpu.state.mdr = ram.read(cpu.state.mar);
    cpu.markChanged("mdr");
    if (stats) stats.onMemoryRead();
    emitMemoryAccess("in", cpu.state.mar, cpu.state.mdr);
    cpu.state.cir = cpu.state.mdr;
    cpu.markChanged("cir");
    cpu.state.pc += 1;
    cpu.markChanged("pc");
  }

  function performDecode(prevPc) {
    cpu.state.phase = "decode";
    const word = cpu.state.cir;
    const decoded = decodeInstruction(word);

    // For I/O and HLT there is no operand. Keep MAR pointing at the
    // instruction's own address so the highlight stays meaningful instead
    // of resetting to 0.
    if (decoded.mnemonic === "HLT" || decoded.mnemonic === "INP" || decoded.mnemonic === "OUT") {
      cpu.state.mar = prevPc;
      cpu.markChanged("mar");
      return decoded;
    }

    const isIndirect = indirectAddresses.has(prevPc);
    const finalMode = isIndirect ? "indirect" : "direct";
    cpu.state.mar = decoded.operandValue;
    cpu.markChanged("mar");
    return { ...decoded, mode: finalMode };
  }

  function performExecute(decoded) {
    cpu.state.phase = "execute";
    const { mnemonic, operandValue, mode } = decoded;
    const prevAcc = cpu.state.acc;

    switch (mnemonic) {
      case "HLT":
        cpu.state.halted = true;
        cpu.state.haltedAt = cpu.state.pc - 1;
        cpu.state.mar = cpu.state.haltedAt;
        cpu.markChanged("mar");
        break;

      case "INP": {
        const value = io.readInput();
        cpu.state.acc = value;
        cpu.markChanged("acc");
        emitFlag();
        break;
      }

      case "OUT": {
        io.writeOutput(cpu.state.acc);
        // MDR holds the value being output so the LED shows what was sent.
        cpu.state.mdr = cpu.state.acc;
        cpu.markChanged("mdr");
        break;
      }

      case "LDA": {
        let value;
        if (mode === "indirect") {
          const ptr = ram.read(cpu.state.mar);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", cpu.state.mar, ptr);
          // MDR momentarily holds the pointer.
          cpu.state.mdr = ptr;
          cpu.markChanged("mdr");
          cpu.state.mar = ptr;
          cpu.markChanged("mar");
          value = ram.read(ptr);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", ptr, value);
          cpu.state.mdr = value;
          cpu.markChanged("mdr");
        } else {
          value = ram.read(cpu.state.mar);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", cpu.state.mar, value);
          cpu.state.mdr = value;
          cpu.markChanged("mdr");
        }
        cpu.state.acc = value;
        cpu.markChanged("acc");
        emitFlag();
        break;
      }

      case "STA": {
        if (mode === "indirect") {
          const ptr = ram.read(cpu.state.mar);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", cpu.state.mar, ptr);
          cpu.state.mdr = ptr;
          cpu.markChanged("mdr");
          cpu.state.mar = ptr;
          cpu.markChanged("mar");
        }
        // MDR shows the value being written so users can verify what the
        // CPU is sending to RAM.
        cpu.state.mdr = cpu.state.acc;
        cpu.markChanged("mdr");
        ram.write(cpu.state.mar, cpu.state.acc);
        if (stats) stats.onMemoryWrite();
        emitMemoryAccess("out", cpu.state.mar, cpu.state.acc);
        break;
      }

      case "ADD": {
        let value;
        if (mode === "indirect") {
          const ptr = ram.read(cpu.state.mar);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", cpu.state.mar, ptr);
          cpu.state.mdr = ptr;
          cpu.markChanged("mdr");
          cpu.state.mar = ptr;
          cpu.markChanged("mar");
          value = ram.read(ptr);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", ptr, value);
          cpu.state.mdr = value;
          cpu.markChanged("mdr");
        } else {
          value = ram.read(cpu.state.mar);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", cpu.state.mar, value);
          cpu.state.mdr = value;
          cpu.markChanged("mdr");
        }
        cpu.state.acc = cpu.state.acc + value;
        cpu.markChanged("acc");
        emitFlag();
        break;
      }

      case "SUB": {
        let value;
        if (mode === "indirect") {
          const ptr = ram.read(cpu.state.mar);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", cpu.state.mar, ptr);
          cpu.state.mdr = ptr;
          cpu.markChanged("mdr");
          cpu.state.mar = ptr;
          cpu.markChanged("mar");
          value = ram.read(ptr);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", ptr, value);
          cpu.state.mdr = value;
          cpu.markChanged("mdr");
        } else {
          value = ram.read(cpu.state.mar);
          if (stats) stats.onMemoryRead();
          emitMemoryAccess("in", cpu.state.mar, value);
          cpu.state.mdr = value;
          cpu.markChanged("mdr");
        }
        cpu.state.acc = cpu.state.acc - value;
        cpu.markChanged("acc");
        emitFlag();
        break;
      }

      case "BRP":
        if (cpu.state.acc >= 0) {
          branchTo(operandValue);
          if (stats) stats.onBranchTaken();
        }
        break;
      case "BRZ":
        if (cpu.state.acc === 0) {
          branchTo(operandValue);
          if (stats) stats.onBranchTaken();
        }
        break;
      case "BRA":
        branchTo(operandValue);
        if (stats) stats.onBranchTaken();
        break;

      default:
        throw new Error(`Unknown mnemonic ${mnemonic}`);
    }
    if (stats) stats.onInstruction(mnemonic);

    // Build a human-readable note for the just-executed instruction so
    // the UI can show "ADD 6 — ACC = ACC (4) + RAM[6] (3) = 7" type strings.
    decoded._note = buildInstructionNote(decoded, prevAcc);
  }

  function emitFlag() {
    if (!events) return;
    const flag = cpu.state.acc === 0 ? "Z" : cpu.state.acc < 0 ? "N" : "P";
    events.emit("flag", { acc: cpu.state.acc, flag });
  }

  function emitMemoryAccess(direction, address, value) {
    if (!events) return;
    events.emit("memory-access", {
      direction,
      address,
      value,
      phase: cpu.state.phase,
    });
  }

  function branchTo(addr) {
    cpu.state.pc = addr;
    cpu.markChanged("pc");
  }

  function decodeInstruction(word) {
    if (word === 0) return { mnemonic: "HLT", operandValue: 0, mode: "direct" };
    if (word === OPCODES.INP.code) return { mnemonic: "INP", operandValue: 0 };
    if (word === OPCODES.OUT.code) return { mnemonic: "OUT", operandValue: 0 };

    const opcode = Math.floor(word / 100);
    const operand = word % 100;
    switch (opcode) {
      case 5: return { mnemonic: "LDA", operandValue: operand, mode: "direct" };
      case 3: return { mnemonic: "STA", operandValue: operand, mode: "direct" };
      case 1: return { mnemonic: "ADD", operandValue: operand, mode: "direct" };
      case 2: return { mnemonic: "SUB", operandValue: operand, mode: "direct" };
      case 8: return { mnemonic: "BRP", operandValue: operand, mode: "direct" };
      case 7: return { mnemonic: "BRZ", operandValue: operand, mode: "direct" };
      case 6: return { mnemonic: "BRA", operandValue: operand, mode: "direct" };
      default:
        // Not an instruction word. Treat as data (HLT-equivalent).
        return { mnemonic: "HLT", operandValue: 0, mode: "direct" };
    }
  }

  // Cycle-phase tracking for step-by-phase stepping.
  //  0 = no cycle in flight → next click does Fetch
  //  1 = Fetch done          → next click does Decode
  //  2 = Decode done        → next click does Execute (cycle completes)
  let cyclePhase = 0;
  let pendingDecoded = null;

  function setPhaseFromCycle() {
    cyclePhase = 0;
    pendingDecoded = null;
  }

  function emitTick(extra = {}) {
    setTimeout(() => cpu.clearChanged(), 80);
    if (events) {
      const note = pendingDecoded?._note ?? null;
      events.emit("tick", {
        cycle: cpu.state.cycle,
        phase: cpu.state.phase,
        mnemonic: pendingDecoded?.mnemonic ?? null,
        note,
        pc: cpu.state.pc - (cpu.state.phase === "fetch" ? 1 : 0),
        acc: cpu.state.acc,
        ...extra,
      });
      if (cpu.state.halted) events.emit("halt", { pc: cpu.state.haltedAt });
    }
  }

  /** Advance one FULL FDE cycle. */
  function step() {
    if (cpu.state.halted) return false;
    performFetch();
    const prevPc = cpu.state.pc - 1;
    const decoded = performDecode(prevPc);
    record(prevPc, decoded);
    performExecute(decoded);
    cpu.state.cycle += 1;
    if (stats) stats.tickCycle();
    setPhaseFromCycle();
    pendingDecoded = decoded;
    emitTick({ mnemonic: decoded.mnemonic, note: decoded._note ?? null });
    return !cpu.state.halted;
  }

  /**
   * Advance ONE FDE phase at a time. Three consecutive calls complete one
   * instruction cycle: Fetch → Decode → Execute.
   * Each call updates `cpu.state.phase`, which drives the visual FDE
   * indicator in the UI.
   */
  function stepPhase() {
    if (cpu.state.halted) return false;

    if (cyclePhase === 0) {
      // Start a new cycle: Fetch.
      const prevPc = cpu.state.pc;
      performFetch();
      cyclePhase = 1;
      pendingDecoded = null;
      // Record snapshot after Fetch for step-back fidelity.
      record(prevPc, { mnemonic: null });
    } else if (cyclePhase === 1) {
      // Move to Decode.
      const prevPc = cpu.state.pc - 1;
      pendingDecoded = performDecode(prevPc);
      // Replace the previous snapshot with one tagged with the mnemonic so
      // history step-back shows the decoded instruction.
      record(prevPc, pendingDecoded);
      cyclePhase = 2;
    } else {
      // Execute completes the cycle.
      if (pendingDecoded) {
        performExecute(pendingDecoded);
        cpu.state.cycle += 1;
        if (stats) stats.tickCycle();
      }
      cyclePhase = 0;
      pendingDecoded = null;
    }

    setTimeout(() => cpu.clearChanged(), 80);
    if (events) {
      events.emit("tick", {
        cycle: cpu.state.cycle,
        phase: cpu.state.phase,
        mnemonic: pendingDecoded?.mnemonic ?? null,
        pc: cpu.state.pc - (cpu.state.phase === "fetch" ? 1 : 0),
        acc: cpu.state.acc,
      });
      if (cpu.state.halted) events.emit("halt", { pc: cpu.state.haltedAt });
    }

    return !cpu.state.halted;
  }

  /** Return which phase the next stepPhase() will perform. */
  function nextStepPhase() {
    return ["fetch", "decode", "execute"][cyclePhase] ?? "fetch";
  }

  function stepBack() {
    if (history.length === 0) return false;
    const snap = history.pop();
    restore(snap);
    return true;
  }

  function reset() {
    history.length = 0;
    cpu.reset();
    ram.reset();
    io.reset();
    cpu.state.phase = "fetch";
    running = false;
    if (timer != null) { clearTimeout(timer); timer = null; }
    if (stats) stats.reset();
    setPhaseFromCycle();
  }

  function stepBackPhase() {
    // Pop TWO snapshots if mid-cycle, ONE if at a cycle boundary.
    const back = cyclePhase === 0 ? 1 : 2;
    let popped = false;
    for (let i = 0; i < back && history.length > 0; i++) {
      const snap = history.pop();
      restore(snap);
      popped = true;
    }
    if (popped) {
      // Recompute cyclePhase from current cpu.state.phase
      if (cpu.state.phase === "fetch") cyclePhase = 0;
      else if (cpu.state.phase === "decode") cyclePhase = 1;
      else cyclePhase = 2;
    }
    return popped;
  }

  function setIndirectAddresses(set) {
    indirectAddresses = set instanceof Set ? new Set(set) : new Set(set || []);
  }

  function run({ speed, breakpoints = [], onTick, getSpeed: getSpeedArg } = {}) {
    if (running) return;
    running = true;
    setPhaseFromCycle(); // ensure next manual step starts a fresh Fetch
    if (stats) stats.startRun();
    if (events) events.emit("run-start", null);

    const gs = typeof getSpeedArg === "function" ? getSpeedArg : null;
    const fb = Math.max(0, Number(speed) || 500);
    function readSpeed() {
      if (gs) return Math.max(0, Number(gs()) || 0);
      return fb;
    }

    function tick() {
      if (!running) return;
      if (cpu.state.halted) { stop(); return; }
      if (breakpoints.includes(cpu.state.pc)) { stop(); return; }
      let continueRunning;
      try {
        continueRunning = step();
      } catch (e) {
        if (e && e.name === "EndOfInputError") {
          if (events) events.emit("input-exhausted", null);
        } else {
          if (events) events.emit("error", { message: e.message, error: e });
        }
        stop();
        return;
      }
      if (onTick) onTick();
      if (!continueRunning || !running) { stop(); return; }
      timer = setTimeout(tick, readSpeed());
    }

    tick();
  }

  function stop() {
    if (!running) return;
    running = false;
    if (timer != null) { clearTimeout(timer); timer = null; }
    if (stats) stats.stopRun();
    if (events) events.emit("run-stop", null);
  }

  function getCurrentInstruction() {
    const word = cpu.state.cir;
    return decodeInstruction(word);
  }

  function getNextInstruction() {
    const nextPc = cpu.state.pc;
    const word = ram.read(nextPc);
    return decodeInstruction(word);
  }

  return {
    step,
    stepPhase,
    stepBack,
    stepBackPhase,
    nextStepPhase,
    run,
    stop,
    reset,
    isRunning: () => running,
    history: () => history.slice(),
    setIndirectAddresses,
    setTranslator,
    getCurrentInstruction,
    getNextInstruction,
  };
}

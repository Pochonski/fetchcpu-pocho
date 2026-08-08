// FDE logger. Adds entries to the live feed (kept short) and optionally to
// a long-form log file that can be downloaded.

import { t, registerOnChange } from "./i18n/index.js";

export function createLogger(liveFeedEl, logEl) {
  let logFileEnabled = true;
  const lines = [];
  const rawLines = []; // parallel array of un-translated keys + args

  function describePhase(label, cpu) {
    // label is the FDE phase ("fetch"|"decode"|"execute"). Localize it.
    const localLabel = t(`access.phases.${label}`) || label;
    const pc = String(cpu.state.pc - (label === "fetch" ? 1 : 0)).padStart(2, "0");
    const mar = String(cpu.state.mar).padStart(2, "0");
    const mdr = String(cpu.state.mdr).padStart(3, "0");
    const acc = String(cpu.state.acc).padStart(4, "0");
    return t("log.stepDescription",
      cpu.state.cycle, localLabel, pc, mar, mdr,
      String(cpu.state.cir).padStart(3, "0"), acc);
  }

  function pushToLog(line) {
    if (!logFileEnabled) return;
    logEl.textContent = logEl.textContent ? logEl.textContent + "\n" + line : line;
  }

  function push(line, klass) {
    lines.push(line);
    const div = document.createElement("div");
    div.className = `log-entry ${klass || ""}`.trim();
    div.textContent = line;
    liveFeedEl.prepend(div);
    while (liveFeedEl.children.length > 80) liveFeedEl.lastChild.remove();
  }

  function onCycle(cpu, info = {}) {
    const { phase, mnemonic, note } = info;
    const line = describePhase(phase, cpu) + (mnemonic ? `  [${mnemonic}${note ? " " + note : ""}]` : "");
    push(line, `log-entry-${phase}`);
    rawLines.push({ kind: "cycle", cpu, info });
  }

  function onProgramLoaded(cycle) {
    const msg = t("log.loaded", [cycle]);
    push(msg, "");
    pushToLog(msg);
    rawLines.push({ kind: "loaded", count: cycle });
  }

  function onProgramHalted(cpu) {
    const msg = t("log.halted", [String(cpu.state.haltedAt).padStart(2, "0")]);
    push(msg, "log-entry-halt");
    pushToLog(msg);
    rawLines.push({ kind: "halted", haltedAt: cpu.state.haltedAt });
  }

  function onInputExhausted() {
    const msg = t("log.inputExhausted");
    push(msg, "log-entry-error");
    pushToLog(msg);
    rawLines.push({ kind: "inputExhausted" });
  }

  function onError(message) {
    const msg = t("log.errorPrefix", [message]);
    push(msg, "log-entry-error");
    pushToLog(msg);
    rawLines.push({ kind: "error", message });
  }

  function clear() {
    lines.length = 0;
    rawLines.length = 0;
    liveFeedEl.innerHTML = "";
    logEl.textContent = "";
  }

  function rerenderAll() {
    // Replay the raw events to rebuild log with the current language.
    lines.length = 0;
    liveFeedEl.innerHTML = "";
    logEl.textContent = "";
    const savedLogFile = logFileEnabled;
    logFileEnabled = false;
    // Snapshot the array so callbacks that re-push to rawLines don't extend
    // the iteration (which would otherwise loop forever).
    const snapshot = rawLines.slice();
    for (const r of snapshot) {
      if (r.kind === "cycle") onCycle(r.cpu, r.info);
      else if (r.kind === "loaded") onProgramLoaded(r.count);
      else if (r.kind === "halted") onProgramHalted({ state: { haltedAt: r.haltedAt } });
      else if (r.kind === "inputExhausted") onInputExhausted();
      else if (r.kind === "error") onError(r.message);
    }
    logFileEnabled = savedLogFile;
  }

  function setLogFile(on) { logFileEnabled = !!on; }
  function isLogFileEnabled() { return logFileEnabled; }
  function download() {
    const text = lines.join("\n") + "\n";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fetchcpu-log-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  registerOnChange(() => rerenderAll());

  return {
    onCycle, onProgramLoaded, onProgramHalted, onInputExhausted, onError,
    clear, setLogFile, isLogFileEnabled, download,
  };
}

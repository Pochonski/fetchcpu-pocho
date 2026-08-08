// FDE logger. Adds entries to the live feed (kept short) and optionally to
// a long-form log file that can be downloaded.
//
// The on-screen live feed uses a structured HTML format with badges,
// change highlights and flag indicators so users can scan each cycle at a
// glance. The downloaded log file keeps a compact plain-text format.

import { t, registerOnChange } from "./i18n/index.js";

const MAX_FEED_ENTRIES = 80;

export function createLogger(liveFeedEl, logEl) {
  let logFileEnabled = true;
  const lines = [];
  const rawLines = []; // parallel array of un-translated events

  // Per-register last-known values, used to compute diffs ("ACC 0→3") and
  // to decide which fields to show. Reset on program load.
  let prev = { pc: 0, acc: 0, cir: 0, mar: 0, mdr: 0 };
  let startedAt = null;

  // ----- Plain-text line construction (for the downloadable log file) -----

  function describePhaseText(label, cpu) {
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

  // ----- Rich HTML entry construction (for the on-screen live feed) -----

  // Compact flag indicator — a coloured dot or hollow ring per flag.
  function flagBadge(letter) {
    const active = cpuFlag() === letter;
    const cls = `lf-flag lf-flag-${letter}${active ? " lf-flag-on" : ""}`;
    const title = { Z: "Zero", N: "Negative", P: "Positive" }[letter];
    return `<span class="${cls}" title="${title}" aria-label="${title}${active ? " (active)" : ""}">${letter}</span>`;
  }

  // The currently-active flag, derived from ACC. Mirrors cpu.js / executor.js.
  function cpuFlag() {
    return lastAcc === 0 ? "Z" : lastAcc < 0 ? "N" : "P";
  }
  let lastAcc = 0;

  // Format a register change as "PC 0→3" or just "PC 3" when the previous
  // value is unknown (very first cycle).
  function regDiff(name, value, width = 0) {
    const formatted = width > 0
      ? String(value).padStart(width, "0")
      : String(value);
    // Storage keys are lowercase so they match the prev object literal.
    const key = name.toLowerCase();
    const previous = prev[key];
    prev[key] = value;
    if (previous === undefined) {
      return `<span class="lf-reg">${name}: <b>${formatted}</b></span>`;
    }
    if (previous === value) {
      return `<span class="lf-reg lf-reg-unchanged">${name}: ${formatted}</span>`;
    }
    return `<span class="lf-reg lf-reg-changed">${name}: <s>${previous}</s> <b>${formatted}</b></span>`;
  }

  function timeMs() {
    if (startedAt == null) return "";
    return ((performance.now() - startedAt) / 1000).toFixed(2);
  }

  function buildCycleEntry(cpu, info) {
    const { phase, mnemonic, note } = info;
    lastAcc = cpu.state.acc;

    // Compute mnemonic colour class
    const mnemClass = mnemonicClass(mnemonic);

    // Build the diff line. Show only registers that changed (or all on the
    // first cycle to establish context).
    const isFirstCycle = info.cycle === 0 || info.cycle === 1;
    const diffs = [];
    const addAll = () => {
      diffs.push(regDiff("PC", cpu.state.pc - (phase === "fetch" ? 1 : 0), 2));
      diffs.push(regDiff("MAR", cpu.state.mar, 2));
      diffs.push(regDiff("MDR", cpu.state.mdr, 3));
      diffs.push(regDiff("CIR", cpu.state.cir, 3));
      diffs.push(regDiff("ACC", cpu.state.acc, 4));
    };

    if (isFirstCycle) {
      addAll();
    } else {
      // Use cpu.state.lastChanged when present so the live feed matches
      // exactly what changed in this cycle.
      const changed = cpu.state.lastChanged;
      if (changed && changed.size > 0) {
        if (changed.has("pc"))   diffs.push(regDiff("PC", cpu.state.pc - (phase === "fetch" ? 1 : 0), 2));
        if (changed.has("mar"))  diffs.push(regDiff("MAR", cpu.state.mar, 2));
        if (changed.has("mdr"))  diffs.push(regDiff("MDR", cpu.state.mdr, 3));
        if (changed.has("cir"))  diffs.push(regDiff("CIR", cpu.state.cir, 3));
        if (changed.has("acc"))  diffs.push(regDiff("ACC", cpu.state.acc, 4));
      } else {
        // No tracked changes (defensive fallback) — show full state.
        addAll();
      }
    }

    const flags = ["Z", "N", "P"].map(flagBadge).join("");
    const tStr = timeMs();
    const tHtml = tStr ? `<span class="lf-time">${tStr}s</span>` : "";

    // Convert the localizable note (e.g. "INP 901 — Read 3 from stdin → ACC")
    // into a plain-text title for the row.
    const title = describePhaseText(phase, cpu) + (mnemonic ? `  [${mnemonic}${note ? " " + note : ""}]` : "");

    return (
      `<div class="log-entry log-entry-${phase}" title="${escapeAttr(title)}">` +
        `<span class="lf-cycle">#${String(info.cycle).padStart(4, "0")}</span>` +
        `<span class="lf-phase lf-phase-${phase}" aria-label="${t(`access.phases.${phase}`)}">${phase[0].toUpperCase()}</span>` +
        `<span class="lf-mnem ${mnemClass}">${mnemonic || "—"}</span>` +
        `<span class="lf-diffs">${diffs.join(" ")}</span>` +
        `<span class="lf-flags">${flags}</span>` +
        tHtml +
        (note ? `<span class="lf-note">${escapeHtml(note)}</span>` : "") +
      `</div>`
    );
  }

  function mnemonicClass(m) {
    if (!m) return "";
    switch (m) {
      case "INP":
      case "OUT": return "lf-mnem-io";
      case "HLT": return "lf-mnem-hlt";
      case "BRP":
      case "BRZ":
      case "BRA": return "lf-mnem-branch";
      case "DAT": return "lf-mnem-dat";
      default: return "lf-mnem-code";
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  // ----- Push helpers -----

  function pushText(line, klass) {
    // Plain-text path used by lifecycle events (loaded, halted, error,
    // input exhausted). Falls back to div.textContent so search/select
    // works.
    lines.push(line);
    const div = document.createElement("div");
    div.className = `log-entry ${klass || ""}`.trim();
    div.textContent = line;
    liveFeedEl.prepend(div);
    while (liveFeedEl.children.length > MAX_FEED_ENTRIES) liveFeedEl.lastChild.remove();
  }

  function onCycle(cpu, info = {}) {
    const { phase, mnemonic, note } = info;
    const textLine = describePhaseText(phase, cpu) + (mnemonic ? `  [${mnemonic}${note ? " " + note : ""}]` : "");
    lines.push(textLine);
    pushToLog(textLine);
    rawLines.push({ kind: "cycle", cpu, info });

    const html = buildCycleEntry(cpu, info);
    const wrap = document.createElement("div");
    wrap.className = `log-entry-wrap log-entry-${phase}`;
    wrap.innerHTML = html;
    liveFeedEl.prepend(wrap);
    while (liveFeedEl.children.length > MAX_FEED_ENTRIES) liveFeedEl.lastChild.remove();
  }

  function onProgramLoaded(cycle) {
    // Reset per-cycle tracking so the first cycle of a fresh load shows
    // every register (no spurious "diff from the previous run").
    prev = { pc: 0, acc: 0, cir: 0, mar: 0, mdr: 0 };
    lastAcc = 0;
    startedAt = performance.now();

    const msg = t("log.loaded", [cycle]);
    pushText(msg, "");
    pushToLog(msg);
    rawLines.push({ kind: "loaded", count: cycle });
  }

  function onProgramHalted(cpu) {
    const msg = t("log.halted", [String(cpu.state.haltedAt).padStart(2, "0")]);
    pushText(msg, "log-entry-halt");
    pushToLog(msg);
    rawLines.push({ kind: "halted", haltedAt: cpu.state.haltedAt });
  }

  function onInputExhausted() {
    const msg = t("log.inputExhausted");
    pushText(msg, "log-entry-error");
    pushToLog(msg);
    rawLines.push({ kind: "inputExhausted" });
  }

  function onError(message) {
    const msg = t("log.errorPrefix", [message]);
    pushText(msg, "log-entry-error");
    pushToLog(msg);
    rawLines.push({ kind: "error", message });
  }

  function clear() {
    lines.length = 0;
    rawLines.length = 0;
    liveFeedEl.innerHTML = "";
    logEl.textContent = "";
    prev = { pc: 0, acc: 0, cir: 0, mar: 0, mdr: 0 };
    lastAcc = 0;
    startedAt = null;
  }

  function rerenderAll() {
    lines.length = 0;
    liveFeedEl.innerHTML = "";
    logEl.textContent = "";
    const savedLogFile = logFileEnabled;
    logFileEnabled = false;
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
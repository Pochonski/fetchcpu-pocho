// CPU panel: registers + flags + FDE indicator + memory access log.

import { t, registerOnChange } from "./i18n/index.js";

export function createCPUView(cpu, events) {
  const refs = {
    pc: document.getElementById("pc"),
    cir: document.getElementById("cir"),
    mar: document.getElementById("mar"),
    mdr: document.getElementById("mdr"),
    acc: document.getElementById("acc"),
    flagZ: document.getElementById("flag-z"),
    flagN: document.getElementById("flag-n"),
    flagP: document.getElementById("flag-p"),
    busToMemory: document.getElementById("bus-memory-out"),
    busFromMemory: document.getElementById("bus-memory-in"),
    phaseFetch:   document.querySelector('[data-phase="fetch"]'),
    phaseDecode:  document.querySelector('[data-phase="decode"]'),
    phaseExecute: document.querySelector('[data-phase="execute"]'),
    accessTag:     document.getElementById("access-tag"),
    accessAddr:    document.getElementById("access-addr"),
    accessValue:   document.getElementById("access-value"),
    accessPhase:   document.getElementById("access-phase"),
    accessLabelEl: document.querySelector(".access-log"),
  };

  const diffs = {
    pc: document.getElementById("pc-diff"),
    cir: document.getElementById("cir-diff"),
    mar: document.getElementById("mar-diff"),
    mdr: document.getElementById("mdr-diff"),
    acc: document.getElementById("acc-diff"),
  };

  const prev = {};
  let lastAccess = null;

  if (events) {
    events.on("flag", ({ flag }) => updateFlags(flag));
    events.on("memory-access", (info) => {
      flashBus(info.direction);
      updateAccessLog(info);
    });
  }

  function updateFlags(flag) {
    if (refs.flagZ) refs.flagZ.dataset.active = flag === "Z" ? "true" : "false";
    if (refs.flagN) refs.flagN.dataset.active = flag === "N" ? "true" : "false";
    if (refs.flagP) refs.flagP.dataset.active = flag === "P" ? "true" : "false";
  }

  function flashBus(direction) {
    const el = direction === "out" ? refs.busToMemory : refs.busFromMemory;
    if (!el) return;
    el.dataset.active = "true";
    setTimeout(() => { el.dataset.active = "false"; }, 140);
  }

  function updateAccessLog({ direction, address, value, phase }) {
    if (!refs.accessTag) return;
    lastAccess = { direction, address, value, phase };
    refs.accessTag.dataset.direction = direction;
    refs.accessTag.textContent = direction === "in"
      ? t("access.read")
      : direction === "out" ? t("access.write") : t("access.none");
    if (refs.accessAddr) refs.accessAddr.textContent = String(address).padStart(2, "0");
    if (refs.accessValue) refs.accessValue.textContent = formatValue(value);
    if (refs.accessPhase) refs.accessPhase.textContent = t(`access.phases.${phase}`) || phase;
    if (refs.accessLabelEl) {
      refs.accessLabelEl.dataset.direction = direction;
      refs.accessLabelEl.dataset.flash = "true";
      setTimeout(() => { refs.accessLabelEl.dataset.flash = "false"; }, 200);
    }
  }

  function formatValue(value) {
    if (value == null) return "---";
    if (value < 0) return `-${String(-value).padStart(3, "0")}`;
    return String(value).padStart(3, "0");
  }

  function resetAccessLog() {
    if (!refs.accessTag) return;
    lastAccess = null;
    refs.accessTag.dataset.direction = "none";
    refs.accessTag.textContent = t("access.none");
    if (refs.accessAddr) refs.accessAddr.textContent = "--";
    if (refs.accessValue) refs.accessValue.textContent = "---";
    if (refs.accessPhase) refs.accessPhase.textContent = t("access.phases.idle");
  }

  function render() {
    refs.pc.value = pad2(cpu.state.pc);
    refs.mar.value = pad2(cpu.state.mar);
    refs.mdr.value = pad3(cpu.state.mdr);
    refs.cir.value = pad3(cpu.state.cir);
    refs.acc.value = pad4(cpu.state.acc);

    setDiff("pc", cpu.state.pc);
    setDiff("cir", cpu.state.cir);
    setDiff("mar", cpu.state.mar);
    setDiff("mdr", cpu.state.mdr);
    setDiff("acc", cpu.state.acc);

    refs.phaseFetch.dataset.active = cpu.state.phase === "fetch" ? "true" : "false";
    refs.phaseDecode.dataset.active = cpu.state.phase === "decode" ? "true" : "false";
    refs.phaseExecute.dataset.active = cpu.state.phase === "execute" ? "true" : "false";

    const flag = cpu.state.acc === 0 ? "Z" : cpu.state.acc < 0 ? "N" : "P";
    updateFlags(flag);
  }

  function setDiff(name, value) {
    if (!diffs[name]) return;
    const key = `prev-${name}`;
    if (prev[key] !== undefined && prev[key] !== value && cpu.state.lastChanged.has(name)) {
      diffs[name].textContent = `← ${prev[key]}`;
      diffs[name].dataset.changed = "true";
      setTimeout(() => { diffs[name].dataset.changed = "false"; }, 320);
    } else if (!cpu.state.lastChanged.has(name)) {
      diffs[name].textContent = "";
    }
    prev[key] = value;
  }

  // Refresh on language change.
  registerOnChange(() => {
    if (lastAccess && refs.accessTag) {
      refs.accessTag.textContent = lastAccess.direction === "in"
        ? t("access.read")
        : lastAccess.direction === "out" ? t("access.write") : t("access.none");
    }
    if (refs.accessPhase && !lastAccess) {
      refs.accessPhase.textContent = t("access.phases.idle");
    }
    render();
  });

  return { render, resetAccessLog };
}

function pad2(v) { return String(v).padStart(2, "0"); }
function pad3(v) { return String(v).padStart(3, "0"); }
function pad4(v) { return String(v).padStart(4, "0"); }

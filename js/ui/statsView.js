// Renders aggregate runtime metrics. Designed to live inside a tab panel.

import { t, registerOnChange } from "./i18n/index.js";

export function createStatsView(stats) {
  const grid = document.getElementById("stats-grid");
  if (!grid) return { render() {}, refresh() {} };

  function render() {
    const s = stats.snapshot();
    grid.innerHTML = "";
    const items = [
      { label: t("stats.cycles"),        value: s.cycles || 0 },
      { label: t("stats.instructions"),  value: s.instructionsExecuted || 0 },
      { label: t("stats.branches"),      value: s.taken || 0, accent: "warning" },
      { label: t("stats.reads"),         value: s.memoryReads || 0 },
      { label: t("stats.writes"),        value: s.memoryWrites || 0 },
      { label: t("stats.runtime"),       value: `${(s.elapsedMs / 1000).toFixed(2)} s` },
    ];
    const opcodes = ["LDA", "STA", "ADD", "SUB", "INP", "OUT", "BRP", "BRZ", "BRA", "HLT"];
    for (const op of opcodes) {
      if ((s[op] || 0) > 0) {
        items.push({ label: t(`stats.opcodes.${op}`), value: s[op] });
      }
    }
    for (const it of items) {
      const div = document.createElement("div");
      div.className = "stat-item";
      if (it.accent) div.dataset.accent = it.accent;
      div.innerHTML = `<span class="stat-label">${it.label}</span><span class="stat-value">${it.value}</span>`;
      grid.appendChild(div);
    }
  }

  registerOnChange(() => render());

  return { render, refresh: () => render() };
}

// History view: shows the execution history with mnemonic + PC + ACC.
// Renders into the "History" tab panel.

import { t, registerOnChange } from "./i18n/index.js";

export function createHistoryView(executor) {
  const list = document.getElementById("history-list");
  const counter = document.getElementById("tab-history-count");
  if (!list) return { render() {} };

  function fmtHex(n, w) { return String(n).padStart(w, "0"); }

  function render() {
    const hist = executor.history();
    if (counter) counter.textContent = String(hist.length);
    list.innerHTML = "";
    const start = Math.max(0, hist.length - 50);
    const clickHint = t("history.clickToView");
    const cycleLabel = t("history.cycle");
    for (let i = start; i < hist.length; i++) {
      const row = document.createElement("div");
      row.className = "history-row";
      row.dataset.idx = i;
      const entry = hist[i];
      row.innerHTML = `
        <span class="history-idx">#${String(i + 1).padStart(4, "0")}</span>
        <span class="history-mnemonic">${entry.mnemonic || "—"}</span>
        <span class="history-meta">${cycleLabel} ${entry.cpu.cycle}</span>
        <span class="history-meta">PC ${fmtHex(entry.address ?? 0, 2)}</span>
        <span class="history-meta">ACC ${fmtHex(entry.cpu.acc, 3)}</span>
      `;
      row.title = clickHint;
      row.addEventListener("click", () => {
        while (executor.history().length > i + 1) executor.stepBack();
      });
      list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
  }

  // Re-render so localised labels (cycle / "Click to view") refresh.
  registerOnChange(() => render());

  return { render };
}

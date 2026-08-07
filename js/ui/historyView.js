// History view: shows the execution history with mnemonic + PC + ACC.
// Renders into the "History" tab panel.

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
    for (let i = start; i < hist.length; i++) {
      const row = document.createElement("div");
      row.className = "history-row";
      row.dataset.idx = i;
      const entry = hist[i];
      row.innerHTML = `
        <span class="history-idx">#${String(i + 1).padStart(4, "0")}</span>
        <span class="history-mnemonic">${entry.mnemonic || "—"}</span>
        <span class="history-meta">cycle ${entry.cpu.cycle}</span>
        <span class="history-meta">PC ${fmtHex(entry.address ?? 0, 2)}</span>
        <span class="history-meta">ACC ${fmtHex(entry.cpu.acc, 3)}</span>
      `;
      row.title = "Click to view";
      row.addEventListener("click", () => {
        while (executor.history().length > i + 1) executor.stepBack();
      });
      list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
  }

  return { render };
}

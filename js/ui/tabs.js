// Minimal accessible tab controller.

export function createTabs(rootEl = document) {
  const tabs = Array.from(rootEl.querySelectorAll('[role="tab"]'));
  const panels = tabs.map((t) => rootEl.querySelector(`#${t.getAttribute("aria-controls")}`));

  function activate(idx) {
    tabs.forEach((tab, i) => {
      const selected = i === idx;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      if (panels[i]) panels[i].hidden = !selected;
    });
    const ev = new CustomEvent("tab:activate", { detail: { index: idx, id: tabs[idx].id } });
    rootEl.dispatchEvent(ev);
  }

  tabs.forEach((tab, idx) => {
    tab.addEventListener("click", () => activate(idx));
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (idx + 1) % tabs.length;
        tabs[next].focus();
        activate(next);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (idx - 1 + tabs.length) % tabs.length;
        tabs[prev].focus();
        activate(prev);
      }
    });
  });

  // First non-selected selects the default.
  const initialIdx = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
  activate(initialIdx >= 0 ? initialIdx : 0);

  return { activate, tabs };
}

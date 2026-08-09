// Mobile menu: bottom-sheet style toggle for the three text-only header
// actions (Tutorial / Instruction Set / About) on phones and small
// tablets. The CSS keeps the menu hidden on viewports ≥ 640 px; this module
// only wires up the open/close interaction and translates the items.

import { translateDom } from "./i18n/index.js";

const SELECTOR = {
  toggle: "#menu-toggle",
  menu: "#mobile-menu",
  items: "#mobile-tutorial, #mobile-help, #mobile-about",
};

function close(menu, toggle) {
  menu.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function open(menu, toggle) {
  menu.hidden = false;
  if (toggle) toggle.setAttribute("aria-expanded", "true");
}

export function initMobileMenu() {
  const toggle = document.querySelector(SELECTOR.toggle);
  const menu = document.querySelector(SELECTOR.menu);
  if (!toggle || !menu) return { refresh: () => {}, close: () => {}, isOpen: () => false, destroy: () => {} };

  // Each mobile-menu item delegates to the corresponding header button so
  // the existing handlers (Tutorial / Help / About) keep working untouched.
  const map = {
    "mobile-tutorial": "tutorial-btn",
    "mobile-help": "help-link",
    "mobile-about": "about-link",
  };

  const itemHandlers = [];
  menu.querySelectorAll(SELECTOR.items).forEach((item) => {
    const handler = () => {
      const targetId = map[item.id];
      const target = targetId ? document.getElementById(targetId) : null;
      close(menu, toggle);
      if (target) target.click();
    };
    item.addEventListener("click", handler);
    itemHandlers.push([item, handler]);
  });

  const toggleHandler = (e) => {
    e.stopPropagation();
    if (menu.hidden) open(menu, toggle);
    else close(menu, toggle);
  };
  toggle.addEventListener("click", toggleHandler);

  // Close when tapping outside the sheet.
  const docClickHandler = (e) => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || toggle.contains(e.target)) return;
    close(menu, toggle);
  };
  document.addEventListener("click", docClickHandler);

  // Close on Escape, matching the rest of the app.
  const docKeyHandler = (e) => {
    if (e.key === "Escape" && !menu.hidden) close(menu, toggle);
  };
  document.addEventListener("keydown", docKeyHandler);

  function destroy() {
    for (const [el, h] of itemHandlers) el.removeEventListener("click", h);
    toggle.removeEventListener("click", toggleHandler);
    document.removeEventListener("click", docClickHandler);
    document.removeEventListener("keydown", docKeyHandler);
  }

  return {
    refresh() {
      // Re-apply translations when the language changes so the bottom sheet
      // labels stay in sync with the rest of the UI.
      if (!menu.hidden) translateDom(menu);
    },
    close() { close(menu, toggle); },
    isOpen() { return !menu.hidden; },
    destroy,
  };
}
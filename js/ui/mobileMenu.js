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
  if (!toggle || !menu) return { refresh: () => {} };

  // Each mobile-menu item delegates to the corresponding header button so
  // the existing handlers (Tutorial / Help / About) keep working untouched.
  const map = {
    "mobile-tutorial": "tutorial-btn",
    "mobile-help": "help-link",
    "mobile-about": "about-link",
  };

  menu.querySelectorAll(SELECTOR.items).forEach((item) => {
    item.addEventListener("click", () => {
      const targetId = map[item.id];
      const target = targetId ? document.getElementById(targetId) : null;
      close(menu, toggle);
      if (target) target.click();
    });
  });

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) open(menu, toggle);
    else close(menu, toggle);
  });

  // Close when tapping outside the sheet.
  document.addEventListener("click", (e) => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || toggle.contains(e.target)) return;
    close(menu, toggle);
  });

  // Close on Escape, matching the rest of the app.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) close(menu, toggle);
  });

  return {
    refresh() {
      // Re-apply translations when the language changes so the bottom sheet
      // labels stay in sync with the rest of the UI.
      if (!menu.hidden) translateDom(menu);
    },
    close() { close(menu, toggle); },
    isOpen() { return !menu.hidden; },
  };
}
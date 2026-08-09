// Theme manager.
// Default resolution order: explicit localStorage override → system
// `prefers-color-scheme` → "dark". The toggle persists the choice in
// localStorage so it survives reloads.

import { t, registerOnChange } from "./i18n/index.js";

const KEY = "fetchcpu-theme";

function systemPreference() {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function initTheme(toggleEl) {
  const stored = localStorage.getItem(KEY);
  let current = stored || systemPreference();
  document.documentElement.dataset.theme = current;
  if (toggleEl) {
    paintToggle(toggleEl, current);
    toggleEl.addEventListener("click", () => {
      current = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = current;
      localStorage.setItem(KEY, current);
      paintToggle(toggleEl, current);
    });
  }
  registerOnChange(() => {
    if (toggleEl) paintToggle(toggleEl, current);
  });
  return () => current;
}

function paintToggle(el, mode) {
  const icon = el.querySelector(".icon");
  if (!icon) return;
  // Sun (light mode offer) / Moon (dark mode offer).
  icon.innerHTML = mode === "dark"
    // Sun: 12 rays + central circle.
    ? '<circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="7" y2="7"/><line x1="17" y1="17" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="7" y2="17"/><line x1="17" y1="7" x2="19.1" y2="4.9"/></g>'
    // Moon (crescent).
    : '<path d="M21 13a9 9 0 0 1-10-10 1 1 0 0 0-1.3-1.3 10 10 0 1 0 12.6 12.6A1 1 0 0 0 21 13z" fill="currentColor"/>';
  el.setAttribute("title", mode === "dark" ? t("app.themeToLight") : t("app.themeToDark"));
  el.setAttribute("aria-label", mode === "dark" ? t("app.themeToLight") : t("app.themeToDark"));
}

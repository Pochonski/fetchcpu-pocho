// Theme manager.
// `dark` is the default; the toggle persists the choice in localStorage.

import { t, registerOnChange } from "./i18n/index.js";

const KEY = "fetchcpu-theme";

export function initTheme(toggleEl) {
  let current = localStorage.getItem(KEY) || "dark";
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
  const icon = el.querySelector("span");
  if (!icon) return;
  icon.textContent = mode === "dark" ? "☀" : "☾";
  el.setAttribute("title", mode === "dark" ? t("app.themeToLight") : t("app.themeToDark"));
  el.setAttribute("aria-label", mode === "dark" ? t("app.themeToLight") : t("app.themeToDark"));
}

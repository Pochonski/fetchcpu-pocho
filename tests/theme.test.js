// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { initTheme } from "../js/ui/theme.js";

describe("theme.js — initTheme", () => {
  beforeEach(() => {
    if (!globalThis.localStorage) {
      const store = new Map();
      Object.defineProperty(globalThis, "localStorage", {
        value: {
          getItem: (k) => store.get(k) ?? null,
          setItem: (k, v) => store.set(k, v),
          removeItem: (k) => store.delete(k),
          clear: () => store.clear(),
        },
        configurable: true,
      });
    }
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to dark when no localStorage entry is present", () => {
    const toggle = document.createElement("button");
    const icon = document.createElement("span");
    icon.className = "icon";
    toggle.appendChild(icon);
    initTheme(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("respects a saved theme from localStorage", () => {
    localStorage.setItem("fetchcpu-theme", "light");
    const toggle = document.createElement("button");
    const icon = document.createElement("span");
    icon.className = "icon";
    toggle.appendChild(icon);
    initTheme(toggle);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("click on toggle flips data-theme and persists the choice", () => {
    const toggle = document.createElement("button");
    const icon = document.createElement("span");
    icon.className = "icon";
    toggle.appendChild(icon);
    initTheme(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
    toggle.click();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("fetchcpu-theme")).toBe("light");
    toggle.click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("fetchcpu-theme")).toBe("dark");
  });
});
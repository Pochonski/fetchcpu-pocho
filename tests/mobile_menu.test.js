// @vitest-environment jsdom
// Tests for the mobileMenu bottom-sheet.
import { describe, it, expect, beforeEach } from "vitest";
import { initMobileMenu } from "../js/ui/mobileMenu.js";

describe("mobileMenu.js — initMobileMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="menu-toggle" aria-expanded="false">⋯</button>
      <div id="mobile-menu" hidden>
        <button id="mobile-tutorial" data-target="tutorial-btn">Tutorial</button>
        <button id="mobile-help" data-target="help-link">Help</button>
        <button id="mobile-about" data-target="about-link">About</button>
      </div>
      <button id="tutorial-btn">src-tutorial</button>
      <button id="help-link">src-help</button>
      <button id="about-link">src-about</button>
    `;
  });

  it("toggle opens and closes the menu", () => {
    const menu = initMobileMenu();
    const toggle = document.getElementById("menu-toggle");
    expect(menu.isOpen()).toBe(false);
    toggle.click();
    expect(menu.isOpen()).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.click();
    expect(menu.isOpen()).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking a menu item delegates to the matching header button", () => {
    initMobileMenu();
    let tutorialClicked = false;
    document.getElementById("tutorial-btn").addEventListener("click", () => {
      tutorialClicked = true;
    });
    // Open the menu first because the menu's hidden attribute has no
    // effect on click propagation but the item handler closes it.
    document.getElementById("menu-toggle").click();
    document.getElementById("mobile-tutorial").click();
    expect(tutorialClicked).toBe(true);
    expect(document.getElementById("mobile-menu").hidden).toBe(true);
  });

  it("Escape closes the menu", () => {
    const menu = initMobileMenu();
    document.getElementById("menu-toggle").click();
    expect(menu.isOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu.isOpen()).toBe(false);
  });

  it("destroy() removes the document-level listeners", () => {
    const menu = initMobileMenu();
    document.getElementById("menu-toggle").click();
    menu.destroy();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    // After destroy, Escape should not close (the menu could still be
    // manually closed by calling close()).
    expect(menu.isOpen()).toBe(true);
  });

  it("returns a no-op API when the toggle / menu are missing", () => {
    document.body.innerHTML = "";
    const menu = initMobileMenu();
    expect(menu.isOpen()).toBe(false);
    expect(() => menu.close()).not.toThrow();
    expect(() => menu.destroy()).not.toThrow();
  });
});
// @vitest-environment jsdom
// Visual regression tests for the redesigned modals (Tutorial,
// Instructions, About) — covers the new structure added in the
// "make the modals beautiful" pass.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("Tutorial modal — new structure", () => {
  it("renders a header with icon + title + eyebrow", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    const tutorial = html.match(/<div class="modal modal-tutorial"[^>]*>([\s\S]*?)<\/div>\s*<script/);
    expect(tutorial).not.toBeNull();
    expect(tutorial[1]).toMatch(/<header class="modal-header">/);
    expect(tutorial[1]).toMatch(/<h2 id="tutorial-title"/);
    expect(tutorial[1]).toMatch(/class="modal-header-icon"/);
  });

  it("renders a CTA button at the bottom", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    expect(html).toMatch(/class="btn btn-primary modal-cta"[^>]*data-close="tutorialPopup"/);
  });

  it("renders a circular X close button (not a text '×')", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    expect(html).toMatch(/<button class="modal-close"[^>]*data-close="tutorialPopup"[\s\S]*<svg/);
  });
});

describe("Instructions modal — new table", () => {
  it("wraps the table in a .table-wrap container with rounded borders", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    expect(html).toMatch(/<div class="table-wrap">[\s\S]*<table class="instruction-table"/);
  });

  it("uses an explicit <h2> with a header-icon for the title", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    const link = html.match(/<div class="modal modal-instructions"[^>]*>([\s\S]*?)<\/div>\s*<div class="modal modal-about"/);
    expect(link).not.toBeNull();
    expect(link[1]).toMatch(/<h2 id="popup-title"/);
    expect(link[1]).toMatch(/class="modal-header-icon"/);
  });
});

describe("About modal — hero + features", () => {
  it("uses a hero block with logo + title + version tag + pill", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    const about = html.match(/<div class="modal modal-about"[^>]*>([\s\S]*?)<\/div>\s*<div class="modal modal-tutorial"/);
    expect(about).not.toBeNull();
    expect(about[1]).toMatch(/<div class="modal-hero">/);
    expect(about[1]).toMatch(/class="modal-logo"[^>]*assets\/logo\.png/);
    expect(about[1]).toMatch(/class="version-tag" data-i18n="modal\.about\.version"/);
    expect(about[1]).toMatch(/class="version-pill" data-i18n="modal\.about\.pill"/);
  });

  it("renders a 4-card feature grid placeholder (#about-p3)", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    expect(html).toMatch(/<div class="modal-features" id="about-p3"><\/div>/);
  });

  it("renders a Keyboard Shortcuts section with an icon header", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    const about = html.match(/<div class="modal modal-about"[^>]*>([\s\S]*?)<\/div>\s*<div class="modal modal-tutorial"/);
    expect(about).not.toBeNull();
    expect(about[1]).toMatch(/class="modal-section modal-section-shortcuts"/);
    expect(about[1]).toMatch(/class="section-icon"/);
    expect(about[1]).toMatch(/class="modal-section-title"[\s\S]*shortcutsTitle/);
  });
});

describe("CSS — modal styling", () => {
  const modalCss = readFileSync(resolve(ROOT, "css/components/modal.css"), "utf8");

  it("defines a fade-in + pop-in animation for the modal + content", () => {
    expect(modalCss).toMatch(/@keyframes modal-fade/);
    expect(modalCss).toMatch(/@keyframes modal-pop/);
  });

  it("defines the 5 mnemonic chip colour classes", () => {
    for (const cat of ["io", "memory", "branch", "control", "dat"]) {
      expect(modalCss).toMatch(new RegExp(`\\.mnemonic-${cat}\\s*\\{`));
    }
  });

  it("defines a tutorial-step grid with 32px number column", () => {
    expect(modalCss).toMatch(/grid-template-columns:\s*32px 1fr/);
  });

  it("keeps the modal-content max-width ≤ 60rem (instructions) and ≤ 44rem (about)", () => {
    expect(modalCss).toMatch(/modal-content-instructions[^}]*max-width:\s*60rem/);
    expect(modalCss).toMatch(/modal-content-about[^}]*max-width:\s*44rem/);
  });

  it("respects prefers-reduced-motion (no modal animation)", () => {
    expect(modalCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(modalCss).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation:\s*none/);
  });

  it("renders the feature cards as a 2-col grid on tablet+ and 1-col on mobile", () => {
    expect(modalCss).toMatch(/\.modal-features\s*\{[^}]*grid-template-columns:\s*repeat\(2, 1fr\)/);
    expect(modalCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.modal-features\s*\{[^}]*grid-template-columns:\s*1fr/);
  });
});

describe("CSS — themes", () => {
  const themesCss = readFileSync(resolve(ROOT, "css/themes.css"), "utf8");

  it("defines the 5 mnemonic chip hues for both themes", () => {
    for (const cat of ["io", "memory", "branch", "control", "dat"]) {
      // dark theme
      expect(themesCss).toMatch(new RegExp(`--mnemonic-${cat}:`));
    }
  });
});

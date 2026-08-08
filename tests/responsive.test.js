// @vitest-environment jsdom
//
// Responsive design regression tests.
//
// jsdom can't actually lay out pixels, so the strategy here is:
//   1. Read the source CSS / HTML files and assert that the expected
//      media queries, custom properties and structural elements exist.
//   2. Render the index.html into the jsdom and check that the runtime
//      DOM matches what the responsive CSS expects (e.g. menu toggle and
//      mobile menu are present, viewport meta has the expected flags).

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const layoutCss   = read("css/layout.css");
const compsCss    = read("css/components.css");
const tokensCss   = read("css/tokens.css");
const themesCss   = read("css/themes.css");
const indexHtml   = read("index.html");

describe("responsive meta & DOM", () => {
  let doc;
  beforeAll(() => {
    doc = document.implementation.createHTMLDocument("");
    doc.documentElement.innerHTML = indexHtml;
  });

  it("uses viewport-fit=cover for safe areas", () => {
    const meta = doc.querySelector('meta[name="viewport"]');
    expect(meta).toBeTruthy();
    expect(meta.getAttribute("content")).toMatch(/viewport-fit=cover/);
    expect(meta.getAttribute("content")).toMatch(/interactive-widget/);
  });

  it("exposes a menu-toggle button + mobile-menu container", () => {
    expect(doc.getElementById("menu-toggle")).toBeTruthy();
    expect(doc.getElementById("mobile-menu")).toBeTruthy();
    const items = doc.querySelectorAll("#mobile-menu .mobile-menu-item");
    expect(items.length).toBe(3);
    expect(items[0].id).toBe("mobile-tutorial");
    expect(items[1].id).toBe("mobile-help");
    expect(items[2].id).toBe("mobile-about");
  });

  it("menu toggle has correct ARIA wiring", () => {
    const btn = doc.getElementById("menu-toggle");
    expect(btn.getAttribute("aria-controls")).toBe("mobile-menu");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.getAttribute("aria-label")).toBeTruthy();
  });

  it("mobile menu starts hidden", () => {
    const menu = doc.getElementById("mobile-menu");
    expect(menu.hidden).toBe(true);
  });

  it("all three mobile items delegate to a header action", () => {
    const ids = ["mobile-tutorial", "mobile-help", "mobile-about"]
      .map((id) => document.getElementById(id) || doc.getElementById(id));
    expect(ids.every(Boolean)).toBe(true);
    const targets = ["tutorial-btn", "help-link", "about-link"];
    targets.forEach((targetId) => {
      expect(doc.getElementById(targetId)).toBeTruthy();
    });
  });

  it("theme-color meta exists for both color schemes", () => {
    const metas = Array.from(doc.querySelectorAll('meta[name="theme-color"]'));
    expect(metas.length).toBe(2);
    const schemes = metas.map((m) => m.getAttribute("media")).sort();
    expect(schemes).toEqual([
      "(prefers-color-scheme: dark)",
      "(prefers-color-scheme: light)",
    ]);
  });
});

describe("responsive tokens", () => {
  it("declares the breakpoint scale in tokens.css", () => {
    ["--bp-xs", "--bp-sm", "--bp-md", "--bp-tablet", "--bp-lg", "--bp-xl", "--bp-2xl"]
      .forEach((name) => expect(tokensCss).toContain(name));
  });

  it("declares safe-area custom properties", () => {
    ["--safe-top", "--safe-right", "--safe-bottom", "--safe-left"].forEach((name) => {
      expect(tokensCss).toContain(name);
      expect(tokensCss).toMatch(new RegExp(`${name}:\\s*env\\(safe-area-inset`));
    });
  });

  it("declares a 44px tap minimum", () => {
    expect(tokensCss).toMatch(/--tap-min:\s*2\.75rem/);
  });

  it("respects prefers-reduced-motion", () => {
    expect(themesCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});

describe("responsive layout breakpoints", () => {
  // The grid is mobile-first: default is 1 column, with 2-column variants
  // kicking in at the iPad portrait (820 px) and refining at iPad landscape
  // (1024 px) / desktop (1280 px).
  const expected = [
    { name: "tablet portrait (≥820px)", pattern: /@media\s*\(min-width:\s*820px\)/ },
    { name: "tablet landscape (≥1024px)", pattern: /@media\s*\(min-width:\s*1024px\)/ },
    { name: "desktop (≥1280px)", pattern: /@media\s*\(min-width:\s*1280px\)/ },
  ];

  expected.forEach(({ name, pattern }) => {
    it(`declares a breakpoint for ${name}`, () => {
      expect(layoutCss).toMatch(pattern);
    });
  });

  it("uses a mobile-first single-column default", () => {
    // The first .app-grid rule must NOT be inside a media query and must
    // declare a single-column grid-template-areas (only one area per row).
    const gridBlock = layoutCss.match(/\.app-grid\s*\{[\s\S]*?\}/);
    expect(gridBlock).toBeTruthy();
    expect(gridBlock[0]).toMatch(/grid-template-columns:\s*1fr/);
    expect(gridBlock[0]).toMatch(/grid-template-areas:/);
  });

  it("applies env(safe-area-inset-*) to the header", () => {
    expect(layoutCss).toMatch(/--safe-top/);
    expect(layoutCss).toMatch(/--safe-bottom/);
  });
});

describe("responsive component rules", () => {
  it("hides text-only header buttons on phones and shows a hamburger", () => {
    expect(compsCss).toMatch(/@media\s*\(max-width:\s*639px\)/);
    expect(compsCss).toMatch(/link-btn\s*\{\s*display:\s*none/);
    expect(compsCss).toMatch(/menu-toggle\s*\{\s*display:\s*inline-flex/);
  });

  it("hides the mobile menu on viewports ≥640px", () => {
    expect(compsCss).toMatch(/@media\s*\(min-width:\s*640px\)/);
    expect(compsCss).toMatch(/\.mobile-menu\s*\{\s*display:\s*none\s*!important/);
  });

  it("enforces a 44px tap minimum via (hover: none)", () => {
    expect(compsCss).toMatch(/@media\s*\(hover:\s*none\)/);
    expect(compsCss).toMatch(/\.btn\s*\{\s*min-height:\s*var\(--tap-min\)/);
  });

  it("stacks the CPU chip into one column under 420px", () => {
    expect(compsCss).toMatch(/@media\s*\(max-width:\s*420px\)/);
    expect(compsCss).toMatch(/\.cpu-chip\s*\{\s*grid-template-columns:\s*1fr/);
  });

  it("stacks the FDE flow vertically under 480px", () => {
    expect(compsCss).toMatch(/@media\s*\(max-width:\s*480px\)/);
    // Look for the rule that overrides .fde-flow grid columns on phones.
    expect(compsCss).toMatch(/\.fde-flow\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  });

  it("collapses RAM cell address+label under 360px", () => {
    expect(compsCss).toMatch(/@media\s*\(max-width:\s*360px\)/);
    expect(compsCss).toMatch(/\.ram-cell\s+\.cell-addr,\s*\n?\s*\.ram-cell\s+\.cell-label\s*\{\s*display:\s*none/);
  });

  it("makes modals full-screen under 480px", () => {
    expect(compsCss).toMatch(/@media\s*\(max-width:\s*480px\)[\s\S]*?\.modal\s*\{[\s\S]*?padding:\s*0/);
  });

  it("forces a single column for IO panels under 480px", () => {
    expect(compsCss).toMatch(/\.io-panels\s*\{[\s\S]*?grid-template-columns:\s*1fr[\s\S]*?\}/);
  });

  it("respects safe areas in modal padding on phones", () => {
    expect(compsCss).toMatch(/--safe-top/);
    expect(compsCss).toMatch(/--safe-bottom/);
  });

  it("disables tap highlight on interactive elements", () => {
    expect(compsCss).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
  });

  it("provides smooth momentum scrolling on iOS overflow surfaces", () => {
    expect(compsCss).toMatch(/-webkit-overflow-scrolling:\s*touch/);
  });

  it("disables the iOS long-press context menu on header UI", () => {
    expect(compsCss).toMatch(/-webkit-touch-callout:\s*none/);
    expect(compsCss).toMatch(/user-select:\s*none/);
  });

  it("uses dynamic viewport height for full-screen modals (iOS Safari)", () => {
    expect(compsCss).toMatch(/height:\s*100dvh/);
  });
});

describe("iOS Safari polish", () => {
  it("prevents overscroll bounce / pull-to-refresh on the body", () => {
    expect(themesCss).toMatch(/overscroll-behavior-y:\s*contain/);
  });

  it("mobile menu sits above the iOS Safari bottom toolbar", () => {
    // The mobile menu's bottom padding should reserve ~3.25rem extra on
    // top of the safe-area inset so it clears the Aa/share/bookmarks bar
    // (visible on iPhone 13 and similar).
    const matches =
      /var\(--safe-bottom\)\s*\+\s*3\.25rem/.test(layoutCss) ||
      /3\.25rem\s*\+\s*var\(--safe-bottom\)/.test(layoutCss);
    expect(matches).toBe(true);
  });
});

describe("SVG icon system", () => {
  it("the play strip has three icon-only buttons with SVG icons", () => {
    let doc;
    doc = document.implementation.createHTMLDocument("");
    doc.documentElement.innerHTML = indexHtml;
    for (const id of ["btn-pause", "btn-step", "btn-restart"]) {
      const btn = doc.getElementById(id);
      expect(btn).toBeTruthy();
      const svg = btn.querySelector("svg.icon");
      expect(svg).toBeTruthy();
      // Has a single <path> child for the visible glyph.
      expect(svg.querySelector("path")).toBeTruthy();
    }
  });

  it("header icon buttons (theme/sound/share) use SVG icons", () => {
    let doc;
    doc = document.implementation.createHTMLDocument("");
    doc.documentElement.innerHTML = indexHtml;
    for (const id of ["theme-toggle", "sound-toggle", "share-btn"]) {
      const btn = doc.getElementById(id);
      const svg = btn.querySelector("svg.icon");
      expect(svg).toBeTruthy();
    }
  });

  it("CSS defines a consistent .icon rule that uses currentColor", () => {
    expect(compsCss).toMatch(/\.icon\s*\{[^}]*currentColor/);
  });

  it("Restart button spins its icon on :active / :focus-visible", () => {
    expect(compsCss).toMatch(/btn-restart:active\s+\.icon|btn-restart:focus-visible\s+\.icon/);
    expect(compsCss).toMatch(/icon-spin/);
  });

  it("step icon is a clean triangle + bar (not overlapping bars)", () => {
    let doc;
    doc = document.implementation.createHTMLDocument("");
    doc.documentElement.innerHTML = indexHtml;
    const stepBtn = doc.getElementById("btn-step");
    const svg = stepBtn.querySelector("svg.icon");
    expect(svg).toBeTruthy();
    const path = svg.querySelector("path").getAttribute("d");
    // The new design uses exactly two sub-paths separated by a single "z":
    // one triangle and one bar.
    const subPaths = path.split("z").filter(Boolean);
    expect(subPaths.length).toBe(2);
    // The triangle starts at (5, *) and uses absolute + relative line commands.
    expect(path).toMatch(/M5\s+\d+l\d+\s+\d+/);
    // The bar uses absolute horizontal commands (h) so it sits cleanly
    // to the right of the triangle — not overlapped.
    expect(path).toMatch(/h\d+/);
    expect(path).not.toMatch(/V5H\d+v14h-\d+V5/); // old overlapping-bar pattern
  });
});

describe("mobile menu module", () => {
  it("is imported and initialized in main.js", async () => {
    const main = read("js/main.js");
    expect(main).toMatch(/from\s+["']\.\/ui\/mobileMenu\.js["']/);
    expect(main).toMatch(/initMobileMenu\s*\(\s*\)/);
  });

  it("defines an exported initMobileMenu function", async () => {
    const src = read("js/ui/mobileMenu.js");
    expect(src).toMatch(/export\s+function\s+initMobileMenu/);
  });
});
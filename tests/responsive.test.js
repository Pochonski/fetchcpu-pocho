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

// Aggregate every CSS file served by the app so per-concern selectors in
// the split components/ tree are still discoverable by the responsive
// suite.
const compsCss = [
  "css/components.css",
  "css/components/panel.css",
  "css/components/buttons.css",
  "css/components/forms.css",
  "css/components/editor.css",
  "css/components/cpu.css",
  "css/components/ram.css",
  "css/components/stats.css",
  "css/components/log.css",
  "css/components/modal.css",
  "css/components/utilities.css",
].map(read).join("\n");
const layoutCss   = read("css/layout.css");
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
    ["--bp-xs", "--bp-sm", "--bp-md", "--bp-tablet", "--bp-lg", "--bp-xl", "--bp-2xl", "--bp-3xl"]
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

  it("declares a wider layout cap for the wide-desktop breakpoint", () => {
    expect(tokensCss).toMatch(/--layout-max-width-wide:\s*2360px/);
  });

  it("respects prefers-reduced-motion", () => {
    expect(themesCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});

describe("responsive layout breakpoints", () => {
  // The grid is mobile-first: default is 1 column, with 2-column variants
  // kicking in at the iPad portrait (820 px) and refining at iPad landscape
  // (1024 px) / desktop (1280 px). On wide desktops (≥1640 px) the layout
  // switches to 3 columns × 2 rows: the left column stacks CPU · State
  // and the Program · Assembly editor; the centre column stacks Controls
  // · Execution and the Activity panel; RAM spans both rows on the right.
  // Activity is a sibling of Controls (not a sibling of the editor), so
  // no panel ever falls into a full-width horizontal row.
  const expected = [
    { name: "tablet portrait (≥820px)", pattern: /@media\s*\(min-width:\s*820px\)/ },
    { name: "tablet landscape (≥1024px)", pattern: /@media\s*\(min-width:\s*1024px\)/ },
    { name: "desktop (≥1280px)", pattern: /@media\s*\(min-width:\s*1280px\)/ },
    { name: "wide desktop (≥1640px)", pattern: /@media\s*\(min-width:\s*1640px\)/ },
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

  it("stacks CPU/Editor on the left and Controls/Activity in the centre at ≥1640px", () => {
    // Pull out just the wide-desktop block so the assertions don't match
    // against the default 1-col or 2-col rules.
    const wideBlock = layoutCss.match(
      /@media\s*\(min-width:\s*1640px\)\s*\{[\s\S]*?\.app-grid\s*\{[\s\S]*?\}\s*\}/,
    );
    expect(wideBlock).toBeTruthy();
    // Three equal columns.
    expect(wideBlock[0]).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
    // Two rows: top row is CPU + Controls + RAM, bottom row is Editor +
    // Activity + RAM. RAM is the only column that repeats (it spans both
    // rows).
    expect(wideBlock[0]).toMatch(/grid-template-areas:\s*"cpu\s+controls\s+ram"\s+"editor\s+log\s+ram"/);
    // Activity is paired with Controls (in the centre column), not with
    // Editor (in the left column). No "log log log" full-width row.
    expect(wideBlock[0]).not.toMatch(/grid-template-areas:[\s\S]*?"log\s+log\s+log"/);
    expect(wideBlock[0]).toMatch(/max-width:\s*var\(--layout-max-width-wide\)/);
  });

  it("Activity collapsed → Controls spans both rows of the centre column", () => {
    const collapsedLogBlock = layoutCss.match(
      /\.app-grid:has\(\.log-panel\[data-collapsed="true"\]\)\s*\{[\s\S]*?\}/,
    );
    expect(collapsedLogBlock).toBeTruthy();
    expect(collapsedLogBlock[0]).toMatch(/"cpu\s+controls\s+ram"\s+"editor\s+controls\s+ram"/);
  });

  it("Editor collapsed → CPU spans both rows of the left column", () => {
    const collapsedEditorBlock = layoutCss.match(
      /\.app-grid:has\(\.editor-panel\[data-collapsed="true"\]\)\s*\{[\s\S]*?\}/,
    );
    expect(collapsedEditorBlock).toBeTruthy();
    // CPU repeats in the left column; Activity keeps row 2 of centre;
    // RAM keeps row 2 of right.
    expect(collapsedEditorBlock[0]).toMatch(/"cpu\s+log\s+ram"\s+"cpu\s+log\s+ram"/);
  });

  it("ram and log panels fill their grid cells on ≥1640px", () => {
    // RAM spans both rows of the right column and Activity fills row 2
    // (auto minmax(0, 1fr)), so both need height: 100% so their inner
    // scroll containers fill the grid cell. .controls-panel sits in
    // row 1 alongside CPU and RAM — letting it size to its content
    // avoids an empty gap below the IO row when RAM is the tallest
    // item in row 1; the row's intrinsic height still sizes off
    // max(CPU, RAM, Controls) so the layout below stays consistent.
    const wideBlock = layoutCss.match(
      /@media\s*\(min-width:\s*1640px\)\s*\{[\s\S]*?\.ram-panel,\s*\.log-panel\s*\{[\s\S]*?\}\s*\}/,
    );
    expect(wideBlock).toBeTruthy();
    expect(wideBlock[0]).toMatch(/height:\s*100%/);
  });

  it("footer follows the wider layout cap at ≥1640px", () => {
    const footerWideBlock = layoutCss.match(
      /@media\s*\(min-width:\s*1640px\)\s*\{[\s\S]*?\.app-footer\s*\{[\s\S]*?\}\s*\}/,
    );
    expect(footerWideBlock).toBeTruthy();
    expect(footerWideBlock[0]).toMatch(/max-width:\s*var\(--layout-max-width-wide\)/);
  });

  it("ram rows expand uniformly to fill stretched panel on desktop ≥820px", () => {
    // On desktop the RAM panel spans two grid rows and is stretched to
    // ~1200 px, but its 10 data rows previously left ~500 px of blank
    // at the bottom. The fix makes .ram-table / #ram-body flex and each
    // .ram-row flex:1 so the cells grow to fill the panel.
    expect(compsCss).toMatch(/@media\s*\(min-width:\s*820px\)\s*\{[\s\S]*?\.ram-table\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex:\s*1/);
    expect(compsCss).toMatch(/@media\s*\(min-width:\s*820px\)\s*\{[\s\S]*?\.ram-row:not\(.*\)\s*\{[\s\S]*?flex:\s*1/);
  });

  it("activity panel content fills stretched cell on desktop ≥820px", () => {
    // log-panel is stretched by the grid on desktop; without flex the
    // live feed left ~250 px of blank. The tab-panel and live-feed must
    // be flex:1 so they grow to fill.
    expect(compsCss).toMatch(/@media\s*\(min-width:\s*820px\)\s*\{[\s\S]*?\.log-panel\s+\.tab-panel:not\(\[hidden\]\)\s*\{[\s\S]*?flex:\s*1/);
    expect(compsCss).toMatch(/@media\s*\(min-width:\s*820px\)\s*\{[\s\S]*?\.live-feed\s*\{[\s\S]*?flex:\s*1/);
  });

  it("large screens fill viewport height and controls/cpu absorb blank", () => {
    // At ≥1640 px (27"+) the grid must occupy the full viewport height
    // (no ~230 px gap below) so Editor + Activity can grow. Body is
    // a flex column at 100dvh and the grid is flex:1; the Controls IO
    // row and the CPU chip area must also be flex:1 to absorb internal
    // blanks (~81 px in Controls, ~26 px in CPU).
    expect(layoutCss).toMatch(/@media\s*\(min-width:\s*1640px\)\s*\{[\s\S]*?body\s*\{[\s\S]*?min-height:\s*100dvh/);
    expect(layoutCss).toMatch(/@media\s*\(min-width:\s*1640px\)\s*\{[\s\S]*?\.app-grid\s*\{[\s\S]*?flex:\s*1/);
    expect(compsCss).toMatch(/@media\s*\(min-width:\s*1640px\)\s*\{[\s\S]*?\.controls-panel\s*>\s*\.controls-row-io\s*\{[\s\S]*?flex:\s*1/);
    expect(compsCss).toMatch(/@media\s*\(min-width:\s*1640px\)\s*\{[\s\S]*?\.cpu-card\s*\{[\s\S]*?flex:\s*1/);
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

  it("lays out the IO row in two equal columns by default", () => {
    // .controls-row-io is a CSS Grid with two equal columns so the input
    // + output panels sit side-by-side in the Controls panel and save
    // vertical space on wide desktops.
    expect(compsCss).toMatch(
      /\.controls-row-io\s*\{[\s\S]*?grid-template-columns:\s*1fr\s+1fr[\s\S]*?\}/,
    );
  });

  it("stacks each IO panel into its own row under 480px", () => {
    // @media (max-width: 480px) collapses the grid-template-columns to a
    // single column so each panel claims the full row width on phones.
    expect(compsCss).toMatch(
      /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.controls-row-io\s*\{[\s\S]*?grid-template-columns:\s*1fr[\s\S]*?\}\s*\}/,
    );
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

  it("loosens FDE step + speed-control minimums for the narrow middle column at ≥1640px", () => {
    // Inside the 3-col layout the Controls panel lives in a narrow middle
    // column (~430–620 px). The default 7rem / 14rem minimums would force
    // overflow, so both need an override inside the wide-desktop media
    // query.
    const fdeOverride = compsCss.match(
      /@media\s*\(min-width:\s*1640px\)\s*\{[\s\S]*?\.fde-step\s*\{[\s\S]*?min-width:\s*0[\s\S]*?\}/,
    );
    expect(fdeOverride).toBeTruthy();
    const speedOverride = compsCss.match(
      /@media\s*\(min-width:\s*1640px\)\s*\{[\s\S]*?\.speed-control\s*\{[\s\S]*?min-width:\s*0[\s\S]*?\}/,
    );
    expect(speedOverride).toBeTruthy();
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
    const doc = document.implementation.createHTMLDocument("");
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
    const doc = document.implementation.createHTMLDocument("");
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
    const doc = document.implementation.createHTMLDocument("");
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
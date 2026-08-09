// @vitest-environment jsdom
// Logo / brand-mark rendering regression tests.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("brand-mark.svg", () => {
  const svg = readFileSync(resolve(ROOT, "assets/brand-mark.svg"), "utf8");

  it("is a valid SVG", () => {
    expect(svg).toMatch(/<svg[^>]*>/);
    expect(svg).toContain("fill=");
  });
});

describe("logo references in index.html", () => {
  const html = readFileSync(resolve(ROOT, "index.html"), "utf8");

  it("appears in the header with the brand-mark SVG src", () => {
    const m = html.match(/<img class="logo"[^>]*\/>/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('src="assets/brand-mark.svg"');
  });

  it("appears in the footer brand-badge with the brand-mark SVG src", () => {
    const m = html.match(/<img class="brand-badge-icon"[^>]*\/>/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('src="assets/brand-mark.svg"');
  });

  it("appears in the about modal with the brand-mark SVG src", () => {
    const m = html.match(/<img class="modal-logo"[^>]*\/>/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('src="assets/brand-mark.svg"');
  });

  it("is declared as favicon, apple-touch-icon, and mask-icon", () => {
    expect(html).toMatch(/<link rel="icon" href="assets\/brand-mark\.svg"/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="assets\/brand-mark\.svg"/);
    expect(html).toMatch(/<link rel="mask-icon" href="assets\/brand-mark\.svg"/);
  });
});

describe("logo survival across rebuildModalContent()", () => {
  // Regression test: previously main.js#rebuildModalContent called
  //     footer.innerHTML = t("footer.text", ...)
  // which destroyed the brand-badge (logo + tagline) on every translation
  // pass. The fix targets only the #footer-text sibling span.
  it("does not overwrite the brand-badge with the localized footer text", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    // The brand-badge and #footer-text must be siblings, not nested.
    const footer = html.match(/<footer class="app-footer">([\s\S]*?)<\/footer>/);
    expect(footer).not.toBeNull();
    expect(footer[1]).toContain('class="brand-badge"');
    expect(footer[1]).toContain('id="footer-text"');
    // The brand-badge must contain the logo image and the tagline.
    expect(footer[1]).toMatch(/<img class="brand-badge-icon"[^>]*brand-mark\.svg/);
    expect(footer[1]).toMatch(/data-i18n="app\.tagline"/);
  });
});

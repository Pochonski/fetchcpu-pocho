// @vitest-environment jsdom
// Logo / brand-mark rendering regression tests. The single source of
// truth is assets/logo.png, with favicon-32.png / favicon-192.png /
// favicon-512.png / apple-touch-icon.png as favicon-sized derivatives.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("logo.png", () => {
  it("exists and is a non-empty PNG", () => {
    const path = resolve(ROOT, "assets/logo.png");
    expect(existsSync(path)).toBe(true);
    const buf = readFileSync(path);
    expect(buf.length).toBeGreaterThan(100);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toEqual([...buf.subarray(0, 8)]);
  });

  it("is the only brand asset — old brand-mark.* files are removed", () => {
    for (const legacy of [
      "assets/brand-mark.svg",
      "assets/brand-mark.png",
    ]) {
      expect(existsSync(resolve(ROOT, legacy))).toBe(false);
    }
  });
});

describe("favicon-sized derivatives", () => {
  for (const name of ["favicon-32.png", "favicon-192.png", "favicon-512.png", "apple-touch-icon.png"]) {
    it(`${name} exists and is a valid PNG`, () => {
      const path = resolve(ROOT, `assets/${name}`);
      expect(existsSync(path)).toBe(true);
      const buf = readFileSync(path);
      expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });
  }
});

describe("logo references in index.html", () => {
  const html = readFileSync(resolve(ROOT, "index.html"), "utf8");

  it("in-app header uses assets/logo.png", () => {
    expect(html).toMatch(/<img class="logo"[^>]+src="assets\/logo\.png/);
  });

  it("footer brand-badge uses assets/logo.png", () => {
    expect(html).toMatch(/<img class="brand-badge-icon"[^>]+src="assets\/logo\.png/);
  });

  it("about modal uses assets/logo.png", () => {
    expect(html).toMatch(/<img class="modal-logo"[^>]+src="assets\/logo\.png/);
  });

  it("favicon stack uses only logo-derived PNGs (no SVG fallback)", () => {
    // All favicon links point at PNG derivatives of logo.png.
    expect(html).toMatch(/<link rel="icon"[^>]+href="assets\/favicon-32\.png/);
    expect(html).toMatch(/<link rel="icon"[^>]+href="assets\/favicon-192\.png/);
    expect(html).toMatch(/<link rel="icon"[^>]+href="assets\/favicon-512\.png/);
    expect(html).toMatch(/<link rel="apple-touch-icon"[^>]+href="assets\/apple-touch-icon\.png/);
    // No brand-mark.* or .svg favicon links remain.
    expect(html).not.toMatch(/brand-mark/);
    expect(html).not.toMatch(/rel="icon"[^>]+type="image\/svg\+xml"/);
  });

  it("og:image and twitter:image point at logo.png", () => {
    expect(html).toMatch(/og:image" content="https:\/\/fetchcpu-pocho\.vercel\.app\/assets\/logo\.png/);
    expect(html).toMatch(/twitter:image" content="https:\/\/fetchcpu-pocho\.vercel\.app\/assets\/logo\.png/);
  });
});

describe("logo survival across rebuildModalContent()", () => {
  // Regression test: previously main.js#rebuildModalContent called
  //     footer.innerHTML = t("footer.text", ...)
  // which destroyed the brand-badge (logo + tagline) on every translation
  // pass. The fix targets only the #footer-text sibling span.
  it("does not overwrite the brand-badge with the localized footer text", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    const footer = html.match(/<footer class="app-footer">([\s\S]*?)<\/footer>/);
    expect(footer).not.toBeNull();
    expect(footer[1]).toContain('class="brand-badge"');
    expect(footer[1]).toContain('id="footer-text"');
    expect(footer[1]).toMatch(/<img class="brand-badge-icon"[^>]+logo\.png/);
    expect(footer[1]).toMatch(/data-i18n="app\.tagline"/);
  });
});

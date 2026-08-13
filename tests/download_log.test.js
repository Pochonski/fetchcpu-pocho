// @vitest-environment jsdom
// Regression test for Phase 4: logger.download() creates a text/plain
// blob from the captured lines, triggers an anchor download, and revokes
// the object URL after a short delay.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createLogger } from "../js/ui/logger.js";

describe("logger.js — download()", () => {
  let liveFeed, log, captured;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="liveFeed"></div>
      <div id="log"></div>
    `;
    liveFeed = document.getElementById("liveFeed");
    log = document.getElementById("log");

    // Intercept the anchor click and capture the blob MIME + filename.
    captured = { blob: null, click: null, revoked: false };
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (blob) => {
      captured.blob = { type: blob.type, size: blob.size };
      return "blob:mock";
    };
    URL.revokeObjectURL = () => { captured.revoked = true; };
    HTMLAnchorElement.prototype.click = function () {
      captured.click = { href: this.href, download: this.download };
    };
    // Stash so we can restore on teardown if needed.
    captured._origCreate = origCreate;
    captured._origRevoke = origRevoke;
  });

  it("creates a text/plain blob from accumulated lines", () => {
    const logger = createLogger(liveFeed, log);
    logger.onProgramLoaded(3);
    logger.onProgramHalted({ state: { haltedAt: 3 } });
    logger.onError("boom");

    logger.download();

    expect(captured.blob).toBeTruthy();
    expect(captured.blob.type).toBe("text/plain");
    expect(captured.blob.size).toBeGreaterThan(0);
  });

  it("triggers a downloadable anchor with a .txt filename", () => {
    const logger = createLogger(liveFeed, log);
    logger.onProgramLoaded(1);
    logger.download();

    expect(captured.click).toBeTruthy();
    expect(captured.click.href).toBe("blob:mock");
    expect(captured.click.download).toMatch(/^fetchcpu-log-\d+\.txt$/);
  });

  it("appends and removes the temporary anchor from document.body", () => {
    const logger = createLogger(liveFeed, log);
    logger.download();

    // The download pattern uses appendChild + click + removeChild; after
    // the synchronous chain, no orphan <a download="..."> should remain.
    expect(document.querySelector('a[download^="fetchcpu-log-"]')).toBeNull();
  });

  it("revokes the object URL after a short delay", async () => {
    vi.useFakeTimers();
    try {
      const logger = createLogger(liveFeed, log);
      logger.download();
      expect(captured.revoked).toBe(false);
      vi.advanceTimersByTime(300);
      expect(captured.revoked).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("emits an empty log when nothing has happened yet", () => {
    const logger = createLogger(liveFeed, log);
    logger.download();
    // Even an empty log file should be emitted with the right MIME type.
    expect(captured.blob.type).toBe("text/plain");
    expect(captured.click.download).toMatch(/\.txt$/);
  });
});

// @vitest-environment jsdom
// Tests for the sound module — initialised with no AudioContext so the
// `enable()` and `tick()` paths must not throw.
import { describe, it, expect, beforeEach } from "vitest";
import { createSound } from "../js/ui/sound.js";

describe("sound.js — createSound", () => {
  beforeEach(() => {
    // jsdom may or may not expose AudioContext; force-disable so we test
    // the no-op path consistently.
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
  });

  it("isEnabled reflects toggle state", () => {
    const s = createSound();
    expect(s.isEnabled()).toBe(false);
    s.enable(true);
    expect(s.isEnabled()).toBe(true);
    s.enable(false);
    expect(s.isEnabled()).toBe(false);
  });

  it("enable() is idempotent", () => {
    const s = createSound();
    s.enable(true);
    s.enable(true);
    expect(s.isEnabled()).toBe(true);
  });

  it("tick/fetch/decode/execute/halt do not throw without AudioContext", () => {
    const s = createSound();
    s.enable(true);
    expect(() => s.tick()).not.toThrow();
    expect(() => s.fetch()).not.toThrow();
    expect(() => s.decode()).not.toThrow();
    expect(() => s.execute()).not.toThrow();
    expect(() => s.halt()).not.toThrow();
  });

  it("the exported API is the documented shape", () => {
    const s = createSound();
    expect(typeof s.enable).toBe("function");
    expect(typeof s.isEnabled).toBe("function");
    expect(typeof s.fetch).toBe("function");
    expect(typeof s.decode).toBe("function");
    expect(typeof s.execute).toBe("function");
    expect(typeof s.tick).toBe("function");
    expect(typeof s.halt).toBe("function");
  });
});
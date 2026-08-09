// Tests for the ram.js format() nine's-complement display (H13).
import { describe, it, expect } from "vitest";
import { createRAM } from "../js/cpu/ram.js";

describe("ram.js — format() nine's complement display (H13)", () => {
  it("displays zero as '000'", () => {
    const ram = createRAM();
    expect(ram.format(0)).toBe("000");
  });

  it("displays positive values left-padded", () => {
    const ram = createRAM();
    ram.write(0, 5);
    expect(ram.format(0)).toBe("005");
    ram.write(0, 42);
    expect(ram.format(0)).toBe("042");
    ram.write(0, 500);
    expect(ram.format(0)).toBe("500");
  });

  it("displays -1 as '999' (nine's complement)", () => {
    const ram = createRAM();
    ram.write(0, -1);
    expect(ram.format(0)).toBe("999");
  });

  it("displays -2 as '998'", () => {
    const ram = createRAM();
    ram.write(0, -2);
    expect(ram.format(0)).toBe("998");
  });

  it("displays -499 as '501' (most negative allowed)", () => {
    const ram = createRAM();
    ram.write(0, -499);
    expect(ram.format(0)).toBe("501");
  });
});
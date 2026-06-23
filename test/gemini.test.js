import { describe, it, expect } from "vitest";
import { clampScore } from "../lib/gemini.js";

describe("clampScore", () => {
  it("passes through valid in-range integers", () => {
    expect(clampScore(1)).toBe(1);
    expect(clampScore(5)).toBe(5);
    expect(clampScore(10)).toBe(10);
  });

  it("clamps values below 1 up to 1", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-7)).toBe(1);
  });

  it("clamps values above 10 down to 10", () => {
    expect(clampScore(11)).toBe(10);
    expect(clampScore(9999)).toBe(10);
  });

  it("coerces numeric strings", () => {
    expect(clampScore("8")).toBe(8);
  });

  it("rounds fractional scores to the nearest integer", () => {
    expect(clampScore(7.6)).toBe(8);
    expect(clampScore(2.2)).toBe(2);
  });

  it("returns the fallback for non-numeric input", () => {
    expect(clampScore(undefined)).toBe(5);
    expect(clampScore(null)).toBe(5);
    expect(clampScore("not-a-number")).toBe(5);
    expect(clampScore(NaN)).toBe(5);
  });

  it("honors a custom fallback", () => {
    expect(clampScore("x", 3)).toBe(3);
  });
});

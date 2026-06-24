import { describe, it, expect } from "vitest";
import { analyzeUtterance, TONE_NAME } from "../lib/tone-analysis.js";

const flat = Array(20).fill(200); // level pitch -> tone 1
const falling = Array.from({ length: 20 }, (_, i) => 260 - i * 5); // high -> low -> tone 4

describe("analyzeUtterance", () => {
  it("scores a correctly produced tone (妈 = tone 1, level pitch) as a match", () => {
    const r = analyzeUtterance("妈", flat);
    expect(r.total).toBe(1);
    expect(r.syllables[0]).toMatchObject({ char: "妈", expected: 1, detected: 1, match: true });
    expect(r.score).toBe(10);
    expect(r.errors).toEqual([]);
  });

  it("flags a wrong tone (妈 spoken with a falling pitch) and names the syllable", () => {
    const r = analyzeUtterance("妈", falling);
    expect(r.syllables[0]).toMatchObject({ char: "妈", expected: 1, detected: 4, match: false });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain("妈");
  });

  it("returns one syllable entry per Han character", () => {
    const r = analyzeUtterance("中文", flat);
    expect(r.syllables.map((s) => s.char)).toEqual(["中", "文"]);
    expect(r.syllables.every((s) => typeof s.pinyin === "string")).toBe(true);
  });

  it("handles an empty transcript without throwing", () => {
    const r = analyzeUtterance("", flat);
    expect(r.total).toBe(0);
    expect(r.syllables).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("exposes human-readable tone names", () => {
    expect(TONE_NAME[2]).toContain("第二声");
  });
});

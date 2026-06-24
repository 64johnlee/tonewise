import { describe, it, expect } from "vitest";
import { toneSequence, expectedTones } from "../lib/pinyin.js";

describe("toneSequence", () => {
  it("returns the canonical tone for each Han character", () => {
    const seq = toneSequence("中文");
    expect(seq.map((s) => s.char)).toEqual(["中", "文"]);
    expect(seq.map((s) => s.tone)).toEqual([1, 2]);
  });

  it("maps the neutral tone to 0", () => {
    expect(toneSequence("吗")[0].tone).toBe(0);
  });

  it("returns an empty array when there are no Han characters", () => {
    expect(toneSequence("hello!")).toEqual([]);
    expect(toneSequence("")).toEqual([]);
  });
});

describe("expectedTones", () => {
  it("strips non-Han characters and yields aligned tone numbers", () => {
    expect(expectedTones("中文 ok!")).toEqual([1, 2]);
  });

  it("handles a multi-syllable phrase", () => {
    expect(expectedTones("老师")).toEqual([3, 1]);
  });
});

import { describe, it, expect } from "vitest";
import {
  TOPICS,
  HSK_LEVELS,
  FREE_LIMIT,
  DEFAULT_LEVEL,
  MAX_REVIEW_WORDS_PER_TURN,
  topicDesc,
  levelDesc,
  cleanReviewWords,
} from "../lib/constants.js";

describe("constants", () => {
  it("exposes the expected free-tier and review limits", () => {
    expect(FREE_LIMIT).toBe(3);
    expect(MAX_REVIEW_WORDS_PER_TURN).toBe(5);
    expect(DEFAULT_LEVEL).toBe("HSK2");
  });

  it("defines a description for every HSK level", () => {
    for (const level of ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"]) {
      expect(typeof HSK_LEVELS[level]).toBe("string");
      expect(HSK_LEVELS[level].length).toBeGreaterThan(0);
    }
  });
});

describe("topicDesc", () => {
  it("returns the description for a known topic id", () => {
    expect(topicDesc("restaurant")).toBe(TOPICS[0].desc);
  });

  it("falls back to the first topic for an unknown id", () => {
    expect(topicDesc("does-not-exist")).toBe(TOPICS[0].desc);
  });

  it("falls back for undefined input", () => {
    expect(topicDesc(undefined)).toBe(TOPICS[0].desc);
  });
});

describe("levelDesc", () => {
  it("returns the description for a known level", () => {
    expect(levelDesc("HSK4")).toBe(HSK_LEVELS.HSK4);
  });

  it("falls back to the default level for an unknown level", () => {
    expect(levelDesc("HSK99")).toBe(HSK_LEVELS[DEFAULT_LEVEL]);
  });

  it("falls back for undefined input", () => {
    expect(levelDesc(undefined)).toBe(HSK_LEVELS[DEFAULT_LEVEL]);
  });
});

describe("cleanReviewWords", () => {
  it("trims whitespace around words", () => {
    expect(cleanReviewWords(["  ni3  ", "hao3 "])).toEqual(["ni3", "hao3"]);
  });

  it("drops empty and whitespace-only entries", () => {
    expect(cleanReviewWords(["", "   ", "shi4"])).toEqual(["shi4"]);
  });

  it("dedupes while preserving first-seen order", () => {
    expect(cleanReviewWords(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for nullish input", () => {
    expect(cleanReviewWords(null)).toEqual([]);
    expect(cleanReviewWords(undefined)).toEqual([]);
  });

  it("coerces non-string values to trimmed strings", () => {
    expect(cleanReviewWords([42, " 7 "])).toEqual(["42", "7"]);
  });
});

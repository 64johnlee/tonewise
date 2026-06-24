import { describe, it, expect } from "vitest";
import {
  autoCorrelate,
  hzToSemitones,
  voicedFrames,
  evenSplit,
  classifyTone,
  contourToTones,
  compareTones,
  accuracyToScore,
} from "../lib/pitch.js";

function sine(freq, sampleRate, length) {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) buf[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return buf;
}

describe("autoCorrelate", () => {
  it("detects the fundamental of a pure sine within ~3 Hz", () => {
    const hz = autoCorrelate(sine(220, 44100, 2048), 44100);
    expect(Math.abs(hz - 220)).toBeLessThan(3);
  });

  it("returns -1 for silence", () => {
    expect(autoCorrelate(new Float32Array(2048), 44100)).toBe(-1);
  });

  it("rejects frequencies outside the human-voice band", () => {
    expect(autoCorrelate(sine(30, 44100, 2048), 44100)).toBe(-1);
  });
});

describe("hzToSemitones", () => {
  it("is 0 at the reference and 12 an octave up", () => {
    expect(hzToSemitones(220, 220)).toBe(0);
    expect(hzToSemitones(440, 220)).toBeCloseTo(12, 6);
  });

  it("returns NaN for non-positive input", () => {
    expect(Number.isNaN(hzToSemitones(0, 220))).toBe(true);
    expect(Number.isNaN(hzToSemitones(220, 0))).toBe(true);
  });
});

describe("voicedFrames", () => {
  it("drops unvoiced markers and non-numbers", () => {
    expect(voicedFrames([110, -1, 0, 220, null, NaN])).toEqual([110, 220]);
  });
  it("handles nullish input", () => {
    expect(voicedFrames(undefined)).toEqual([]);
  });
});

describe("evenSplit", () => {
  it("splits into the requested number of contiguous chunks", () => {
    expect(evenSplit([1, 2, 3, 4, 5, 6], 3)).toEqual([[1, 2], [3, 4], [5, 6]]);
  });
  it("returns [] for empty input or non-positive count", () => {
    expect(evenSplit([], 3)).toEqual([]);
    expect(evenSplit([1, 2], 0)).toEqual([]);
  });
});

describe("classifyTone", () => {
  it("classifies a clearly rising contour as tone 2", () => {
    expect(classifyTone([0, 1, 2, 3, 4])).toBe(2);
  });
  it("classifies a clearly falling contour as tone 4", () => {
    expect(classifyTone([4, 3, 2, 1, 0])).toBe(4);
  });
  it("classifies a high level contour as tone 1", () => {
    expect(classifyTone([3, 3, 3, 3])).toBe(1);
  });
  it("classifies a dip contour as tone 3", () => {
    expect(classifyTone([0, -3, -4, -2, 0])).toBe(3);
  });
  it("classifies a low level contour as tone 3", () => {
    expect(classifyTone([-2, -2, -2, -2])).toBe(3);
  });
  it("returns 0 when there is too little signal", () => {
    expect(classifyTone([1])).toBe(0);
    expect(classifyTone([])).toBe(0);
  });
});

describe("contourToTones", () => {
  it("derives one tone per requested syllable from a Hz contour", () => {
    const rising = [180, 190, 200, 210, 220, 230];
    expect(contourToTones(rising, 1)).toEqual([2]);
  });
  it("returns [] when there is no voiced signal", () => {
    expect(contourToTones([-1, -1], 2)).toEqual([]);
  });
});

describe("compareTones", () => {
  it("scores matching tones and reports per-syllable detail", () => {
    const r = compareTones([2, 4, 1], [2, 3, 1]);
    expect(r.total).toBe(3);
    expect(r.matches).toBe(2);
    expect(r.accuracy).toBeCloseTo(2 / 3, 6);
    expect(r.perSyllable[1]).toMatchObject({ expected: 3, detected: 4, match: false });
  });

  it("excludes neutral (0) expected tones from scoring", () => {
    const r = compareTones([2, 1, 4], [2, 0, 4]);
    expect(r.total).toBe(2);
    expect(r.matches).toBe(2);
    expect(r.accuracy).toBe(1);
    expect(r.perSyllable[1]).toMatchObject({ scored: false, match: null });
  });
});

describe("accuracyToScore", () => {
  it("maps accuracy onto the 1-10 grade scale", () => {
    expect(accuracyToScore(1)).toBe(10);
    expect(accuracyToScore(0)).toBe(1);
    expect(accuracyToScore(0.5)).toBe(5);
  });
});

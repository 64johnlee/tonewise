// Ties the spoken transcript to the measured pitch: canonical tones (what the words
// should be) vs detected tones (what the learner actually produced). This is the
// core "tone correction" result the UI renders and the prompt references.
import { toneSequence } from "./pinyin.js";
import { contourToTones, compareTones, accuracyToScore } from "./pitch.js";

export const TONE_NAME = {
  0: "轻声",
  1: "第一声（高平）",
  2: "第二声（上升）",
  3: "第三声（降升）",
  4: "第四声（下降）",
};

export function analyzeUtterance(transcript, contour) {
  const seq = toneSequence(transcript);
  const expected = seq.map((s) => s.tone);
  const detected = contourToTones(contour, expected.length);
  const cmp = compareTones(detected, expected);

  const syllables = seq.map((s, i) => ({
    char: s.char,
    pinyin: s.pinyin,
    expected: s.tone,
    detected: detected[i] ?? 0,
    scored: cmp.perSyllable[i]?.scored ?? false,
    match: cmp.perSyllable[i]?.match ?? null,
  }));

  const errors = syllables
    .filter((s) => s.match === false)
    .map((s) => `${s.char}（${s.pinyin}）听起来像${TONE_NAME[s.detected] || "不清楚"}，应该是${TONE_NAME[s.expected]}`);

  return {
    score: accuracyToScore(cmp.accuracy),
    accuracy: cmp.accuracy,
    matches: cmp.matches,
    total: cmp.total,
    syllables,
    errors,
  };
}

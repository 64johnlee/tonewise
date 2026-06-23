// Canonical tone reference for a Mandarin string, via the offline pinyin-pro
// dictionary. The recognized transcript gives the words; this gives the *correct*
// tone each word should carry, which we compare against the learner's measured pitch.
import { pinyin } from "pinyin-pro";

const isHan = (ch) => /\p{Script=Han}/u.test(ch);

// -> [{ char, pinyin, tone }] for each Han character. Neutral tone (5) maps to 0
// and is excluded from tone scoring (it has no fixed contour).
export function toneSequence(text) {
  const chars = [...String(text || "")].filter(isHan);
  if (!chars.length) return [];
  const py = pinyin(chars.join(""), { toneType: "num", type: "array" });
  return chars.map((char, i) => {
    const p = py[i] || "";
    const m = p.match(/([1-5])\s*$/);
    const tone = m ? Number(m[1]) : 0;
    return { char, pinyin: p, tone: tone === 5 ? 0 : tone };
  });
}

// Just the tone numbers (0 = neutral/unknown), aligned to the Han characters.
export function expectedTones(text) {
  return toneSequence(text).map((s) => s.tone);
}

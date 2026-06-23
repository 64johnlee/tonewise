// Pure DSP helpers for tone analysis. No browser/Web-Audio dependency here so the
// logic stays unit-testable; the browser glue (mic capture) lives in lib/voice.js.

// Fundamental-frequency estimate (Hz) for one time-domain frame via normalized
// autocorrelation. Returns -1 when the frame is too quiet / unvoiced.
export function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }

  const b = buf.slice(r1, r2);
  const n = b.length;
  const c = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) c[i] += b[j] * b[j + i];
  }

  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  if (maxpos <= 0) return -1;

  let T0 = maxpos;
  const x1 = c[T0 - 1] || 0;
  const x2 = c[T0] || 0;
  const x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a) T0 -= bb / (2 * a);

  const hz = sampleRate / T0;
  // Keep only plausible human-voice fundamentals.
  return hz >= 60 && hz <= 500 ? hz : -1;
}

const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Pitch ratio -> semitones relative to a reference frequency.
export function hzToSemitones(hz, refHz) {
  if (!(hz > 0) || !(refHz > 0)) return NaN;
  return 12 * Math.log2(hz / refHz);
}

// Drop unvoiced (-1) frames; return only the voiced Hz values.
export function voicedFrames(frames) {
  return (frames || []).filter((hz) => typeof hz === "number" && hz > 0);
}

// Split a contour into `count` contiguous, roughly equal segments. Even-split is
// deliberately chosen over silence-based segmentation: it is robust to a learner's
// noisy mic and we already know the syllable count from the transcript.
export function evenSplit(contour, count) {
  if (count <= 0 || contour.length === 0) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * contour.length) / count);
    const end = Math.floor(((i + 1) * contour.length) / count);
    out.push(contour.slice(start, Math.max(end, start + 1)));
  }
  return out;
}

// Classify one syllable's semitone contour into a Mandarin tone (1-4), or 0 if
// indeterminate. Heuristic: compare onset vs offset pitch and look for the tone-3 dip.
export function classifyTone(semis) {
  const v = (semis || []).filter(Number.isFinite);
  if (v.length < 2) return 0;

  const head = avg(v.slice(0, Math.max(1, Math.ceil(v.length * 0.3))));
  const tail = avg(v.slice(Math.floor(v.length * 0.7)));
  const mean = avg(v);
  const min = Math.min(...v);
  const minIdx = v.indexOf(min);
  const slope = tail - head;

  const RISE = 1.5;
  const FALL = -1.5;
  const DIP = 1.0;

  const isDip = minIdx > v.length * 0.15 && minIdx < v.length * 0.85
    && head - min > DIP && tail - min > DIP;
  if (isDip) return 3;
  if (slope >= RISE) return 2;
  if (slope <= FALL) return 4;
  if (mean < -1) return 3; // low and flat reads as a (half) third tone
  return 1; // high-ish and level
}

// Full pipeline: a voiced Hz contour + expected syllable count -> detected tones.
export function contourToTones(contourHz, count) {
  const voiced = voicedFrames(contourHz);
  if (!voiced.length || count <= 0) return [];
  const ref = median(voiced);
  const semis = voiced.map((hz) => hzToSemitones(hz, ref));
  return evenSplit(semis, count).map(classifyTone);
}

// Align detected tones against expected tones (same index). Neutral/unknown
// expected tones (0) are reported but excluded from scoring. Returns per-syllable
// results plus an overall accuracy in [0,1] over the scored syllables.
export function compareTones(detected, expected) {
  const perSyllable = expected.map((exp, i) => {
    const det = detected[i] ?? 0;
    const scored = exp !== 0;
    return {
      index: i,
      expected: exp,
      detected: det,
      scored,
      match: scored ? det !== 0 && det === exp : null,
    };
  });
  const scored = perSyllable.filter((p) => p.scored);
  const matches = scored.filter((p) => p.match).length;
  const total = scored.length;
  return { perSyllable, matches, total, accuracy: total ? matches / total : 0 };
}

// Map tone accuracy to the existing 1-10 grade scale.
export function accuracyToScore(accuracy) {
  return Math.min(10, Math.max(1, Math.round(accuracy * 10)));
}

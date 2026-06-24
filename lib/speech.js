// Browser text-to-speech so Lin Wei actually SPEAKS her Mandarin replies — the model
// pronunciation the learner imitates. Uses the Web Speech SpeechSynthesis API (free,
// no backend). The voice-picking logic is pure so it can be unit-tested.

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Choose the best available voice for a language tag. Prefer an exact lang match,
// then any voice sharing the base language (e.g. zh-* for zh-CN), else null.
export function pickVoice(voices, lang = "zh-CN") {
  if (!Array.isArray(voices) || !voices.length) return null;
  const norm = (s) => (s || "").toLowerCase().replace("_", "-");
  const want = norm(lang);
  const base = want.split("-")[0];
  return (
    voices.find((v) => norm(v.lang) === want) ||
    voices.find((v) => norm(v.lang).startsWith(base + "-")) ||
    voices.find((v) => norm(v.lang) === base) ||
    null
  );
}

let cachedVoices = [];
// Chrome garbage-collects an utterance that is only referenced locally, cutting the
// audio off before it starts. Holding the reference here is the documented fix.
let pinnedUtterance = null;

function refreshVoices() {
  try { cachedVoices = window.speechSynthesis.getVoices() || []; } catch { cachedVoices = []; }
}

// Voices load asynchronously in most browsers; call once on mount to warm the cache.
export function primeVoices() {
  if (!isSpeechSupported()) return;
  refreshVoices();
  try { window.speechSynthesis.onvoiceschanged = refreshVoices; } catch { /* noop */ }
}

// Call from within a real user gesture (a click/tap handler) to satisfy mobile/Chrome
// autoplay policy, so later auto-speaks (which happen after an await) are allowed.
export function unlockSpeech() {
  if (!isSpeechSupported()) return;
  try {
    refreshVoices();
    const synth = window.speechSynthesis;
    synth.resume();
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    pinnedUtterance = u;
    synth.speak(u);
  } catch { /* best-effort */ }
}

export function speak(text, { lang = "zh-CN", rate = 0.9 } = {}) {
  if (!isSpeechSupported() || !text) return;
  const synth = window.speechSynthesis;
  try {
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.volume = 1;
    const pool = cachedVoices.length ? cachedVoices : (synth.getVoices() || []);
    const v = pickVoice(pool, lang);
    if (v) u.voice = v;
    u.onend = () => { if (pinnedUtterance === u) pinnedUtterance = null; };
    pinnedUtterance = u; // pin the reference until it finishes (GC fix)
    synth.resume();
    synth.speak(u);
  } catch { /* speech is best-effort */ }
}

export function cancelSpeech() {
  if (!isSpeechSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* noop */ }
}

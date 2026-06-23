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

function refreshVoices() {
  try { cachedVoices = window.speechSynthesis.getVoices() || []; } catch { cachedVoices = []; }
}

// Voices load asynchronously in most browsers; call once on mount to warm the cache.
export function primeVoices() {
  if (!isSpeechSupported()) return;
  refreshVoices();
  try { window.speechSynthesis.onvoiceschanged = refreshVoices; } catch { /* noop */ }
}

export function speak(text, { lang = "zh-CN", rate = 0.9 } = {}) {
  if (!isSpeechSupported() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const pool = cachedVoices.length ? cachedVoices : (window.speechSynthesis.getVoices() || []);
    const v = pickVoice(pool, lang);
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch { /* speech is best-effort */ }
}

export function cancelSpeech() {
  if (!isSpeechSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* noop */ }
}

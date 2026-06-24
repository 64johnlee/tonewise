// Lin Wei's voice. Primary path: Google Cloud TTS (high-quality Mandarin) via the
// server /api/tts route, played through Web Audio. Fallback: the browser's built-in
// SpeechSynthesis if the cloud call fails. pickVoice is pure and unit-tested.

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

// ---- shared Web Audio context for cloud-MP3 playback ----
let playCtx = null;
let currentSource = null;

function getPlayCtx() {
  if (!playCtx && typeof window !== "undefined") {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) playCtx = new Ctx();
  }
  return playCtx;
}

async function playBase64Mp3(b64) {
  const ctx = getPlayCtx();
  if (!ctx) throw new Error("no AudioContext");
  if (ctx.state === "suspended") await ctx.resume();
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const buffer = await ctx.decodeAudioData(bytes.buffer);
  try { currentSource && currentSource.stop(); } catch { /* noop */ }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  currentSource = src;
}

// ---- browser SpeechSynthesis fallback ----
let cachedVoices = [];
let pinnedUtterance = null; // hold the reference so Chrome doesn't GC it mid-speech

function refreshVoices() {
  try { cachedVoices = window.speechSynthesis.getVoices() || []; } catch { cachedVoices = []; }
}

export function primeVoices() {
  if (!isSpeechSupported()) return;
  refreshVoices();
  try { window.speechSynthesis.onvoiceschanged = refreshVoices; } catch { /* noop */ }
}

function speakBrowser(text, { lang = "zh-CN", rate = 0.9 } = {}) {
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
    pinnedUtterance = u;
    synth.resume();
    synth.speak(u);
  } catch { /* best-effort */ }
}

// Call from within a real user gesture so later (post-await) playback is allowed by
// mobile/Chrome autoplay policy — warms both the AudioContext and SpeechSynthesis.
export function unlockSpeech() {
  try {
    const ctx = getPlayCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
  } catch { /* noop */ }
  if (isSpeechSupported()) {
    try {
      refreshVoices();
      window.speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      pinnedUtterance = u;
      window.speechSynthesis.speak(u);
    } catch { /* noop */ }
  }
}

// Cloud-first; falls back to the browser voice on any failure.
export async function speak(text, opts = {}) {
  if (!text) return;
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (r.ok) {
      const { audio } = await r.json();
      if (audio) { await playBase64Mp3(audio); return; }
    }
  } catch { /* fall through to browser voice */ }
  speakBrowser(text, opts);
}

export function cancelSpeech() {
  try { currentSource && currentSource.stop(); } catch { /* noop */ }
  currentSource = null;
  if (isSpeechSupported()) {
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  }
}

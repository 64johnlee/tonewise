// Google Cloud Text-to-Speech — Lin Wei's voice. Server-side so the service-account
// key never reaches the browser; reuses the same keyless OAuth token as Vertex
// (see google-auth.js), billed to the GCP credit. Returns base64-encoded MP3.
import { getGoogleAccessToken } from "./google-auth.js";

const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const DEFAULT_VOICE = process.env.TTS_VOICE?.trim() || "cmn-CN-Wavenet-A";
const DEFAULT_LANG = process.env.TTS_LANG?.trim() || "cmn-CN";
const DEFAULT_RATE = Number(process.env.TTS_RATE) || 0.92;

export async function synthesize(text, { voice = DEFAULT_VOICE, lang = DEFAULT_LANG, rate = DEFAULT_RATE } = {}) {
  const token = await getGoogleAccessToken();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: lang, name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate: rate },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.audioContent) throw new Error("TTS returned no audioContent");
  return data.audioContent; // base64 MP3
}

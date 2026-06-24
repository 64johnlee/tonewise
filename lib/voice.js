// Browser-only mic capture: streams the live pitch contour (Web Audio + the pure
// autoCorrelate detector) and the speech transcript (Web Speech API, zh-CN) for one
// spoken utterance. All testable DSP lives in lib/pitch.js; this file is thin glue.
import { autoCorrelate } from "./pitch.js";

export function isVoiceSupported() {
  if (typeof window === "undefined") return false;
  const hasMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  return hasMic && hasSR;
}

export function createRecorder() {
  let audioCtx;
  let analyser;
  let source;
  let stream;
  let rafId;
  let recognition;
  let onUpdate = null;
  const contour = [];
  let transcript = "";
  let finished = false;

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const loop = () => {
      analyser.getFloatTimeDomainData(buf);
      const hz = autoCorrelate(buf, audioCtx.sampleRate);
      contour.push(hz);
      if (onUpdate) onUpdate({ hz, contour });
      rafId = requestAnimationFrame(loop);
    };
    loop();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      transcript = t;
      if (onUpdate) onUpdate({ transcript, contour });
    };
    recognition.onend = () => { finished = true; };
    recognition.start();
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    try { recognition && recognition.stop(); } catch { /* already stopped */ }
    try { source && source.disconnect(); } catch { /* noop */ }
    try { stream && stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { audioCtx && audioCtx.close(); } catch { /* noop */ }

    // Give the recognizer a beat to emit its final result.
    return new Promise((resolve) => {
      const done = () => resolve({ transcript: transcript.trim(), contour: contour.slice() });
      if (finished) return done();
      setTimeout(done, 350);
    });
  }

  return {
    start,
    stop,
    set onUpdate(fn) { onUpdate = fn; },
  };
}

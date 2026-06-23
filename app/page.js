"use client";
import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { TOPICS } from "../lib/constants";
import { createRecorder, isVoiceSupported } from "../lib/voice.js";
import { analyzeUtterance } from "../lib/tone-analysis.js";
import { speak, cancelSpeech, primeVoices } from "../lib/speech.js";

const LEVELS = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"];

// SSR-safe client-capability read (server: false, client: real value) without a
// setState-in-effect / hydration mismatch.
const noopSubscribe = () => () => {};

function getUid() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("tt_uid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("tt_uid", id); }
  return id;
}

function Block({ title, items }) {
  if (!items || !items.length) return null;
  return (
    <div className="block"><div className="label">{title}</div>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

// Normalized pitch contour as an SVG sparkline (the learner's actual voice).
function PitchPlot({ contour }) {
  const pts = (contour || []).map((hz, i) => ({ i, hz })).filter((p) => p.hz > 0);
  if (pts.length < 2) return null;
  const hzs = pts.map((p) => p.hz);
  const min = Math.min(...hzs);
  const max = Math.max(...hzs);
  const W = 280;
  const H = 56;
  const pad = 6;
  const span = contour.length - 1 || 1;
  const x = (i) => pad + (i / span) * (W - 2 * pad);
  const y = (hz) => H - pad - ((hz - min) / ((max - min) || 1)) * (H - 2 * pad);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.hz).toFixed(1)}`).join(" ");
  return (
    <svg className="pitch" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-label="pitch contour">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Per-syllable tone result: green = produced the right tone, red = wrong.
function ToneChips({ syllables }) {
  if (!syllables || !syllables.length) return null;
  return (
    <div className="tones">
      {syllables.map((s, i) => (
        <span key={i} className={"tone " + (s.match === true ? "ok" : s.match === false ? "bad" : "neu")} title={s.pinyin}>
          {s.char}
          <sub>{s.detected || "·"}{s.scored ? `→${s.expected}` : ""}</sub>
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState("setup");
  const [topic, setTopic] = useState("restaurant");
  const [level, setLevel] = useState("HSK2");
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [paywall, setPaywall] = useState(false);
  const voiceOn = useSyncExternalStore(noopSubscribe, isVoiceSupported, () => false);
  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [livePitch, setLivePitch] = useState([]);
  const [speakOn, setSpeakOn] = useState(true);
  const endRef = useRef(null);
  const recRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { primeVoices(); return () => cancelSpeech(); }, []);

  async function start() {
    setLoading(true);
    try {
      const r = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, level, uid: getUid() }) });
      if (r.status === 402) { setPaywall(true); setLoading(false); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      setSession({ id: d.sessionId, openingZh: d.reply_zh });
      setMessages([{ who: "lin", zh: d.reply_zh, py: d.reply_pinyin, en: d.reply_en }]);
      setScreen("chat");
      if (speakOn) speak(d.reply_zh);
    } catch (e) { alert("Could not start: " + e.message); }
    setLoading(false);
  }

  async function postTurn(text, pronunciation, mine) {
    setMessages((m) => [...m, mine]);
    setLoading(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id, uid: getUid(), topic, level, openingZh: session.openingZh, message: text, pronunciation }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      setMessages((m) => [...m, { who: "lin", zh: d.reply_zh, py: d.reply_pinyin, en: d.reply_en, grade: d.grade }]);
      if (speakOn) speak(d.reply_zh);
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  }

  async function send() {
    const msg = input.trim();
    if (!msg || loading || !session) return;
    setInput("");
    await postTurn(msg, null, { who: "me", zh: msg });
  }

  async function startRec() {
    if (recording || loading || !session) return;
    cancelSpeech(); // don't let Lin Wei's voice bleed into the mic
    const rec = createRecorder();
    rec.onUpdate = ({ contour, transcript }) => {
      if (contour) setLivePitch([...contour]);
      if (transcript !== undefined) setLiveText(transcript);
    };
    try {
      setLiveText(""); setLivePitch([]);
      await rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e) { alert("Microphone unavailable: " + e.message); }
  }

  async function stopRec() {
    const rec = recRef.current;
    if (!rec) return;
    setRecording(false);
    const { transcript, contour } = await rec.stop();
    recRef.current = null;
    setLiveText(""); setLivePitch([]);
    if (!transcript) { alert("Didn't catch that — try speaking again."); return; }
    const a = analyzeUtterance(transcript, contour);
    const words = a.syllables.filter((s) => s.match === false).map((s) => s.char);
    const pronunciation = { score: a.score, accuracy: a.accuracy, matches: a.matches, total: a.total, syllables: a.syllables, errors: a.errors, words };
    await postTurn(transcript, pronunciation, { who: "me", zh: transcript, voice: { contour, syllables: a.syllables, score: a.score } });
  }

  async function end() {
    if (!session) return;
    setLoading(true);
    try {
      const r = await fetch("/api/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      setSummary(d); setScreen("summary");
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  }

  function reset() { setScreen("setup"); setSession(null); setMessages([]); setSummary(null); }

  return (
    <main className="wrap">
      <header className="nav">
        <span className="logo">🎙 ToneWise</span>
        <span className="navr">
          <button className="iconbtn" onClick={() => setSpeakOn((s) => { if (s) cancelSpeech(); return !s; })} title={speakOn ? "Mute Lin Wei" : "Unmute Lin Wei"}>{speakOn ? "🔊" : "🔇"}</button>
          <span className="badge">DynamoDB · Vercel</span>
        </span>
      </header>

      {screen === "setup" && (
        <section className="card">
          <h1>Practice Mandarin with real-time tone grading</h1>
          <p className="sub">Pick a scenario and your level, then talk to Lin Wei, an AI native speaker. Speak your reply and ToneWise measures your actual tones.</p>
          <div className="label">Scenario</div>
          <div className="chips">{TOPICS.map((t) => (<button key={t.id} className={"chip" + (topic === t.id ? " on" : "")} onClick={() => setTopic(t.id)}>{t.label}</button>))}</div>
          <div className="label">Level</div>
          <div className="chips">{LEVELS.map((l) => (<button key={l} className={"chip" + (level === l ? " on" : "")} onClick={() => setLevel(l)}>{l}</button>))}</div>
          <button className="primary" onClick={start} disabled={loading}>{loading ? "Connecting…" : "Start Conversation →"}</button>
        </section>
      )}

      {screen === "chat" && (
        <section className="card chat">
          <div className="msgs">
            {messages.map((m, i) => (
              <div key={i} className={"msg " + m.who}>
                <div className="zh">{m.zh}{m.who === "lin" && <button className="replay" onClick={() => speak(m.zh)} title="Hear it again">🔊</button>}</div>
                {m.py && <div className="py">{m.py}</div>}
                {m.en && <div className="en">{m.en}</div>}
                {m.voice && (
                  <div className="voicebox">
                    <PitchPlot contour={m.voice.contour} />
                    <ToneChips syllables={m.voice.syllables} />
                    <div className="vscore">🎯 Tone match: <b>{m.voice.score}/10</b></div>
                  </div>
                )}
                {m.grade && (
                  <div className={"grade s" + (m.grade.score >= 8 ? "hi" : m.grade.score >= 5 ? "mid" : "lo")}>
                    <b>Tone score: {m.grade.score}/10</b>
                    {m.grade.tone_errors?.length > 0 && <div>⚠ {m.grade.tone_errors.join("; ")}</div>}
                    {m.grade.suggestion && <div>💡 {m.grade.suggestion}</div>}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {recording && (
            <div className="reclive">
              <PitchPlot contour={livePitch} />
              <span className="rectext">{liveText || "Listening…"}</span>
            </div>
          )}

          <div className="inputrow">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={recording ? "Speaking…" : "Type in Mandarin…"} disabled={loading || recording} />
            {voiceOn && (
              <button className={"mic" + (recording ? " rec" : "")} onClick={recording ? stopRec : startRec} disabled={loading} title={recording ? "Stop & grade" : "Speak a short reply, then stop"}>
                {recording ? "■" : "🎤"}
              </button>
            )}
            <button className="send" onClick={send} disabled={loading || recording}>↑</button>
          </div>
          {!voiceOn && <div className="hint">🎤 Voice tone-grading needs Chrome or Edge. You can still type.</div>}
          {voiceOn && <div className="hint">🎤 Tap the mic, say a short reply in Mandarin, then tap ■ — ToneWise measures your actual pitch. (Experimental)</div>}

          <button className="link" onClick={end} disabled={loading}>Done? Get feedback →</button>
        </section>
      )}

      {screen === "summary" && summary && (
        <section className="card">
          <h1>Session Summary</h1>
          <div className="score">{summary.overall_score}/10</div>
          <Block title="Strengths" items={summary.strengths} />
          <Block title="Top mistakes" items={summary.top_mistakes} />
          <Block title="Vocab to review" items={summary.vocab_to_review} />
          {summary.next_focus && <p className="sub"><b>Next focus:</b> {summary.next_focus}</p>}
          <button className="primary" onClick={reset}>Practice again →</button>
        </section>
      )}

      {paywall && (
        <div className="overlay">
          <div className="card pw">
            <h2>You&apos;ve used your 3 free sessions 🎉</h2>
            <p className="sub">Subscribe for unlimited Mandarin practice with tone feedback.</p>
            <div className="score">$5<span>/mo</span></div>
            <button className="primary" onClick={() => alert("Wire your checkout (Lemon Squeezy / Stripe) here.")}>Subscribe →</button>
            <button className="link" onClick={() => setPaywall(false)}>Maybe later</button>
          </div>
        </div>
      )}
    </main>
  );
}

"use client";
import { useState, useRef, useEffect } from "react";
import { TOPICS } from "../lib/constants";

const LEVELS = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"];

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
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
    } catch (e) { alert("Could not start: " + e.message); }
    setLoading(false);
  }

  async function send() {
    const msg = input.trim();
    if (!msg || loading || !session) return;
    setInput("");
    setMessages((m) => [...m, { who: "me", zh: msg }]);
    setLoading(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id, uid: getUid(), topic, level, openingZh: session.openingZh, message: msg }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      setMessages((m) => [...m, { who: "lin", zh: d.reply_zh, py: d.reply_pinyin, en: d.reply_en, grade: d.grade }]);
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
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
      <header className="nav"><span className="logo">🎙 ToneWise</span><span className="badge">DynamoDB · Vercel</span></header>

      {screen === "setup" && (
        <section className="card">
          <h1>Practice Mandarin with real-time tone grading</h1>
          <p className="sub">Pick a scenario and your level, then talk to Lin Wei, an AI native speaker. Every reply is graded for tones.</p>
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
                <div className="zh">{m.zh}</div>
                {m.py && <div className="py">{m.py}</div>}
                {m.en && <div className="en">{m.en}</div>}
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
          <div className="inputrow">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type in Mandarin…" disabled={loading} />
            <button className="send" onClick={send} disabled={loading}>↑</button>
          </div>
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

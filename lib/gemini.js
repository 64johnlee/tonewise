const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function generateJSON(prompt, temperature = 0.7) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(`${ENDPOINT}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  try { return JSON.parse(text); }
  catch { const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; }
}

export async function getOpening(scenario, level) {
  const prompt = `You are Lin Wei, a friendly native Mandarin speaker.
Scenario: ${scenario}
Learner level: ${level}
Open the conversation with a natural first line IN Mandarin (as Lin Wei in this scenario).
Return ONLY JSON: {"reply_zh":"opening line in simplified Chinese","reply_pinyin":"pinyin with tone numbers","reply_en":"English translation"}`;
  const d = await generateJSON(prompt, 0.7);
  return { reply_zh: d.reply_zh || "你好！", reply_pinyin: d.reply_pinyin || "ni3 hao3!", reply_en: d.reply_en || "Hello!" };
}

export async function chatTurn(scenario, level, history, userMessage, openingZh = "") {
  const lines = [];
  if (openingZh) lines.push(`Lin Wei: ${openingZh}`);
  for (const t of history) { lines.push(`Learner: ${t.learner}`); lines.push(`Lin Wei: ${t.lin_wei}`); }
  const historyText = lines.length ? lines.join("\n") : "(start of conversation)";
  const prompt = `You are Lin Wei, a friendly native Mandarin speaker helping an English speaker practice. Always return valid JSON only.
Scenario: ${scenario}
Learner level: ${level}
Conversation so far:
${historyText}
Learner's latest message: "${userMessage}"
Grade the learner's message and continue the conversation naturally.
Return ONLY JSON:
{"reply_zh":"reply in simplified Chinese","reply_pinyin":"pinyin with tone numbers","reply_en":"English translation","grade":{"score":1-10,"correct":"what they got right (brief)","tone_errors":["said X should be Y"],"suggestion":"more natural phrasing or null"}}`;
  const d = await generateJSON(prompt, 0.7);
  const g = d.grade || {};
  const grade = g.score != null ? {
    score: Number(g.score) || 5,
    correct: g.correct || "",
    tone_errors: Array.isArray(g.tone_errors) ? g.tone_errors : [],
    suggestion: g.suggestion ?? null,
  } : null;
  return { reply_zh: d.reply_zh || "请继续。", reply_pinyin: d.reply_pinyin || "qing3 ji4xu4.", reply_en: d.reply_en || "Please continue.", grade };
}

export async function getSummary(history) {
  const historyText = history.map((t) => `Learner: ${t.learner}\nLin Wei: ${t.lin_wei}`).join("\n");
  const prompt = `Review this Mandarin practice session and return ONLY JSON:
{"overall_score":1-10,"strengths":["up to 3 things done well"],"top_mistakes":["up to 3 mistakes"],"vocab_to_review":["word: meaning"],"next_focus":"one sentence on what to practise next"}
Session:
${historyText}`;
  const d = await generateJSON(prompt, 0.3);
  return {
    overall_score: Number(d.overall_score) || 5,
    strengths: d.strengths || [],
    top_mistakes: d.top_mistakes || [],
    vocab_to_review: d.vocab_to_review || [],
    next_focus: d.next_focus || "Keep practising!",
  };
}

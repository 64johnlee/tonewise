import { NextResponse } from "next/server";
import { topicDesc, levelDesc, MAX_REVIEW_WORDS_PER_TURN } from "../../../lib/constants.js";
import { chatTurn } from "../../../lib/gemini.js";
import { getTurns, saveTurn, addReviewItems } from "../../../lib/dynamo.js";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { sessionId, uid, topic, level, openingZh, message, pronunciation } = await req.json();
    const text = typeof message === "string" ? message.trim() : "";
    if (!sessionId || !text) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    const history = await getTurns(sessionId);
    const out = await chatTurn(topicDesc(topic), levelDesc(level), history, text, openingZh, pronunciation);

    // When the learner spoke, the measured pitch analysis is the authoritative tone
    // grade; Gemini still supplies the conversational reply and a phrasing suggestion.
    const grade = pronunciation
      ? {
          score: pronunciation.score,
          correct: out.grade?.correct || "",
          tone_errors: Array.isArray(pronunciation.errors) ? pronunciation.errors : [],
          suggestion: out.grade?.suggestion ?? null,
        }
      : out.grade;

    await saveTurn(sessionId, history.length + 1, text, out.reply_zh, grade);

    // Enqueue the actually-mistoned characters (from measurement) when available.
    const reviewWords = Array.isArray(pronunciation?.words) && pronunciation.words.length
      ? pronunciation.words
      : grade?.tone_errors || [];
    if (uid && reviewWords.length) {
      await addReviewItems(uid, reviewWords.slice(0, MAX_REVIEW_WORDS_PER_TURN));
    }
    return NextResponse.json({ ...out, grade, turn: history.length + 1 });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

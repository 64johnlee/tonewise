import { NextResponse } from "next/server";
import { topicDesc, levelDesc, MAX_REVIEW_WORDS_PER_TURN } from "../../../lib/constants.js";
import { chatTurn } from "../../../lib/gemini.js";
import { getTurns, saveTurn, addReviewItems } from "../../../lib/dynamo.js";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { sessionId, uid, topic, level, openingZh, message } = await req.json();
    const text = typeof message === "string" ? message.trim() : "";
    if (!sessionId || !text) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    const history = await getTurns(sessionId);
    const out = await chatTurn(topicDesc(topic), levelDesc(level), history, text, openingZh);
    await saveTurn(sessionId, history.length + 1, text, out.reply_zh, out.grade);
    if (uid && out.grade?.tone_errors?.length) {
      const words = [...new Set(out.grade.tone_errors)].slice(0, MAX_REVIEW_WORDS_PER_TURN);
      await addReviewItems(uid, words);
    }
    return NextResponse.json({ ...out, turn: history.length + 1 });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

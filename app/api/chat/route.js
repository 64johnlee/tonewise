import { NextResponse } from "next/server";
import { topicDesc, HSK_LEVELS } from "../../../lib/constants.js";
import { chatTurn } from "../../../lib/gemini.js";
import { getTurns, saveTurn, addReviewItems } from "../../../lib/dynamo.js";

export async function POST(req) {
  try {
    const { sessionId, uid, topic, level, openingZh, message } = await req.json();
    if (!sessionId || !message) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    const history = await getTurns(sessionId);
    const out = await chatTurn(topicDesc(topic), HSK_LEVELS[level] || HSK_LEVELS.HSK2, history, message, openingZh);
    await saveTurn(sessionId, history.length + 1, message, out.reply_zh, out.grade);
    if (uid && out.grade?.tone_errors?.length) {
      await addReviewItems(uid, out.grade.tone_errors.slice(0, 5));
    }
    return NextResponse.json({ ...out, turn: history.length + 1 });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { topicDesc, HSK_LEVELS } from "../../../lib/constants.js";
import { getOpening } from "../../../lib/gemini.js";
import { consumeIfAllowed, createSession } from "../../../lib/dynamo.js";

export async function POST(req) {
  try {
    const { topic, level, uid } = await req.json();
    if (!uid) return NextResponse.json({ error: "missing uid" }, { status: 400 });
    const access = await consumeIfAllowed(uid);
    if (!access.allowed) return NextResponse.json({ error: "free_exhausted" }, { status: 402 });
    const opening = await getOpening(topicDesc(topic), HSK_LEVELS[level] || HSK_LEVELS.HSK2);
    const sessionId = randomUUID();
    await createSession(uid, sessionId, topic, level, opening.reply_zh);
    return NextResponse.json({ sessionId, ...opening, free_used: access.free_used });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

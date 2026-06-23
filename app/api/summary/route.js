import { NextResponse } from "next/server";
import { getSummary } from "../../../lib/gemini.js";
import { getTurns } from "../../../lib/dynamo.js";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "missing sessionId" }, { status: 400 });
    const history = await getTurns(sessionId);
    if (!history.length) return NextResponse.json({ error: "no turns" }, { status: 400 });
    const summary = await getSummary(history);
    return NextResponse.json({ ...summary, turns: history.length });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

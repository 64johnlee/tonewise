import { NextResponse } from "next/server";
import { synthesize } from "../../../lib/tts.js";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { text } = await req.json();
    const t = typeof text === "string" ? text.trim() : "";
    if (!t) return NextResponse.json({ error: "missing text" }, { status: 400 });
    const audio = await synthesize(t.slice(0, 500));
    return NextResponse.json({ audio });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the keyless auth so no real token is minted.
vi.mock("../lib/google-auth.js", () => ({
  getGoogleAccessToken: async () => "fake-token",
}));

import { getOpening, chatTurn, getSummary } from "../lib/gemini.js";

// Build a Vertex generateContent response whose single part holds `text`.
function vertexResponse(text) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => text,
  };
}

function mockFetchOnce(text) {
  global.fetch = vi.fn().mockResolvedValue(vertexResponse(text));
}

beforeEach(() => {
  // vertexUrl() needs a project id; the value is irrelevant since fetch is mocked.
  process.env.GCP_PROJECT_ID = "test-project";
  vi.restoreAllMocks();
});

describe("getOpening", () => {
  it("returns the parsed opening line", async () => {
    mockFetchOnce(JSON.stringify({ reply_zh: "你好", reply_pinyin: "ni3 hao3", reply_en: "Hi" }));
    const out = await getOpening("ordering food", "beginner");
    expect(out).toEqual({ reply_zh: "你好", reply_pinyin: "ni3 hao3", reply_en: "Hi" });
  });

  it("falls back to defaults when the model returns empty JSON", async () => {
    mockFetchOnce("{}");
    const out = await getOpening("ordering food", "beginner");
    expect(out.reply_zh).toBe("你好！");
    expect(out.reply_en).toBe("Hello!");
  });

  it("recovers JSON embedded in surrounding prose", async () => {
    mockFetchOnce('Sure! {"reply_zh":"早","reply_en":"Morning"} hope that helps');
    const out = await getOpening("greeting", "beginner");
    expect(out.reply_zh).toBe("早");
    expect(out.reply_en).toBe("Morning");
  });

  it("throws when Vertex returns a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    await expect(getOpening("x", "y")).rejects.toThrow(/Vertex error 500/);
  });
});

describe("chatTurn", () => {
  it("normalizes and clamps the grade", async () => {
    mockFetchOnce(JSON.stringify({
      reply_zh: "好的", reply_pinyin: "hao3 de", reply_en: "OK",
      grade: { score: 12, correct: "word order", tone_errors: ["said X want Y"], suggestion: null },
    }));
    const out = await chatTurn("restaurant", "beginner", [], "你好");
    expect(out.reply_zh).toBe("好的");
    expect(out.grade.score).toBe(10); // clamped from 12
    expect(out.grade.tone_errors).toEqual(["said X want Y"]);
  });

  it("coerces a non-array tone_errors to an empty array", async () => {
    mockFetchOnce(JSON.stringify({
      reply_zh: "对", grade: { score: 7, tone_errors: "oops" },
    }));
    const out = await chatTurn("restaurant", "beginner", [], "嗨");
    expect(out.grade.score).toBe(7);
    expect(out.grade.tone_errors).toEqual([]);
  });

  it("returns a null grade when the model omits a score", async () => {
    mockFetchOnce(JSON.stringify({ reply_zh: "继续" }));
    const out = await chatTurn("restaurant", "beginner", [{ learner: "a", lin_wei: "b" }], "嗨", "开场白");
    expect(out.grade).toBeNull();
    expect(out.reply_zh).toBe("继续");
  });
});

describe("getSummary", () => {
  it("clamps the overall score and defaults the arrays", async () => {
    mockFetchOnce(JSON.stringify({ overall_score: 99, next_focus: "tones" }));
    const out = await getSummary([{ learner: "a", lin_wei: "b" }]);
    expect(out.overall_score).toBe(10);
    expect(out.strengths).toEqual([]);
    expect(out.top_mistakes).toEqual([]);
    expect(out.next_focus).toBe("tones");
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../lib/google-auth.js", () => ({
  getGoogleAccessToken: async () => "fake-token",
}));

import { synthesize } from "../lib/tts.js";

beforeEach(() => { vi.restoreAllMocks(); });

describe("synthesize", () => {
  it("posts to the TTS endpoint and returns the base64 audio", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ audioContent: "QUJD" }),
    });
    global.fetch = fetchMock;

    const audio = await synthesize("你好");
    expect(audio).toBe("QUJD");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("texttospeech.googleapis.com");
    expect(init.headers.Authorization).toBe("Bearer fake-token");
    const body = JSON.parse(init.body);
    expect(body.input.text).toBe("你好");
    expect(body.voice.languageCode).toBe("cmn-CN");
    expect(body.audioConfig.audioEncoding).toBe("MP3");
  });

  it("throws on a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "denied" });
    await expect(synthesize("你好")).rejects.toThrow(/TTS 403/);
  });

  it("throws when no audio is returned", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(synthesize("你好")).rejects.toThrow(/no audioContent/);
  });
});

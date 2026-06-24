import { describe, it, expect } from "vitest";
import { pickVoice } from "../lib/speech.js";

const voices = [
  { name: "English US", lang: "en-US" },
  { name: "Chinese Mainland", lang: "zh-CN" },
  { name: "Chinese Taiwan", lang: "zh-TW" },
];

describe("pickVoice", () => {
  it("prefers an exact language match", () => {
    expect(pickVoice(voices, "zh-CN").name).toBe("Chinese Mainland");
  });

  it("falls back to a voice sharing the base language", () => {
    const onlyTW = [{ name: "TW", lang: "zh-TW" }, { name: "EN", lang: "en-US" }];
    expect(pickVoice(onlyTW, "zh-CN").name).toBe("TW");
  });

  it("normalizes underscore/case in lang tags", () => {
    const v = [{ name: "CN", lang: "ZH_CN" }];
    expect(pickVoice(v, "zh-CN").name).toBe("CN");
  });

  it("returns null when no language matches", () => {
    expect(pickVoice([{ name: "EN", lang: "en-US" }], "zh-CN")).toBeNull();
  });

  it("returns null for an empty or invalid voice list", () => {
    expect(pickVoice([], "zh-CN")).toBeNull();
    expect(pickVoice(null, "zh-CN")).toBeNull();
  });
});

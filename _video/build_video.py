"""Build the ToneWise 3-minute H0 demo video.

Pipeline: edge-tts narration -> measure durations -> Playwright records stage.html
(stepping scenes in sync with narration) -> ffmpeg muxes audio+video -> mp4.
Self-contained: run `python build_video.py`. Output: out/tonewise-demo.mp4
"""
from __future__ import annotations

import asyncio
import re
import subprocess
import sys
from pathlib import Path

import edge_tts
import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = "en-US-AndrewNeural"
PAD = 1.1  # seconds of silence after each narration segment

# (scene_index, narration)
SCENES = [
    (0, "In Mandarin, the tone is the word. Say the right syllable with the wrong tone, "
        "and shui jiao, dumplings, becomes shui jiao, sleep. Almost every learning app drills "
        "flashcards and never once corrects your tones in a real conversation. ToneWise fixes "
        "exactly that."),
    (1, "You pick a real scenario — ordering food, travelling, a work meeting — and your "
        "H.S.K. level. Then you have an actual back-and-forth with Lin Wei, an A.I. native "
        "speaker. After every reply you get a tone and grammar score, the specific tone errors "
        "it heard, pinyin, and a more natural phrasing. The words you keep getting wrong are "
        "queued for spaced repetition — so you drill your mistakes, not everyone's."),
    (2, "Here it is live. Restaurant scenario, H.S.K. two. Lin Wei opens, I order two "
        "dumplings and a tea, and the reply comes back graded — nine out of ten, tones clean, "
        "grammar correct. The conversation just keeps going, in character, in Mandarin."),
    (3, "Underneath, this is a deliberate DynamoDB single-table design. One table holds the "
        "user profile, every session, every turn, and every review item — each as its own item "
        "with a partition key and sort key. A global secondary index powers the what's-due "
        "review queue. One table, one query per access pattern."),
    (4, "The stack is keyless where it counts. Gemini two point five Flash, on Google Vertex "
        "A.I., grades the tones and plays Lin Wei — authenticated with a service-account token "
        "signed locally, no static key in the request path. Data lives in DynamoDB, the whole "
        "thing is Next dot j.s. on Vercel. Front end in minutes, data on a production store."),
    (5, "ToneWise — practice real Mandarin and get your tones graded in real time. Live at "
        "tonewise dash topaz dot vercel dot app. Thanks for watching."),
]


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def mp3_duration(path: Path) -> float:
    r = run([FFMPEG, "-i", str(path)])
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", r.stderr)
    if not m:
        raise RuntimeError(f"no duration for {path}: {r.stderr[-300:]}")
    h, mm, ss = m.groups()
    return int(h) * 3600 + int(mm) * 60 + float(ss)


async def gen_narration() -> list[float]:
    """Generate per-scene mp3, return scene durations (narration + PAD)."""
    durs = []
    for idx, text in SCENES:
        mp3 = OUT / f"n{idx}.mp3"
        await edge_tts.Communicate(text, VOICE, rate="+3%").save(str(mp3))
        d = mp3_duration(mp3)
        durs.append(round(d + PAD, 3))
        print(f"  scene {idx}: narration {d:.1f}s -> scene {durs[-1]:.1f}s")
    return durs


def build_audio(durs: list[float]) -> Path:
    """Pad each narration to its scene duration, concat into one wav track."""
    segs = []
    for (idx, _), sd in zip(SCENES, durs):
        seg = OUT / f"seg{idx}.wav"
        run([FFMPEG, "-y", "-i", str(OUT / f"n{idx}.mp3"),
             "-af", "apad", "-t", f"{sd:.3f}", "-ar", "44100", "-ac", "2", str(seg)])
        segs.append(seg)
    listfile = OUT / "concat.txt"
    listfile.write_text("".join(f"file '{s.as_posix()}'\n" for s in segs), encoding="utf-8")
    audio = OUT / "narration.wav"
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
         "-c", "copy", str(audio)])
    return audio


def record_video(durs: list[float]) -> Path:
    from playwright.sync_api import sync_playwright
    url = (HERE / "stage.html").as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--force-color-profile=srgb"])
        ctx = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=str(OUT),
            record_video_size={"width": 1920, "height": 1080},
        )
        page = ctx.new_page()
        page.goto(url)
        page.wait_for_timeout(300)
        for (idx, _), sd in zip(SCENES, durs):
            page.evaluate(f"window.showScene({idx})")
            page.wait_for_timeout(int(sd * 1000))
        page.wait_for_timeout(200)
        vid = page.video.path()
        ctx.close()
        browser.close()
    return Path(vid)


def mux(video: Path, audio: Path) -> Path:
    out = OUT / "tonewise-demo.mp4"
    run([FFMPEG, "-y", "-i", str(video), "-i", str(audio),
         "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-pix_fmt", "yuv420p", "-r", "30",
         "-vf", "scale=1920:1080:flags=lanczos",
         "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)])
    return out


def main() -> int:
    print("1/4 narration (edge-tts)...")
    durs = asyncio.run(gen_narration())
    total = sum(durs)
    print(f"   total target: {total:.1f}s ({int(total//60)}:{int(total%60):02d})")
    print("2/4 audio track...")
    audio = build_audio(durs)
    print("3/4 recording stage (Playwright)...")
    video = record_video(durs)
    print(f"   raw video: {video.name}")
    print("4/4 mux -> mp4...")
    out = mux(video, audio)
    if out.exists() and out.stat().st_size > 0:
        d = mp3_duration(out)
        print(f"DONE: {out}  ({out.stat().st_size//1024} KB, {d:.1f}s)")
        return 0
    print("FAILED: no output")
    return 1


if __name__ == "__main__":
    sys.exit(main())

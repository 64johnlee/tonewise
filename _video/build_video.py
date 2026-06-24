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
VOICE_EN = "en-US-AndrewNeural"
VOICE_ZH = "zh-CN-XiaoxiaoNeural"  # Mandarin voice for the Chinese lines
PAD = 1.1  # seconds of silence after each scene
GAP = 0.34  # silence between narration parts within a scene

# (scene_index, parts) — each part is (lang, text); "zh" parts are spoken in Mandarin.
SCENES = [
    (0, [
        ("en", "In Mandarin, the tone is the word. Say the right syllable with the wrong tone, and"),
        ("zh", "水饺，"),
        ("en", "dumplings, becomes"),
        ("zh", "睡觉，"),
        ("en", "sleep. Almost every app drills flashcards but never actually hears your tones — and "
               "never lets you hear a native speaker say it back. ToneWise does both."),
    ]),
    (1, [
        ("en", "You pick a real scenario and your H.S.K. level. Then you speak your reply. ToneWise "
               "measures the actual pitch of your voice, scores every syllable's tone — green for "
               "right, red for wrong — and shows you your pitch curve. Then Lin Wei says it back in a "
               "natural native voice, so you can hear the target and try again. The tones you miss are "
               "queued for spaced repetition."),
    ]),
    (2, [
        ("en", "Here it is. I order two dumplings —"),
        ("zh", "我想要两个水饺。"),
        ("en", "ToneWise pulls the pitch out of my voice right in the browser, lines each syllable up "
               "against the correct tone, and grades it — nine out of ten, with the one tone it heard "
               "wrong flagged in red. Then Lin Wei replies, out loud —"),
        ("zh", "好的，一共两个水饺。"),
    ]),
    (3, [
        ("en", "Underneath, a deliberate DynamoDB single-table design — the user profile, every "
               "session, every graded turn, and the review items, each as its own item with a "
               "partition key and sort key. A global secondary index powers the what's-due review "
               "queue. One table, one query per access pattern."),
    ]),
    (4, [
        ("en", "The stack is keyless where it counts. Pitch detection runs in the browser with Web "
               "Audio. Gemini on Google Vertex A.I. plays Lin Wei, and Google Cloud Text-to-Speech "
               "gives her a Wavenet Mandarin voice — both authenticated with a locally signed "
               "service-account token, no static key. Data on DynamoDB, all on Vercel."),
    ]),
    (5, [
        ("en", "ToneWise — speak Mandarin, get your tones graded, and hear it done right. Live at "
               "tonewise dash topaz dot vercel dot app. Thanks for watching."),
    ]),
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


def make_silence(path: Path, dur: float) -> None:
    run([FFMPEG, "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
         "-t", f"{dur:.3f}", "-q:a", "9", str(path)])


async def gen_narration() -> list[float]:
    """Synthesize each scene (English narration + spoken Mandarin parts), concat into
    one per-scene mp3, and return scene durations (narration + PAD)."""
    durs = []
    sil = OUT / "_sil.mp3"
    make_silence(sil, GAP)
    for idx, parts in SCENES:
        part_files = []
        for j, (lang, text) in enumerate(parts):
            voice = VOICE_ZH if lang == "zh" else VOICE_EN
            rate = "+0%" if lang == "zh" else "+3%"
            mp3 = OUT / f"n{idx}_{j}.mp3"
            await edge_tts.Communicate(text, voice, rate=rate).save(str(mp3))
            part_files.append(mp3)

        scene_mp3 = OUT / f"n{idx}.mp3"
        if len(part_files) == 1:
            run([FFMPEG, "-y", "-i", str(part_files[0]), "-c", "copy", str(scene_mp3)])
        else:
            seq = []
            for k, f in enumerate(part_files):
                if k:
                    seq.append(sil)
                seq.append(f)
            inputs = []
            for f in seq:
                inputs += ["-i", str(f)]
            streams = "".join(f"[{i}:a]" for i in range(len(seq)))
            run([FFMPEG, "-y", *inputs, "-filter_complex",
                 f"{streams}concat=n={len(seq)}:v=0:a=1[a]", "-map", "[a]", str(scene_mp3)])

        d = mp3_duration(scene_mp3)
        durs.append(round(d + PAD, 3))
        print(f"  scene {idx}: {d:.1f}s -> scene {durs[-1]:.1f}s ({len(parts)} part(s))")
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

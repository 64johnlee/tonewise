"""CDP driver for the ToneWise H0 submission via the user's logged-in Edge.

Reuses the proven releaseiq flow (YouTube upload + Devpost create/fill/submit)
with ToneWise content. Connects to Edge over CDP at 127.0.0.1:9222.

Usage: python cdp.py <command> [arg]
  probe                 - check YouTube Studio + Devpost login
  shot_arch             - render docs/architecture.html -> docs/architecture.png
  aws_shot              - screenshot DynamoDB console (table tonewise) + Vercel
  upload                - upload tonewise-demo.mp4 to YouTube (PUBLIC), print link
  verify <id>           - open the watch page for a video id
  dp_create             - create a new Devpost project under the H0 hackathon
  dp_overview <subid>   - fill name + tagline + thumbnail
  dp_details <subid> <videourl>  - fill About + live url + tags + gallery + video
  dp_addinfo_inspect <subid>
"""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
DOCS = HERE.parent / "docs"
CDP = "http://127.0.0.1:9222"

VIDEO = OUT / "tonewise-demo.mp4"
ARCH_HTML = DOCS / "architecture.html"
ARCH_PNG = DOCS / "architecture.png"
LIVE_URL = "https://tonewise-topaz.vercel.app"
REPO_URL = "https://github.com/64johnlee/tonewise"
TEAM_ID = "team_sEqStNiZyvnebztGeaAFNUCp"

TITLE = "ToneWise — Speak Mandarin & get your tones graded by ear | H0 Hackathon"
DESC = (
    "ToneWise actually listens to your tones. You speak a reply in Mandarin; it pulls the "
    "pitch (F0) out of your voice in the browser, scores every syllable's tone (green = "
    "right, red = wrong) against the correct pinyin, then Lin Wei says it back in a natural "
    "Wavenet voice so you can hear the target. Your misses go to a spaced-repetition queue.\n\n"
    "Live: " + LIVE_URL + "\n"
    "Code: " + REPO_URL + "\n\n"
    "Stack: Vercel + Next.js 16 + AWS DynamoDB (single-table design + GSI) + Web Audio pitch "
    "detection + Google Vertex AI (Gemini 2.5 Flash) + Google Cloud Text-to-Speech (Wavenet) "
    "— keyless service-account OAuth. Built for the H0: Hack the Zero Stack hackathon.\n\n"
    "#H0Hackathon"
)
TAGLINE = ("Practice real Mandarin conversations with an AI that grades your tones in real "
           "time — and drills your actual mistakes with spaced repetition.")
TAGS = ["Next.js", "Vercel", "Amazon DynamoDB", "AWS", "Google Vertex AI", "Gemini",
        "TypeScript", "React"]
ABOUT = """## Inspiration
The single biggest reason native speakers can't understand a Mandarin learner isn't grammar or vocabulary — it's **tones**. Say the right syllable with the wrong tone and 水饺 (*shuǐjiǎo*, "dumplings") becomes 睡觉 (*shuìjiào*, "sleep"). Yet almost every learning app drills flashcards and never corrects your tones in an actual conversation. ToneWise fixes exactly that gap.

## What it does
You pick a real-life scenario (ordering food, travel, a work meeting…) and your HSK level, then have an actual back-and-forth with **Lin Wei**, an AI native speaker. After every reply, ToneWise:
- **Grades your tones and grammar (1–10)** with the specific tone errors it heard
- Shows **pinyin + a more natural phrasing**
- Ends each session with a **summary** (strengths, top mistakes, vocab to review)
- Builds a **spaced-repetition review queue** from your *actual* tone mistakes, so you drill the things you personally get wrong

## Which AWS Database, and how I use it
**Amazon DynamoDB**, with a deliberate **single-table design** (table `tonewise`):

| Entity | PK | SK |
|---|---|---|
| User profile (plan, free_used, streak) | `USER#<uid>` | `PROFILE` |
| Session | `USER#<uid>` | `SESSION#<id>` |
| Graded turn | `SESSION#<id>` | `TURN#<n>` |
| Review item | `USER#<uid>` | `REVIEW#<word>` |

- A **Global Secondary Index (GSI1)** powers the "words due for review now" query — the heart of the spaced-repetition feature.
- Every tone error from grading **auto-enqueues** into the review queue: a real write-then-GSI-read access pattern, not just a stored flag.
- **Pay-per-request** billing means it scales to zero when idle and scales up automatically under load.

## How I built it
- **Frontend + API:** Next.js 16 (App Router) on **Vercel**, scaffolded with **v0**
- **Data:** **Amazon DynamoDB** via AWS SDK v3 (`@aws-sdk/lib-dynamodb`)
- **AI:** Google **Vertex AI — Gemini 2.5 Flash** for the opening line, per-turn tone+grammar grading, and the session summary (structured JSON). Authentication is **keyless**: a service-account JWT signed locally with Node crypto, exchanged for a short-lived OAuth token — no static API key in the request path.
- Three API route handlers — `/api/session`, `/api/chat`, `/api/summary` — orchestrate DynamoDB + Gemini

## Monetization (Track 1: B2C)
Free for 3 sessions, then a **$5/month** subscription for unlimited practice. Free-quota and subscription state live in the user's DynamoDB profile item, enforced server-side.

## Accomplishments I'm proud of
- A genuinely useful **tone-feedback loop** that turns each conversation into a personalized study plan.
- A **single-table DynamoDB model with a GSI** that does real work (the review queue), not just CRUD.
- A keyless path to the model provider, on a true zero-ops stack (Vercel + DynamoDB) that scales from one user to many without re-architecting.

## What I learned
DynamoDB **single-table modeling** and when a **GSI** is the right tool, the **v0 → Vercel** workflow for shipping a full-stack app fast, and how to make an LLM a dependable, structured backend component.

## What's next
**Voice** (speak your reply, hear Lin Wei via STT/TTS), leaderboards & streaks at scale, and more HSK content and additional languages.

**AWS Database used: Amazon DynamoDB (single-table design + GSI).** Live: """ + LIVE_URL


def get_ctx(p):
    b = p.chromium.connect_over_cdp(CDP)
    ctx = b.contexts[0] if b.contexts else b.new_context()
    return b, ctx


def _shot(pg, name):
    pg.screenshot(path=str(OUT / f"{name}.png"))
    print(f"  shot: {name}.png  url={pg.url}")


def probe():
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.goto("https://studio.youtube.com", wait_until="domcontentloaded", timeout=45000)
        pg.wait_for_timeout(4000)
        print(f"YOUTUBE url={pg.url} signed_in={'/channel/' in pg.url}")
        pg.goto("https://devpost.com/", wait_until="domcontentloaded", timeout=45000)
        pg.wait_for_timeout(3000)
        body = pg.content().lower()
        print(f"DEVPOST logged_in={'log out' in body or 'sign out' in body or 'my projects' in body}")
        pg.close()


def shot_arch():
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.set_viewport_size({"width": 1600, "height": 900})
        pg.goto(ARCH_HTML.as_uri(), wait_until="networkidle", timeout=30000)
        pg.wait_for_timeout(700)
        pg.screenshot(path=str(ARCH_PNG))
        print(f"  wrote {ARCH_PNG}  ({ARCH_PNG.stat().st_size//1024} KB)")
        pg.close()


def aws_shot():
    urls = [
        ("dynamodb_table", "https://ap-southeast-1.console.aws.amazon.com/dynamodbv2/home?region=ap-southeast-1#table?name=tonewise&tab=overview"),
        ("dynamodb_items", "https://ap-southeast-1.console.aws.amazon.com/dynamodbv2/home?region=ap-southeast-1#item-explorer?initialTagKey=&maximize=true&table=tonewise"),
    ]
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        for name, u in urls:
            try:
                pg.goto(u, wait_until="domcontentloaded", timeout=60000)
                pg.wait_for_timeout(7000)
                pg.screenshot(path=str(OUT / f"aws_{name}.png"))
                print(f"  shot aws_{name}.png  title={pg.title()[:60]}")
            except Exception as e:
                print(f"  {name} -> {e}")
        pg.close()


def upload():
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.set_default_timeout(60000)
        pg.goto("https://studio.youtube.com", wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(4000)
        try:
            pg.click("#create-icon", timeout=20000)
        except Exception:
            pg.click('ytcp-button:has-text("Create")', timeout=20000)
        pg.wait_for_timeout(1500)
        try:
            pg.click("#text-item-0", timeout=10000)
        except Exception:
            pg.click('tp-yt-paper-item:has-text("Upload videos")', timeout=10000)
        pg.wait_for_timeout(2500)
        pg.set_input_files('input[type="file"]', str(VIDEO))
        print("file set, waiting for details dialog...")
        pg.wait_for_timeout(8000)
        title_box = pg.locator('#title-textarea #textbox')
        title_box.wait_for(timeout=60000)
        title_box.click()
        pg.keyboard.press("Control+A")
        pg.keyboard.press("Delete")
        title_box.type(TITLE, delay=8)
        desc_box = pg.locator('#description-textarea #textbox')
        desc_box.click()
        desc_box.type(DESC, delay=2)
        pg.wait_for_timeout(800)
        try:
            pg.click('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]', timeout=8000)
        except Exception as e:
            print("  mfk radio:", e)
        _shot(pg, "yt_3_details")
        for i in range(3):
            try:
                pg.click("#next-button", timeout=15000)
                pg.wait_for_timeout(1800)
            except Exception as e:
                print(f"  next {i}:", e)
        try:
            pg.click('tp-yt-paper-radio-button[name="PUBLIC"]', timeout=15000)
        except Exception:
            pg.click('tp-yt-paper-radio-button:has-text("Public")', timeout=15000)
        pg.wait_for_timeout(1200)
        _shot(pg, "yt_5_public")
        try:
            pg.click("#done-button", timeout=20000)
        except Exception as e:
            print("  done-button:", e)
        pg.wait_for_timeout(7000)
        _shot(pg, "yt_6_published")
        link = ""
        try:
            link = pg.locator('a[href*="youtu.be"], a[href*="watch?v="]').first.get_attribute("href")
        except Exception:
            pass
        print(f"PUBLISHED link={link}")
        pg.wait_for_timeout(1500)
        pg.close()


def verify():
    vid = sys.argv[2] if len(sys.argv) > 2 else ""
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.goto(f"https://www.youtube.com/watch?v={vid}", wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(5000)
        pg.screenshot(path=str(OUT / "yt_verify.png"))
        print(f"WATCH url={pg.url} title={pg.title()}")
        pg.close()


# ---- Devpost ----------------------------------------------------------------
MANAGE = "https://devpost.com/submit-to/29812-h0-hack-the-zero-stack-with-vercel-v0-and-aws-databases/manage/submissions"
BASE = MANAGE


def dp_create():
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.goto(MANAGE, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(3500)
        pg.click('a:has-text("Create project"), button:has-text("Create project"), a:has-text("Create a new project")', timeout=20000)
        pg.wait_for_timeout(5000)
        print(f"editor url={pg.url} title={pg.title()}")
        _shot(pg, "dp_2_editor")
        pg.close()


def _subid():
    return sys.argv[2] if len(sys.argv) > 2 else ""


def dp_overview():
    sid = _subid()
    url = f"{BASE}/{sid}/project-overview"
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(3500)
        pg.fill("#participants_manage_project_overview_title", "ToneWise")
        pg.fill("#participants_manage_project_overview_tagline", TAGLINE)
        if ARCH_PNG.exists():
            try:
                pg.set_input_files("#software-thumbnail-file-input", str(ARCH_PNG))
                pg.wait_for_timeout(4000)
            except Exception as e:
                print("  thumb:", e)
        _shot(pg, "dp_3_overview_filled")
        saved = pg.evaluate("""() => {
          const b=[...document.querySelectorAll('input[type=submit],button[type=submit],button,a')]
            .find(x=>/save|continue/i.test((x.value||x.innerText||'').trim()));
          if(b){b.click();return (b.value||b.innerText||'').trim();} return false; }""")
        pg.wait_for_timeout(5000)
        print(f"saved={saved!r} after={pg.url}")
        fields = pg.evaluate("""() => {const o=[];document.querySelectorAll('input,textarea,select').forEach(e=>{if(e.type==='hidden'||e.type==='search')return;o.push({tag:e.tagName,type:e.type,id:e.id,name:e.name})});return o;}""")
        for f in fields[:50]:
            print(f)
        pg.close()


def dp_details():
    sid = _subid()
    url = f"{BASE}/{sid}/project_details/edit"
    video_url = sys.argv[3] if len(sys.argv) > 3 else ""
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(4000)
        pg.fill("#software_description", ABOUT)
        pg.fill("#software_urls_attributes_0_url", LIVE_URL)
        res = pg.evaluate("""(vals) => {
          const jq=window.jQuery||window.$; if(!jq) return 'NO-JQ';
          const $e=jq('#software_tag_list'); if(!$e.length) return 'NO-EL';
          try{ $e.select2('val', vals); return 'SET '+JSON.stringify($e.select2('val')); }
          catch(e){ $e.val(vals.join(',')).trigger('change'); return 'FB'; } }""", TAGS)
        print("  tags:", res)
        if ARCH_PNG.exists():
            try:
                pg.set_input_files("#software_photo_data", str(ARCH_PNG))
                pg.wait_for_timeout(4000)
            except Exception as e:
                print("  gallery:", e)
        if video_url:
            pg.fill("#software_video_url", video_url)
            pg.wait_for_timeout(8000)
        _shot(pg, "dp_5_details_filled")
        saved = pg.evaluate("""() => {
          const b=[...document.querySelectorAll('input[type=submit],button[type=submit],button')]
            .find(x=>/save\\s*&?\\s*continue|^save/i.test((x.value||x.innerText||'').trim()));
          if(b){b.click();return (b.value||b.innerText||'').trim();} return false; }""")
        pg.wait_for_timeout(10000)
        print(f"saved={saved!r} after={pg.url}")
        _shot(pg, "dp_6_after_details")
        pg.close()


def dp_addinfo_inspect():
    sid = _subid()
    url = f"{BASE}/{sid}/additional-info/edit"
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(4000)
        _shot(pg, "dp_addinfo")
        info = pg.evaluate("""() => {
          const out=[];
          document.querySelectorAll('input,textarea,select').forEach(e=>{
            if(e.type==='hidden'||e.type==='search') return;
            let lbl=''; if(e.labels&&e.labels[0]) lbl=e.labels[0].innerText;
            else { const fg=e.closest('.form-group,.field,fieldset,li,div'); if(fg){const l=fg.querySelector('label,legend,strong'); if(l) lbl=l.innerText;} }
            const opts = e.tagName==='SELECT' ? [...e.options].map(o=>o.text).slice(0,12) : undefined;
            out.push({tag:e.tagName,type:e.type||'',id:e.id||'',name:(e.name||'').slice(-40),
                      label:(lbl||'').replace(/\\n/g,' ').slice(0,70), opts});
          });
          return out;
        }""")
        for f in info:
            print(f)
        pg.close()


SEL_JS = """(args) => {
  const s=document.getElementById(args.id); if(!s) return 'NO-SELECT';
  const opt=[...s.options].find(o=>new RegExp(args.rx,'i').test(o.text));
  if(!opt) return 'NO-MATCH ['+[...s.options].map(o=>o.text).join(' | ')+']';
  s.value=opt.value; s.dispatchEvent(new Event('change',{bubbles:true}));
  return 'SET='+opt.text;
}"""

ARCH = str((DOCS / "architecture.png"))
DBPROOF = str((DOCS / "dynamodb-proof.png"))
TESTING = (
    "Live, no login required — open " + LIVE_URL + "\n"
    "1) Pick a scenario (e.g. Restaurant) and your HSK level, then click Start.\n"
    "2) Reply to Lin Wei in Mandarin, e.g. 你好，我想要两个水饺和一杯茶 (\"two dumplings and a tea\").\n"
    "3) Every reply is graded: tone+grammar score (1-10), the specific tone errors, pinyin, and a more natural phrasing.\n"
    "4) End the session to see the summary + the spaced-repetition review queue.\n"
    "Persistence: AWS DynamoDB single-table (region ap-southeast-1). AI grading: Google Vertex AI (Gemini 2.5 Flash)."
)
BONUS = ("GitHub repo: " + REPO_URL + "\n"
         "Architecture + DynamoDB single-table notes: see ARCHITECTURE.md in the repo.")


def _select2(pg, autogen_id, query):
    el = pg.locator(f"#{autogen_id}")
    el.click()
    el.type(query, delay=25)
    pg.wait_for_timeout(1600)
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(900)


def dp_addinfo():
    sid = _subid()
    url = f"{BASE}/{sid}/additional-info/edit"
    F = "participants_submission_requirements_submission_field_values_attributes_"
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(4000)
        print("submitter:", pg.evaluate(SEL_JS, {"id": F + "0_value", "rx": "^Individual$"}))
        print("appstatus:", pg.evaluate(SEL_JS, {"id": F + "3_value", "rx": "^New$"}))
        print("track:", pg.evaluate(SEL_JS, {"id": F + "6_value", "rx": "B2C"}))
        pg.fill(f"#{F}7_value", LIVE_URL)
        pg.fill(f"#{F}8_value", TEAM_ID)
        try:
            pg.fill(f"#{F}5_value", TESTING)
        except Exception as e:
            print("  testing:", e)
        try:
            pg.fill(f"#{F}12_value", BONUS)
        except Exception as e:
            print("  bonus:", e)
        try:
            _select2(pg, "s2id_autogen1", "Malaysia")
        except Exception as e:
            print("  country:", e)
        try:
            _select2(pg, "s2id_autogen2", "DynamoDB")
        except Exception as e:
            print("  database:", e)
        try:
            pg.set_input_files("#submission_field_file_27559_add_files", ARCH)
            pg.wait_for_timeout(3000)
            pg.set_input_files("#submission_field_file_27560_add_files", DBPROOF)
            pg.wait_for_timeout(3000)
        except Exception as e:
            print("  files:", e)
        _shot(pg, "dp_addinfo_filled")
        clicked = pg.evaluate("""() => {
          const b=[...document.querySelectorAll('input[type=submit],button[type=submit],button')]
            .find(x=>/save\\s*&?\\s*continue|^save/i.test((x.value||x.innerText||'').trim()));
          if(b){b.click();return (b.value||b.innerText||'').trim();} return false; }""")
        pg.wait_for_timeout(9000)
        print(f"saved={clicked!r} after={pg.url}")
        _shot(pg, "dp_after_addinfo")
        pg.close()


def dp_check():
    sid = _subid()
    url = f"{BASE}/{sid}/additional-info/edit"
    F = "participants_submission_requirements_submission_field_values_attributes_"
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(4000)
        out = pg.evaluate("""(F) => {
          const v=id=>{const s=document.getElementById(id);return s?(s.multiple?[...s.selectedOptions].map(o=>o.text):s.options[s.selectedIndex]?.text):'NO-EL';};
          const t=id=>{const e=document.getElementById(id);return e?e.value.slice(0,60):'NO-EL';};
          return {submitter:v(F+'0_value'), appstatus:v(F+'3_value'), track:v(F+'6_value'),
                  country:v(F+'1_values'), database:v(F+'9_values'),
                  vercel:t(F+'7_value'), team:t(F+'8_value'),
                  files:[...document.querySelectorAll('.file-name, .uploaded-file, a[href*="attachment"]')].map(e=>e.innerText||e.href).slice(0,6)};
        }""", F)
        for k, vv in out.items():
            print(f"  {k}: {vv}")
        pg.close()


def dp_submit():
    sid = _subid()
    url = f"{BASE}/{sid}/finalization"
    with sync_playwright() as p:
        b, ctx = get_ctx(p)
        pg = ctx.new_page()
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(4000)
        checked = pg.evaluate("""() => {
          const cb=[...document.querySelectorAll('input[type=checkbox]')]
            .find(c=>/agree|read|bound|terms|rules/i.test((c.closest('label,.form-group,div,li')||{}).innerText||''));
          if(cb){ if(!cb.checked) cb.click(); return cb.checked; } return 'no-checkbox'; }""")
        print(f"  tnc checked: {checked!r}")
        pg.wait_for_timeout(800)
        _shot(pg, "dp_pre_submit")
        clicked = pg.evaluate("""() => {
          const els=[...document.querySelectorAll('input[type=submit],button[type=submit],button,a.button')]
            .find(b=>/submit project|^submit/i.test((b.value||b.innerText||'').trim()));
          if(els){els.click();return (els.value||els.innerText||'').trim();} return false; }""")
        print(f"  submit click: {clicked!r}")
        pg.wait_for_timeout(9000)
        print(f"after-submit url={pg.url} title={pg.title()}")
        _shot(pg, "dp_submitted")
        try:
            link = pg.locator('a[href*="devpost.com/software/"]').first.get_attribute("href")
            print(f"PUBLIC project url={link}")
        except Exception:
            pass
        pg.close()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "probe"
    {"probe": probe, "shot_arch": shot_arch, "aws_shot": aws_shot, "upload": upload,
     "verify": verify, "dp_create": dp_create, "dp_overview": dp_overview,
     "dp_details": dp_details, "dp_addinfo_inspect": dp_addinfo_inspect,
     "dp_addinfo": dp_addinfo, "dp_check": dp_check, "dp_submit": dp_submit}.get(cmd, probe)()

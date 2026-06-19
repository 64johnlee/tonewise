# ToneWise — H0 Submission

**Tagline:** Practice real Mandarin conversations with an AI that grades your tones in real time.
**Track:** Monetizable B2C
**AWS Database used:** **Amazon DynamoDB**
**Live app:** _<your Vercel URL>_ · **Repo:** https://github.com/64johnlee/tonewise

---

## Inspiration
I'm a native Mandarin speaker and a voice actor. The single biggest reason native speakers can't understand a learner isn't grammar or vocabulary — it's **tones**. Say the right syllable with the wrong tone and 水饺 (*shuǐjiǎo*, "dumplings") becomes 睡觉 (*shuìjiào*, "sleep"). Yet almost every learning app drills flashcards and never corrects your tones in an actual conversation. I built ToneWise to fix exactly that gap.

## What it does
You pick a real-life scenario (ordering food, travel, a work meeting…) and your HSK level, then have an actual back-and-forth conversation with **Lin Wei**, an AI native speaker. After every reply, ToneWise:
- **Grades your tones and grammar** (1–10) with the specific tone errors it heard
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

- A **Global Secondary Index (GSI1: `REVIEW#<uid>` / `dueDate`)** powers the "words due for review now" query — the heart of the spaced-repetition feature.
- Every tone error from grading **auto-enqueues** into the review queue: a real write-then-GSI-read access pattern, not just a stored flag.
- **Pay-per-request** billing means it scales to zero when idle and scales up automatically under load.

See `ARCHITECTURE.md` for the full diagram.

## How I built it
- **Frontend + API:** Next.js (App Router) on **Vercel**, scaffolded with **v0**
- **Data:** **DynamoDB** via AWS SDK v3 (`@aws-sdk/lib-dynamodb`)
- **AI:** Google **Gemini 2.5 Flash** for the opening line, per-turn tone+grammar grading, and the session summary (structured JSON output)
- Three API route handlers — `/api/session`, `/api/chat`, `/api/summary` — orchestrate DynamoDB + Gemini

## Monetization (Track 1: B2C)
Free for 3 sessions, then a **$5/month** subscription for unlimited practice. Free-quota and subscription state live in the user's DynamoDB profile item, enforced server-side.

## Challenges
- Designing **one** DynamoDB table that cleanly serves chat history *and* a spaced-repetition queue — getting the PK/SK + GSI access patterns right up front.
- Prompt-engineering Gemini to return **reliable, structured** tone-grading JSON every turn.
- Keeping the whole thing serverless and fast on Vercel's runtime.

## Accomplishments I'm proud of
- A genuinely useful **tone-feedback loop** that turns each conversation into a personalized study plan.
- A **single-table DynamoDB model with a GSI** that does real work (the review queue), not just CRUD.
- Built on a true zero-ops stack — Vercel + DynamoDB — that could scale from one user to many without re-architecting.

## What I learned
- DynamoDB **single-table modeling** and when a **GSI** is the right tool.
- The **v0 → Vercel** workflow for shipping a full-stack app fast.
- How to make an LLM a dependable, structured backend component.

## What's next
- **Voice**: speak your reply, hear Lin Wei (STT/TTS).
- **Leaderboards & streaks** at scale (a natural DynamoDB fit).
- More HSK content and additional languages.

---
*Created for the H0: Hack the Zero Stack hackathon. #H0Hackathon*

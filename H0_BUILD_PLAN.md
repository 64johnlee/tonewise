# ToneTutor for H0 — Build Plan (Vercel + AWS DynamoDB)

**Hackathon:** H0 — Hack the Zero Stack (h01.devpost.com) · **Track 1: Monetizable B2C**
**Submission deadline:** Jun 29, 2026 5:00pm PDT (= Jun 30 8am GMT+8)
**⏰ Credit request deadline:** **Jun 26, 12pm PT** (do this first — free AWS + v0 credits)
**Strategy:** brand-new build on the required stack; **keep the live GCP ToneTutor untouched** (that's the XPRIZE entry). Reuse our *own* IP (prompts, design, grading logic); rebuild the shell.

## Required by the rules (checklist)
- [ ] Frontend deployed on **Vercel / v0.app**
- [ ] Uses **DynamoDB** (one of Aurora PG / Aurora DSQL / DynamoDB — DynamoDB is our pick)
- [ ] Text description naming the AWS Database used
- [ ] **<3-min demo video** (problem, who for, why; show it working; name the AWS DB)
- [ ] Published **Vercel project link + Vercel Team ID**
- [ ] **Architecture diagram** (frontend ↔ backend ↔ DynamoDB)
- [ ] **Screenshot proving AWS DB usage** (DynamoDB console with items)
- [ ] *Bonus:* a public blog/video on how you built it, with **#H0Hackathon**

## Stack (clean "Vercel + AWS" story = best architecture score)
- **App:** Next.js (App Router) on **Vercel**, scaffolded with **v0**
- **DB:** **AWS DynamoDB** (via AWS SDK v3 in Next.js API routes / route handlers)
- **LLM:** Gemini (reuse our prompts) called from API routes — fresh AI Studio key, or Vertex via SA creds in Vercel env. (LLM provider is unrestricted; only the DB must be AWS.)
- **Voice (optional / time-boxed):** client-side **Web Speech API** for STT (Chrome) + browser SpeechSynthesis or Google TTS. Text-first is the core; add voice only if ahead of schedule.

## DynamoDB data model — *this is what wins points*
H0 explicitly rewards a "deliberate data model." Our current app barely uses its DB; here we make it the star. **Single-table design**, table `tonetutor`:

| Entity | PK | SK | Key attributes |
|---|---|---|---|
| User profile | `USER#<uid>` | `PROFILE` | plan, streak, totalSessions, createdAt |
| Session | `USER#<uid>` | `SESSION#<ts>` | topic, level, score, summary |
| Turn | `SESSION#<sid>` | `TURN#<n>` | userText, grade, toneErrors, suggestion |
| Review item (spaced rep) | `USER#<uid>` | `REVIEW#<word>` | pinyin, mistakeCount, dueDate |
| Subscription | `USER#<uid>` | `SUB` | status, provider, since |

- **GSI1** (`dueDate`-keyed) → "words due for review" queries = a real, demoable DynamoDB access pattern.
- Demonstrates: write throughput (turns), item collections (session→turns), GSI (review queue), TTL (optional on old sessions). Great material for the architecture diagram + screenshot.

## Reuse from ToneTutor (don't reinvent)
- Gemini prompts: opening / **tone+grammar grading** / session summary (from `services/gemini.py`)
- Dark UI/UX + scenario + HSK 1–6 structure (have v0 regenerate a matching design, or port the CSS)
- Pinyin/tone rendering logic

## Build new
- Next.js project + v0-generated UI
- DynamoDB table + AWS SDK access layer
- API routes: `/api/session`, `/api/chat`, `/api/summary`, `/api/review`
- Monetization (Track 1): free tier (e.g. 3 sessions) + paid, tracked in DynamoDB, with a checkout (reuse Lemon Squeezy link, or Stripe test) — "monetizable" = clear, working path to pay
- Deploy to Vercel + wire env vars (AWS keys, Gemini key)

## Day-by-day (today Jun 19 → Jun 29)
- **Day 0 (Jun 19):** ⭐ Submit AWS + v0 **credit request form**. Create v0/Vercel + AWS accounts. Scaffold Next.js with v0. Create the DynamoDB table.
- **Day 1–2 (Jun 20–21):** DynamoDB access layer; port Gemini prompts into API routes; text chat working end-to-end (start → reply → grade → summary), persisting turns/sessions to DynamoDB.
- **Day 3–4 (Jun 22–23):** UI polish (match ToneTutor's dark design), pinyin + tone-grade display, session summary screen.
- **Day 5 (Jun 24):** Progress + **spaced-repetition review** (the GSI feature), streaks — the DynamoDB-rich differentiator.
- **Day 6 (Jun 25):** Monetization (pricing + checkout) + edge cases + mobile.
- **Day 7 (Jun 26):** (credits deadline already met) Deploy to Vercel, capture **AWS console screenshot**, draw **architecture diagram**.
- **Day 8 (Jun 27):** Record **<3-min demo video**; write the **bonus blog post** (#H0Hackathon).
- **Day 9 (Jun 28):** Full end-to-end test, bug fixes, write submission text (name DynamoDB), get Vercel Team ID.
- **Day 10 (Jun 29):** Submit **before 5pm PDT** with buffer.

## Risks / honesty notes
- **New stack learning curve** (Next.js/Vercel/DynamoDB/AWS SDK) — v0 + AWS docs mitigate; budget Day 0–1 for setup friction.
- **Don't let this sink the XPRIZE launch.** This is parallel; XPRIZE product is already live.
- **IP:** must be *solely yours* — fine, it's your project + your reused assets.
- **Originality scoring:** same idea as XPRIZE is allowed; the richer DynamoDB data model + review feature is how we "push the implementation forward."
- If time runs short: **cut voice first**, then review feature — protect a clean, shippable text-based core.

## First action (do now, costs nothing)
Submit the **AWS + v0 credit request form** from h01.devpost.com (deadline Jun 26 12pm PT) so resources are unlocked regardless.

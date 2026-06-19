# I built an AI that grades your Mandarin tones — on Vercel + DynamoDB in a week

> *I created this post for the purpose of entering the H0: Hack the Zero Stack hackathon.* **#H0Hackathon**

Say 水饺 (*shuǐjiǎo*, "dumplings") with the wrong tones and you've just told the waiter you want 睡觉 (*shuìjiào*, "to sleep"). I'm a native Mandarin speaker and voice actor, and after years of watching learners, I'm convinced of one thing: **tones are where Mandarin breaks down — and almost no app corrects them in a real conversation.**

So for H0 I built **[ToneWise](https://github.com/64johnlee/tonewise)**: pick a scenario and your HSK level, have an actual back-and-forth with an AI native speaker, and get your **tones graded after every reply** — with the mistakes funneled into a personalized review queue. Here's how I built it on the "zero stack": **Vercel + Amazon DynamoDB + Gemini**.

## The stack
- **Next.js (App Router) on Vercel** — UI + API route handlers, scaffolded with v0
- **Amazon DynamoDB** — all app data, single-table design
- **Gemini 2.5 Flash** — opening line, per-turn tone/grammar grading, session summary

No servers, no containers, no ops. Exactly the "zero stack" pitch.

## The interesting part: one DynamoDB table that does real work
The temptation is to spin up tables for users, sessions, messages… Instead I used a **single-table design**. Every entity lives in `tonewise`, distinguished by its `PK`/`SK`:

| Entity | PK | SK |
|---|---|---|
| User profile | `USER#<uid>` | `PROFILE` |
| Session | `USER#<uid>` | `SESSION#<id>` |
| Graded turn | `SESSION#<id>` | `TURN#<n>` |
| Review item | `USER#<uid>` | `REVIEW#<word>` |

Reading a whole conversation is one query:

```js
const r = await doc().send(new QueryCommand({
  TableName: TABLE,
  KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
  ExpressionAttributeValues: { ":p": `SESSION#${sessionId}`, ":s": "TURN#" },
}));
```

## The trick: a GSI that turns mistakes into a study plan
The feature I'm proudest of: every tone error Gemini catches gets **auto-enqueued** as a review item, and a **Global Secondary Index** answers "what should this learner review *now*?"

Write the review item (keyed for the GSI by `dueDate`):

```js
await doc().send(new UpdateCommand({
  TableName: TABLE,
  Key: { PK: `USER#${uid}`, SK: `REVIEW#${word}` },
  UpdateExpression:
    "SET mistakeCount = if_not_exists(mistakeCount,:z)+:one, dueDate=:d, word=:w, GSI1PK=:g, GSI1SK=:d",
  ExpressionAttributeValues: { ":z":0, ":one":1, ":d":now, ":w":word, ":g":`REVIEW#${uid}` },
}));
```

Then read everything due with one GSI query:

```js
const r = await doc().send(new QueryCommand({
  TableName: TABLE, IndexName: "GSI1",
  KeyConditionExpression: "GSI1PK = :g AND GSI1SK <= :now",
  ExpressionAttributeValues: { ":g": `REVIEW#${uid}`, ":now": new Date().toISOString() },
}));
```

That's spaced repetition, built from your *own* conversation mistakes, in a couple of DynamoDB calls. With **pay-per-request** billing it scales to zero when idle and up automatically under load.

## Making the LLM a dependable backend component
Gemini is asked to return **structured JSON** so grading is machine-usable, not prose:

```js
generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
```

Each turn comes back as `{ reply_zh, reply_pinyin, reply_en, grade: { score, tone_errors, suggestion } }`. The `tone_errors` array is exactly what feeds the DynamoDB review queue.

## Deploying on Vercel
Push to GitHub → import in Vercel → set five env vars (`AWS_REGION`, AWS keys, `DYNAMODB_TABLE`, `GEMINI_API_KEY`) → deploy. The API route handlers run serverless; DynamoDB is reached with AWS SDK v3. There was no "make it production-ready" step — that's the point of the stack.

## What I learned
- **Single-table DynamoDB design** is a mindset shift, but modeling access patterns *first* paid off — every screen is one query.
- A **GSI** is the right tool the moment you need "give me everything where X is true, sorted by time."
- An LLM is a fine backend dependency **if you force structured output**.

## Try it
ToneWise is open source: **https://github.com/64johnlee/tonewise**. If you're learning Mandarin, I'd love feedback on whether the tone feedback feels accurate — that's the part I care about most.

---
*Built solo for **#H0Hackathon** (H0: Hack the Zero Stack with Vercel v0 and AWS Databases). This post was created for the purpose of entering the hackathon.*

---

### Where to publish (pick 1–2)
- **dev.to** (best for dev audience), **Medium**, **LinkedIn**, or **builder.aws.com**
- Must be **public** (not unlisted), include the line "created for the purpose of entering this hackathon," and use **#H0Hackathon**
- After publishing, add the live URL to `SUBMISSION.md` and the Devpost entry

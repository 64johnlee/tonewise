# ToneTutor (H0 edition) — Vercel + AWS DynamoDB

AI Mandarin conversation tutor with real-time tone grading. Built for the **H0: Hack the Zero Stack** hackathon on **Vercel** + **Amazon DynamoDB**.

## Setup
1. `cp .env.example .env.local` and fill: AWS creds, `DYNAMODB_TABLE`, `GEMINI_API_KEY`
2. `npm install`
3. `npm run create-table`  (creates the DynamoDB table + GSI1)
4. `npm run dev`  → http://localhost:3000

## Deploy (Vercel)
Push to GitHub → import in Vercel → add the same env vars in Project Settings → deploy.

## Architecture
Next.js on **Vercel** → API route handlers → **Amazon DynamoDB** (single-table) + Gemini 2.5 Flash (tone grading).

## DynamoDB single-table design (table: `tonetutor`)
| Entity | PK | SK | Notes |
|---|---|---|---|
| User profile | `USER#<uid>` | `PROFILE` | plan, free_used, streak (monetization) |
| Session | `USER#<uid>` | `SESSION#<id>` | a practice session |
| Turn | `SESSION#<id>` | `TURN#<n>` | each graded reply |
| Review item | `USER#<uid>` | `REVIEW#<word>` | spaced-repetition; **GSI1** (`REVIEW#<uid>` / dueDate) powers "due for review" queries |

Tone errors from grading auto-populate the review queue — a real, demoable DynamoDB access pattern.

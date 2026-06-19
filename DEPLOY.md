# ToneWise — Deploy & Submit Runbook

Build is verified green (Next 16, `next build` passes). Remaining steps need your accounts.

## 1. AWS — create a DynamoDB access key
1. AWS Console → **IAM** → Users → Create user (e.g. `tonewise-app`) → **no console access**.
2. Attach an inline policy (least-privilege for this app):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["dynamodb:CreateTable", "dynamodb:DescribeTable"],
      "Resource": "arn:aws:dynamodb:*:*:table/tonewise" },
    { "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"],
      "Resource": ["arn:aws:dynamodb:*:*:table/tonewise", "arn:aws:dynamodb:*:*:table/tonewise/index/*"] }
  ]
}
```
3. Create an **access key** (type: Application running outside AWS) → copy the Access Key ID + Secret.
4. Pick your region (e.g. `us-east-1`, or `ap-southeast-1` Singapore for lower latency to Malaysia).

## 2. Gemini — get an API key
Google AI Studio → **Get API key** → create key. (Free tier is fine for the demo.)

## 3. Run locally (creates the table + real data for your AWS screenshot)
```bash
cd /home/user/tonetutor-h0
cp .env.example .env.local      # fill: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, DYNAMODB_TABLE=tonewise, GEMINI_API_KEY
npm install
npm run create-table            # provisions DynamoDB table 'tonewise' + GSI1
npm run dev                     # http://localhost:3000
```
Do a full run (Restaurant · HSK2 → chat a few turns → Get feedback). This writes real rows to DynamoDB — needed for the screenshot.

## 4. Deploy to Vercel
1. vercel.com → **Add New → Project** → import **github.com/64johnlee/tonewise**.
2. In **Settings → Environment Variables**, add the same 5 vars from `.env.local`.
3. Deploy. Copy your **production URL** + **Team ID** (Settings → General).
4. Re-run a session on the live URL so production also writes to DynamoDB.

## 5. Capture the required artifacts
- **AWS DB screenshot:** AWS Console → DynamoDB → Tables → `tonewise` → **Explore items** → screenshot showing real `USER#…`, `SESSION#…`, `TURN#…`, `REVIEW#…` rows.
- **Architecture diagram:** export PNG from `ARCHITECTURE.md` via mermaid.live.
- **Demo video (<3 min):** reuse the storyboard in the ToneTutor `DEMO_SCRIPT.md` (water-dumpling tone gag) — show it working, name **DynamoDB**, explain problem/who/why.
- **Vercel Team ID** (Settings → General).

## 6. Publish the bonus content
Publish `BLOG_POST.md` to dev.to / Medium / LinkedIn (public, keep the disclosure line + **#H0Hackathon**). Add the URL to `SUBMISSION.md`.

## 7. Submit on Devpost (h01.devpost.com) before Jun 29, 5pm PDT
Paste the text from `SUBMISSION.md` (fill the Vercel URL), attach video + diagram + AWS screenshot, add Vercel project link + Team ID, name **Amazon DynamoDB**, Track 1 (Monetizable B2C).

---
### What I can do for you
- Fix any error from `npm run dev` / `next build` (paste it).
- If you paste **temporary** AWS keys + a Gemini key, I can run `create-table` + a local smoke test from here and confirm rows land in DynamoDB (then rotate the keys after). Otherwise, run step 3 yourself and tell me what happens.

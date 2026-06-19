# ToneWise — Architecture

> GitHub renders the Mermaid diagrams below automatically. For the submission image, paste a block into **https://mermaid.live** and export PNG/SVG.

## System architecture

```mermaid
flowchart TD
    U["🧑 Learner (browser)"] -->|HTTPS| FE

    subgraph VERCEL["Vercel — Next.js (App Router)"]
      FE["React UI<br/>setup → chat → summary"]
      API1["API route: /api/session"]
      API2["API route: /api/chat"]
      API3["API route: /api/summary"]
      FE --> API1
      FE --> API2
      FE --> API3
    end

    subgraph AWS["Amazon Web Services"]
      DDB[("DynamoDB — single table 'tonewise'<br/>users · sessions · turns · review (GSI1)")]
    end

    subgraph GOOGLE["Google AI"]
      GEM["Gemini 2.5 Flash<br/>opening · tone + grammar grading · summary"]
    end

    API1 -->|"check free quota + create session"| DDB
    API1 -->|"generate opening line"| GEM
    API2 -->|"load history · save graded turn · enqueue review"| DDB
    API2 -->|"grade reply + continue"| GEM
    API3 -->|"load turns"| DDB
    API3 -->|"generate summary"| GEM
```

## DynamoDB single-table design (`tonewise`)

One table holds every entity type (single-table design); a GSI powers the spaced-repetition review queue.

| Access pattern | PK | SK | Index |
|---|---|---|---|
| Get/update user (plan, free_used, streak) | `USER#<uid>` | `PROFILE` | base table |
| List a user's sessions | `USER#<uid>` | `SESSION#<id>` | base table |
| Read all turns in a session | `SESSION#<id>` | `TURN#<n>` | base table |
| Words **due for review** (spaced repetition) | `USER#<uid>` | `REVIEW#<word>` | **GSI1** → `REVIEW#<uid>` / `dueDate` |

```mermaid
flowchart LR
    subgraph T["DynamoDB table: tonewise (PK / SK)"]
      P["USER#uid / PROFILE<br/>plan, free_used, streak"]
      S["USER#uid / SESSION#id<br/>topic, level"]
      TU["SESSION#id / TURN#n<br/>learner, reply, grade, toneErrors"]
      R["USER#uid / REVIEW#word<br/>mistakeCount, dueDate"]
    end
    R -->|"GSI1: REVIEW#uid / dueDate"| G[["GSI1<br/>due-for-review query"]]
```

- **Pay-per-request** billing → scales to zero, scales up automatically (fits the hackathon's "designed for scale" theme).
- Tone errors from each graded turn **auto-enqueue** into the review queue → a real, demoable DynamoDB write + GSI read pattern, not just a flag.

## Request flow — a chat turn
1. Browser `POST /api/chat`
2. `getTurns(sessionId)` ← **DynamoDB** (conversation history)
3. `chatTurn(...)` → **Gemini** (tone + grammar grade, reply)
4. `saveTurn(...)` + `addReviewItems(...)` → **DynamoDB** (persist turn, enqueue review words)
5. JSON response (reply + tone grade) → UI

## Proof artifacts for submission
- **This diagram** (export PNG from mermaid.live)
- **AWS DB screenshot:** AWS Console → DynamoDB → Tables → `tonewise` → *Explore items* (show real rows)
- **Vercel:** project URL + Team ID

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { FREE_LIMIT } from "./constants.js";

const TABLE = process.env.DYNAMODB_TABLE || "tonewise";
let _doc;
function doc() {
  if (!_doc) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
    _doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }
  return _doc;
}
const now = () => new Date().toISOString();
const profileKey = (uid) => ({ PK: `USER#${uid}`, SK: "PROFILE" });

// ---- access / monetization ----
export async function getStatus(uid) {
  const r = await doc().send(new GetCommand({ TableName: TABLE, Key: profileKey(uid) }));
  const u = r.Item || {};
  return { paid: !!u.paid, free_used: Number(u.free_used) || 0, free_limit: FREE_LIMIT, streak: Number(u.streak) || 0 };
}
export async function consumeIfAllowed(uid) {
  const s = await getStatus(uid);
  if (s.paid) return { allowed: true, ...s };
  if (s.free_used >= FREE_LIMIT) return { allowed: false, ...s };
  await doc().send(new UpdateCommand({
    TableName: TABLE, Key: profileKey(uid),
    UpdateExpression: "SET free_used = if_not_exists(free_used, :z) + :one, updatedAt = :t, createdAt = if_not_exists(createdAt, :t), #ty = :ty",
    ExpressionAttributeNames: { "#ty": "type" },
    ExpressionAttributeValues: { ":z": 0, ":one": 1, ":t": now(), ":ty": "user" },
  }));
  return { allowed: true, paid: false, free_used: s.free_used + 1, free_limit: FREE_LIMIT };
}
export async function markPaid(uid, ref) {
  await doc().send(new UpdateCommand({
    TableName: TABLE, Key: profileKey(uid),
    UpdateExpression: "SET paid = :p, provider_ref = :r, updatedAt = :t",
    ExpressionAttributeValues: { ":p": true, ":r": ref || null, ":t": now() },
  }));
}

// ---- sessions / turns ----
export async function createSession(uid, sessionId, topic, level, openingZh) {
  await doc().send(new PutCommand({ TableName: TABLE, Item: {
    PK: `USER#${uid}`, SK: `SESSION#${sessionId}`, type: "session",
    sessionId, topic, level, openingZh, createdAt: now(),
  }}));
}
export async function saveTurn(sessionId, n, learner, linWei, grade) {
  await doc().send(new PutCommand({ TableName: TABLE, Item: {
    PK: `SESSION#${sessionId}`, SK: `TURN#${String(n).padStart(4, "0")}`, type: "turn",
    learner, lin_wei: linWei, grade: grade || null, createdAt: now(),
  }}));
}
export async function getTurns(sessionId) {
  const r = await doc().send(new QueryCommand({
    TableName: TABLE, KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
    ExpressionAttributeValues: { ":p": `SESSION#${sessionId}`, ":s": "TURN#" },
  }));
  return (r.Items || []).map((i) => ({ learner: i.learner, lin_wei: i.lin_wei, grade: i.grade }));
}

// ---- spaced-repetition review queue (via GSI1) ----
export async function addReviewItems(uid, words) {
  const clean = [...new Set((words || []).map((w) => String(w).trim()).filter(Boolean))];
  const due = now();
  for (const w of clean) {
    await doc().send(new UpdateCommand({
      TableName: TABLE, Key: { PK: `USER#${uid}`, SK: `REVIEW#${w}` },
      UpdateExpression: "SET mistakeCount = if_not_exists(mistakeCount, :z) + :one, dueDate = :d, word = :w, GSI1PK = :g, GSI1SK = :d, #ty = :ty",
      ExpressionAttributeNames: { "#ty": "type" },
      ExpressionAttributeValues: { ":z": 0, ":one": 1, ":d": due, ":w": w, ":g": `REVIEW#${uid}`, ":ty": "review" },
    }));
  }
}
export async function getDueReviews(uid) {
  const r = await doc().send(new QueryCommand({
    TableName: TABLE, IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :g AND GSI1SK <= :now",
    ExpressionAttributeValues: { ":g": `REVIEW#${uid}`, ":now": now() },
  }));
  return (r.Items || []).map((i) => ({ word: i.word, mistakeCount: i.mistakeCount, dueDate: i.dueDate }));
}

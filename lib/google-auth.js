/**
 * Mints a short-lived Google Cloud OAuth2 access token from a service account
 * via the JWT-bearer grant (RFC 7523), signed locally with Node crypto.
 * Keyless in spirit: the only secret is the SA private key (env). Tokens are
 * cached in-process and reused until ~1 min before expiry.
 * (JS port of releaseiq/src/lib/agent/google-auth.ts.)
 */
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const ASSERTION_TTL_SECONDS = 3600;
const EXPIRY_SKEW_SECONDS = 60;

let cached = null;
let inFlight = null;

function serviceAccountFromEnv() {
  const clientEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!clientEmail || !rawKey) {
    throw new Error("GCP_SERVICE_ACCOUNT_EMAIL and GCP_SERVICE_ACCOUNT_PRIVATE_KEY must be set");
  }
  // env vars flatten newlines to literal "\n"; restore them so the PEM parses
  return { clientEmail, privateKey: rawKey.replace(/\\n/g, "\n") };
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function buildAssertion(sa, nowSeconds) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: sa.clientEmail, scope: SCOPE, aud: TOKEN_URL,
    iat: nowSeconds, exp: nowSeconds + ASSERTION_TTL_SECONDS,
  }));
  const signingInput = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(sa.privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

async function mintToken() {
  const sa = serviceAccountFromEnv();
  const nowMs = Date.now();
  const assertion = buildAssertion(sa, Math.floor(nowMs / 1000));
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: JWT_BEARER_GRANT, assertion }),
  });
  if (!res.ok) throw new Error(`Google token exchange ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("Google token exchange returned no access_token");
  const ttl = (data.expires_in ?? ASSERTION_TTL_SECONDS) - EXPIRY_SKEW_SECONDS;
  cached = { token: data.access_token, expiresAtMs: nowMs + ttl * 1000 };
  return cached.token;
}

export async function getGoogleAccessToken() {
  if (cached && cached.expiresAtMs > Date.now()) return cached.token;
  if (inFlight) return inFlight;
  inFlight = mintToken().finally(() => { inFlight = null; });
  return inFlight;
}

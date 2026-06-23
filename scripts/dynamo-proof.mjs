// Generates an authentic proof of the live DynamoDB table for the H0 submission:
// describes + scans table `tonewise` and renders docs/dynamodb-proof.html.
// Run: node scripts/dynamo-proof.mjs   (AWS_* + DYNAMODB_TABLE must be in env)
import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REGION = process.env.AWS_REGION || "ap-southeast-1";
const TableName = process.env.DYNAMODB_TABLE || "tonewise";
const base = new DynamoDBClient({ region: REGION });
const doc = DynamoDBDocumentClient.from(base);

const desc = (await base.send(new DescribeTableCommand({ TableName }))).Table;
const scan = await doc.send(new ScanCommand({ TableName }));
const items = (scan.Items || []).sort((a, b) =>
  (a.PK + a.SK).localeCompare(b.PK + b.SK));

const gsi = (desc.GlobalSecondaryIndexes || [])[0];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const entity = (it) => {
  if (it.SK === "PROFILE") return "User profile";
  if (String(it.SK).startsWith("SESSION#")) return "Session";
  if (String(it.SK).startsWith("TURN#")) return "Graded turn";
  if (String(it.SK).startsWith("REVIEW#")) return "Review item";
  return "—";
};
const extra = (it) => {
  const skip = new Set(["PK", "SK", "GSI1PK", "GSI1SK"]);
  return Object.keys(it).filter((k) => !skip.has(k))
    .map((k) => `${k}=${typeof it[k] === "object" ? JSON.stringify(it[k]) : it[k]}`)
    .join(" · ").slice(0, 120);
};

const rows = items.map((it) => `
  <tr>
    <td class="ent">${esc(entity(it))}</td>
    <td class="k">${esc(it.PK)}</td>
    <td class="sk">${esc(it.SK)}</td>
    <td class="x">${esc(extra(it))}</td>
  </tr>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--bg:#0c0a09;--panel:#16120f;--line:#332b27;--text:#f4ece6;--dim:#a89a90;
--gold:#e8b65a;--jade:#4fcf9a;--blue:#6aa6ff;--mono:"Cascadia Code",Consolas,monospace;
--sans:"Inter","Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1600px;background:var(--bg);color:var(--text);font-family:var(--sans);padding:48px 56px;-webkit-font-smoothing:antialiased}
.top{display:flex;align-items:center;gap:16px;margin-bottom:6px}
.badge{font-family:var(--mono);font-size:14px;background:rgba(232,182,90,.14);border:1px solid rgba(232,182,90,.45);color:var(--gold);border-radius:8px;padding:5px 11px}
h1{font-size:34px;font-weight:800}
.sub{color:var(--dim);font-size:18px;margin:4px 0 26px}
.meta{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:26px}
.chip{font-family:var(--mono);font-size:14px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.chip b{color:var(--jade)}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{border:1px solid var(--line);padding:11px 14px;text-align:left;vertical-align:top}
th{background:rgba(232,182,90,.1);color:var(--gold);font-size:13px;letter-spacing:.04em;text-transform:uppercase}
td.k{font-family:var(--mono);color:var(--blue)} td.sk{font-family:var(--mono);color:var(--gold)}
td.x{font-family:var(--mono);color:var(--dim);font-size:13px} td.ent{font-weight:600}
.foot{margin-top:22px;color:var(--dim);font-size:14px;font-family:var(--mono)}
</style></head><body>
  <div class="top"><span class="badge">AWS · Amazon DynamoDB</span><h1>Table <span style="font-family:var(--mono)">${esc(TableName)}</span> — live</h1></div>
  <div class="sub">Single-table design backing ToneWise · region ${esc(REGION)}</div>
  <div class="meta">
    <div class="chip">Status: <b>${esc(desc.TableStatus)}</b></div>
    <div class="chip">Billing: <b>${esc((desc.BillingModeSummary||{}).BillingMode||"PAY_PER_REQUEST")}</b></div>
    <div class="chip">Keys: <b>PK</b> (HASH) · <b>SK</b> (RANGE)</div>
    <div class="chip">Index: <b>${esc(gsi ? gsi.IndexName : "GSI1")}</b> (GSI1PK / GSI1SK)</div>
    <div class="chip">Items scanned: <b>${items.length}</b></div>
    <div class="chip">ARN: ${esc((desc.TableArn||"").replace(/:\d{12}:/, ":••••••••••••:"))}</div>
  </div>
  <table>
    <tr><th>Entity</th><th>PK (partition)</th><th>SK (sort)</th><th>attributes</th></tr>
    ${rows}
  </table>
  <div class="foot">DescribeTable + Scan via @aws-sdk/lib-dynamodb · account id redacted · generated for the H0 submission</div>
</body></html>`;

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "dynamodb-proof.html");
writeFileSync(out, html, "utf8");
console.log(`Table ${TableName} status=${desc.TableStatus} items=${items.length} -> docs/dynamodb-proof.html`);

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve("data/test-contest-api.sqlite");
fs.rmSync(dbPath, { force: true });
process.env.DATABASE_PATH = dbPath;
process.env.APP_ENV = "test";
process.env.CONTEST_CHECKINS_OPEN = "true";
process.env.CONTEST_START_AT = "2026-01-01T00:00:00.000Z";
process.env.CONTEST_END_AT = "2026-12-31T23:59:59.000Z";
process.env.CONTEST_SESSION_SECRET = "api-session-secret-more-than-thirty-two-characters";
process.env.ABUSE_HASH_SECRET = "api-abuse-secret-more-than-thirty-two-characters";
process.env.ADMIN_API_TOKEN = "api-admin-token-more-than-thirty-two-characters";
process.env.CONTEST_RATE_LIMIT_PER_IP = "1";

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(buffer) {
  let number = BigInt(`0x${buffer.toString("hex") || "0"}`), encoded = "";
  while (number > 0n) { encoded = alphabet[Number(number % 58n)] + encoded; number /= 58n; }
  for (const byte of buffer) { if (byte !== 0) break; encoded = `1${encoded}`; }
  return encoded || "1";
}

test("contest APIs validate, rate limit, hide abuse data, and protect admin routes", async () => {
  const address = encodeBase58(crypto.generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).subarray(-32));
  const { createServer } = await import("../src/web/server.js");
  const app = createServer({ contestBalanceFetcher: async () => ({ status: "verified", balanceRaw: "1000000000000", balanceUi: "1000000", decimals: 6, slot: 10, mint: "H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump", provider: "test" }) });
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const invalid = await fetch(`${base}/api/contest/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ walletAddress: "bad" }) });
    assert.equal(invalid.status, 400);
    const success = await fetch(`${base}/api/contest/check`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "first" }, body: JSON.stringify({ walletAddress: address }) });
    assert.equal(success.status, 200);
    const body = await success.json();
    assert.equal(body.entries, 1);
    assert.equal(body.ownershipStatus, "ownership_unverified");
    assert.equal(JSON.stringify(body).includes("abuse"), false);
    const limited = await fetch(`${base}/api/contest/check`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "second" }, body: JSON.stringify({ walletAddress: address }) });
    assert.equal(limited.status, 429);
    assert.equal((await fetch(`${base}/api/admin/contest/records`)).status, 401);
    const admin = await fetch(`${base}/api/admin/contest/records`, { headers: { authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` } });
    assert.equal(admin.status, 200);
    assert.equal((await admin.json()).records.length, 1);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

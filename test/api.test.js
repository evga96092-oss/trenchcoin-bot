import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("public API rejects malformed wallets and keeps leaderboard identifiers private", async () => {
  const dbPath = path.resolve("data/test-api.sqlite");
  fs.rmSync(dbPath, { force: true });
  process.env.DATABASE_PATH = dbPath;
  process.env.APP_ENV = "test";
  process.env.TRENCH_MINT = "H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump";
  const { ensureUser } = await import(`../src/db/index.js?api=${Date.now()}`);
  const { createServer } = await import(`../src/web/server.js?api=${Date.now()}`);
  ensureUser({ id: 123456789, username: null, first_name: null });
  const app = createServer();
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const invalid = await fetch(`${base}/api/wallet/challenge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ walletAddress: "bad" }) });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error, "invalid_wallet");
    const leaderboard = await (await fetch(`${base}/api/leaderboard`)).json();
    const serialized = JSON.stringify(leaderboard);
    assert.equal(serialized.includes("123456789"), false);
    assert.deepEqual(leaderboard.leaderboard, [], "unverified Telegram users are excluded from the official contest leaderboard");
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.staking.includes("preview"), true);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

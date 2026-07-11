import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(buffer) {
  let number = BigInt(`0x${buffer.toString("hex") || "0"}`);
  let encoded = "";
  while (number > 0n) { encoded = alphabet[Number(number % 58n)] + encoded; number /= 58n; }
  for (const byte of buffer) { if (byte !== 0) break; encoded = `1${encoded}`; }
  return encoded || "1";
}

test("wallet challenges are single use and verification XP is idempotent", async () => {
  const dbPath = path.resolve("data/test-identity.sqlite");
  fs.rmSync(dbPath, { force: true });
  process.env.DATABASE_PATH = dbPath;
  process.env.SOLANA_RPC_URL = "http://127.0.0.1:1";
  const { ensureUser, getUser, db } = await import(`../src/db/index.js?test=${Date.now()}`);
  const { createWalletChallenge, completeWalletChallenge, unlinkWallet, linkedStatus } = await import(`../src/services/identity.js?test=${Date.now()}`);
  ensureUser({ id: 777, username: "tester", first_name: "Test" });
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const address = encodeBase58(publicKey.export({ format: "der", type: "spki" }).subarray(-32));
  const challenge = createWalletChallenge(address, "777");
  const signature = encodeBase58(crypto.sign(null, Buffer.from(challenge.message), privateKey));
  const first = await completeWalletChallenge({ challengeId: challenge.challengeId, signature, telegramId: "777" });
  assert.equal(first.status, "verified");
  assert.equal(getUser("777").xp, 30);
  const replay = await completeWalletChallenge({ challengeId: challenge.challengeId, signature, telegramId: "777" });
  assert.equal(replay.error, "challenge_replayed");
  assert.equal(getUser("777").xp, 30);
  const invalid = createWalletChallenge(address, "777");
  const bad = await completeWalletChallenge({ challengeId: invalid.challengeId, signature: encodeBase58(Buffer.alloc(64)), telegramId: "777" });
  assert.equal(bad.error, "invalid_signature");
  const expired = createWalletChallenge(address, "777");
  db.prepare("UPDATE wallet_challenges SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(expired.challengeId);
  const expiredResult = await completeWalletChallenge({ challengeId: expired.challengeId, signature, telegramId: "777" });
  assert.equal(expiredResult.error, "challenge_expired");
  assert.equal(linkedStatus("777").wallet_address, address);
  assert.equal(unlinkWallet("777"), true);
  assert.equal(linkedStatus("777"), null);
  const referrer = getUser("777");
  ensureUser({ id: 888, username: "referred", first_name: "Referred" }, referrer.referral_code);
  assert.equal(getUser("888").xp, 0, "referral XP waits for verified wallet ownership");
  const pair2 = crypto.generateKeyPairSync("ed25519");
  const address2 = encodeBase58(pair2.publicKey.export({ format: "der", type: "spki" }).subarray(-32));
  const challenge2 = createWalletChallenge(address2, "888");
  const signature2 = encodeBase58(crypto.sign(null, Buffer.from(challenge2.message), pair2.privateKey));
  const verified2 = await completeWalletChallenge({ challengeId: challenge2.challengeId, signature: signature2, telegramId: "888" });
  assert.equal(verified2.status, "verified");
  assert.equal(getUser("888").xp, 45, "wallet and verified-referral XP awarded once");
  assert.equal(getUser("777").xp, 80, "referrer receives XP only after verification");
});

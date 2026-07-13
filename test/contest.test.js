import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve("data/test-contest.sqlite");
fs.rmSync(dbPath, { force: true });
process.env.DATABASE_PATH = dbPath;
process.env.APP_ENV = "test";
process.env.CONTEST_CHECKINS_OPEN = "true";
process.env.CONTEST_START_AT = "2026-01-01T00:00:00.000Z";
process.env.CONTEST_END_AT = "2026-12-31T23:59:59.000Z";
process.env.CONTEST_SESSION_SECRET = "contest-test-session-secret-more-than-32-characters";
process.env.ABUSE_HASH_SECRET = "contest-test-abuse-secret-more-than-32-characters";
process.env.ADMIN_API_TOKEN = "contest-test-admin-token-more-than-32-characters";

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(buffer) {
  let number = BigInt(`0x${buffer.toString("hex") || "0"}`);
  let encoded = "";
  while (number > 0n) { encoded = alphabet[Number(number % 58n)] + encoded; number /= 58n; }
  for (const byte of buffer) { if (byte !== 0) break; encoded = `1${encoded}`; }
  return encoded || "1";
}
const wallet = () => encodeBase58(crypto.generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).subarray(-32));
const mint = "H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump";
const live = (balanceRaw, decimals = 6) => ({ status: BigInt(balanceRaw) === 0n ? "zero_balance" : "verified", balanceRaw: String(balanceRaw), balanceUi: String(BigInt(balanceRaw) / (10n ** BigInt(decimals))), decimals, slot: 123, mint, provider: "test-rpc", checkedAt: "2026-07-13T10:00:00.000Z" });

const { db } = await import("../src/db/index.js");
const contest = await import("../src/services/contest.js");
const { isAdminAuthorized } = await import("../src/services/adminAuth.js");

test("entry calculation uses raw integers at every required boundary", () => {
  const cases = [
    ["0", 0],
    ["999999999999", 0],
    ["1000000000000", 1],
    ["1999999999999", 1],
    ["2000000000000", 2],
    ["10000000000000", 10],
    ["25000000000000", 10]
  ];
  for (const [raw, expected] of cases) assert.equal(contest.calculateEntries(raw, 6), expected);
  assert.equal(contest.calculateEntries("100000000", 2), 1, "decimal configuration changes the base-unit threshold");
});

test("contest checks reject a balance response for any mint other than the official configured mint", async () => {
  const result = await contest.checkContestWallet({ walletAddress: wallet(), balanceFetcher: async () => ({ ...live("1000000000000"), mint: wallet() }), now: new Date("2026-07-13T09:59:00Z") });
  assert.equal(result.error, "mint_mismatch");
});

test("current records upsert while check events remain append-only", async () => {
  const address = wallet();
  const first = await contest.checkContestWallet({ walletAddress: address, balanceFetcher: async () => live("4350000000000"), now: new Date("2026-07-13T10:00:00Z") });
  assert.equal(first.entries, 4);
  assert.equal(first.ownershipStatus, "ownership_unverified");
  assert.equal(first.eligibilityStatus, "ineligible");
  const second = await contest.checkContestWallet({ walletAddress: address, balanceFetcher: async () => live("4350000000000"), now: new Date("2026-07-13T10:01:00Z") });
  assert.equal(second.entries, 4, "repeated checks do not stack entries");
  const row = db.prepare("SELECT * FROM contest_wallets WHERE wallet_address=?").get(address);
  assert.equal(row.successful_checks, 2);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM contest_check_events WHERE wallet_address=?").get(address).count, 2);
  const event = db.prepare("SELECT id FROM contest_check_events WHERE wallet_address=? LIMIT 1").get(address);
  assert.throws(() => db.prepare("UPDATE contest_check_events SET request_status='changed' WHERE id=?").run(event.id), /append-only/);
});

test("ownership verification enables eligibility and stale failures preserve the last balance", async () => {
  const address = wallet();
  const verified = await contest.checkContestWallet({ walletAddress: address, ownershipVerified: true, method: "connected_wallet", balanceFetcher: async () => live("2000000000000"), now: new Date("2026-07-13T10:02:00Z") });
  assert.equal(verified.entries, 2);
  assert.equal(verified.eligibilityStatus, "eligible");
  const stale = await contest.checkContestWallet({ walletAddress: address, ownershipVerified: true, method: "connected_wallet", balanceFetcher: async () => ({ status: "rpc_timeout", failureCategory: "rpc_timeout", provider: "test-rpc" }), now: new Date("2026-07-13T10:03:00Z") });
  assert.equal(stale.stale, true);
  assert.equal(stale.balanceRaw, "2000000000000");
  assert.equal(stale.entries, 2);
  const row = db.prepare("SELECT * FROM contest_wallets WHERE wallet_address=?").get(address);
  assert.equal(row.failed_checks, 1);
  assert.equal(row.balance_raw, "2000000000000", "failed fetch must not overwrite a valid balance with zero");
});

test("official leaderboard excludes public lookups and sorts deterministically", async () => {
  const early = wallet();
  const late = wallet();
  const highest = wallet();
  const publicOnly = wallet();
  await contest.checkContestWallet({ walletAddress: early, ownershipVerified: true, method: "connected_wallet", balanceFetcher: async () => live("3000000000000"), now: new Date("2026-07-13T11:00:00Z") });
  await contest.checkContestWallet({ walletAddress: late, ownershipVerified: true, method: "connected_wallet", balanceFetcher: async () => live("3000000000000"), now: new Date("2026-07-13T11:01:00Z") });
  await contest.checkContestWallet({ walletAddress: highest, ownershipVerified: true, method: "connected_wallet", balanceFetcher: async () => live("4000000000000"), now: new Date("2026-07-13T11:02:00Z") });
  await contest.checkContestWallet({ walletAddress: publicOnly, ownershipVerified: false, balanceFetcher: async () => live("9000000000000"), now: new Date("2026-07-13T11:03:00Z") });
  const board = contest.getContestLeaderboard({ limit: 100 });
  const relevant = board.filter((row) => [contest.maskWalletAddress(early), contest.maskWalletAddress(late), contest.maskWalletAddress(highest), contest.maskWalletAddress(publicOnly)].includes(row.maskedWalletAddress));
  assert.equal(relevant[0].maskedWalletAddress, contest.maskWalletAddress(highest));
  assert.ok(relevant.findIndex((row) => row.maskedWalletAddress === contest.maskWalletAddress(early)) < relevant.findIndex((row) => row.maskedWalletAddress === contest.maskWalletAddress(late)));
  assert.equal(relevant.some((row) => row.maskedWalletAddress === contest.maskWalletAddress(publicOnly)), false);
  assert.match(relevant[0].maskedWalletAddress, /^[1-9A-HJ-NP-Za-km-z]{4}\.\.\.[1-9A-HJ-NP-Za-km-z]{4}$/);
  assert.equal(Object.hasOwn(relevant[0], "walletAddress"), false);
});

test("sessions, admin authorization, review actions, and CSV escaping are safe", async () => {
  const address = wallet();
  await contest.checkContestWallet({ walletAddress: address, ownershipVerified: true, method: "connected_wallet", balanceFetcher: async () => live("1000000000000"), now: new Date("2026-07-13T12:00:00Z") });
  const token = contest.createContestSession(address);
  assert.equal(contest.verifyContestSession(token).walletAddress, address);
  assert.equal(contest.verifyContestSession(`${token}x`), null);
  assert.equal(isAdminAuthorized("Bearer wrong"), false);
  assert.equal(isAdminAuthorized(`Bearer ${process.env.ADMIN_API_TOKEN}`), true);
  assert.deepEqual(contest.reviewContestWallet(address, { action: "disqualify", reason: "manual review decision" }), { ok: true });
  assert.equal(db.prepare("SELECT eligibility_status FROM contest_wallets WHERE wallet_address=?").get(address).eligibility_status, "disqualified");
  assert.deepEqual(contest.reviewContestWallet(address, { action: "restore", reason: "appeal accepted" }), { ok: true });
  const csv = contest.toCsv([{ wallet: "=formula", note: "quoted, value\nline" }]);
  assert.match(csv, /'=formula/);
  assert.match(csv, /"quoted, value\nline"/);
});

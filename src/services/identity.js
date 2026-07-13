import crypto from "node:crypto";
import { config } from "../config.js";
import { db, addXpOnce, activateReferralForUser } from "../db/index.js";
import { getTrenchBalance, verifyWalletSignature } from "./solana.js";
import { checkContestWallet, createContestSession } from "./contest.js";

export function createWalletChallenge(walletAddress, telegramId = null) {
  const id = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + config.challengeTtlMs);
  const message = [
    "Trenchcoin Wallet Verification",
    `Domain: ${new URL(config.publicBaseUrl).host}`,
    `Wallet: ${walletAddress}`,
    `Cluster: ${config.solanaCluster}`,
    "Action: Link wallet and read public $TRENCH balance",
    `Nonce: ${id}`,
    `Issued At: ${now.toISOString()}`,
    `Expiration Time: ${expires.toISOString()}`,
    "This signature does not authorize a transaction or spend funds."
  ].join("\n");
  const challengeHash = crypto.createHash("sha256").update(message).digest("hex");
  db.prepare("INSERT INTO wallet_challenges (id, wallet_address, telegram_id, challenge_text, challenge_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, walletAddress, telegramId ? String(telegramId) : null, message, challengeHash, expires.toISOString());
  return { challengeId: id, message, expiresAt: expires.toISOString(), cluster: config.solanaCluster };
}

export async function completeWalletChallenge({ challengeId, signature, telegramId = null, abuseIdentifier = null }) {
  const transaction = db.transaction(() => {
    const challenge = db.prepare("SELECT * FROM wallet_challenges WHERE id = ?").get(challengeId);
    if (!challenge) return { error: "challenge_not_found" };
    if (challenge.used_at) return { error: "challenge_replayed" };
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      db.prepare("UPDATE wallet_challenges SET verification_result='challenge_expired' WHERE id=?").run(challengeId);
      return { error: "challenge_expired" };
    }
    if (challenge.telegram_id && String(telegramId || "") !== challenge.telegram_id) return { error: "telegram_identity_mismatch" };
    if (!verifyWalletSignature(challenge.wallet_address, challenge.challenge_text, signature)) {
      db.prepare("UPDATE wallet_challenges SET used_at=CURRENT_TIMESTAMP,verification_result='invalid_signature' WHERE id=?").run(challengeId);
      const failures = db.prepare("SELECT COUNT(*) count FROM wallet_challenges WHERE wallet_address=? AND verification_result='invalid_signature' AND created_at >= datetime('now','-15 minutes')").get(challenge.wallet_address).count;
      if (failures >= 3) db.prepare("UPDATE contest_wallets SET manual_review=1,eligibility_status='manual_review',updated_at=CURRENT_TIMESTAMP WHERE wallet_address=? AND contest_id=?").run(challenge.wallet_address, config.contest.id);
      return { error: "invalid_signature" };
    }
    const existing = db.prepare("SELECT * FROM wallet_links WHERE wallet_address = ? AND unlinked_at IS NULL").get(challenge.wallet_address);
    if (existing?.telegram_id && telegramId && existing.telegram_id !== String(telegramId)) return { error: "wallet_already_linked", support: "Contact an administrator through the official Telegram." };
    const telegramExisting = telegramId ? db.prepare("SELECT wallet_address FROM wallet_links WHERE telegram_id=? AND unlinked_at IS NULL").get(String(telegramId)) : null;
    if (telegramExisting && telegramExisting.wallet_address !== challenge.wallet_address) return { error: "telegram_already_linked", support: "Unlink the current wallet before linking another." };
    db.prepare("UPDATE wallet_challenges SET used_at = CURRENT_TIMESTAMP,verification_result='ownership_verified' WHERE id = ? AND used_at IS NULL").run(challengeId);
    db.prepare(`INSERT INTO wallet_links (wallet_address, telegram_id, verified_at, unlinked_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, NULL)
      ON CONFLICT(wallet_address) DO UPDATE SET telegram_id=excluded.telegram_id, verified_at=CURRENT_TIMESTAMP, unlinked_at=NULL`)
      .run(challenge.wallet_address, telegramId ? String(telegramId) : null);
    return { walletAddress: challenge.wallet_address };
  });
  const verified = transaction();
  if (verified.error) return verified;
  const balance = await getTrenchBalance(verified.walletAddress);
  db.prepare("UPDATE wallet_links SET last_balance_raw=?, last_balance_ui=?, last_balance_slot=? WHERE wallet_address=?")
    .run(balance.balanceRaw || null, balance.balanceUi || null, balance.slot || null, verified.walletAddress);
  if (telegramId) {
    addXpOnce(String(telegramId), 30, "Wallet verified", `wallet_verified:${verified.walletAddress}`);
    activateReferralForUser(String(telegramId));
  }
  const contest = await checkContestWallet({ walletAddress: verified.walletAddress, method: "connected_wallet", ownershipVerified: true, balanceFetcher: async () => balance, abuseIdentifier });
  return { status: "verified", walletAddress: verified.walletAddress, balance, contest, contestSession: createContestSession(verified.walletAddress) };
}

export function unlinkWallet(telegramId) {
  const result = db.prepare("UPDATE wallet_links SET unlinked_at=CURRENT_TIMESTAMP, telegram_id=NULL WHERE telegram_id=? AND unlinked_at IS NULL").run(String(telegramId));
  return result.changes > 0;
}

export function linkedStatus(telegramId) {
  return db.prepare("SELECT wallet_address, verified_at, last_balance_ui, last_balance_slot FROM wallet_links WHERE telegram_id=? AND unlinked_at IS NULL").get(String(telegramId)) || null;
}

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";
import { INITIAL_MISSIONS, OFFICIAL } from "../constants.js";
import { schema } from "./schema.js";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);
db.exec(schema);

const missionInsert = db.prepare(`
  INSERT OR IGNORE INTO missions (id, title, description, points, verification_type)
  VALUES (?, ?, ?, ?, ?)
`);

for (const mission of INITIAL_MISSIONS) {
  missionInsert.run(...mission);
}

db.prepare(`
  INSERT OR IGNORE INTO raids (url, title, active)
  VALUES (?, 'Official X Raid', 1)
`).run(OFFICIAL.x);

function referralCodeFor(userId) {
  return crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 10).toUpperCase();
}

export function ensureUser(from, startPayload = "") {
  const telegramId = String(from.id);
  const existing = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId);
  if (existing) {
    db.prepare(`
      UPDATE users SET username = ?, first_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `).run(from.username || null, from.first_name || null, telegramId);
    return existing;
  }

  const referralCode = referralCodeFor(telegramId);
  const referrer = startPayload
    ? db.prepare("SELECT telegram_id FROM users WHERE referral_code = ?").get(startPayload.trim().toUpperCase())
    : null;

  db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, referral_code, referred_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(telegramId, from.username || null, from.first_name || null, referralCode, referrer?.telegram_id || null);

  if (referrer && referrer.telegram_id !== telegramId) {
    addReferral(referrer.telegram_id, telegramId, startPayload.trim().toUpperCase());
  }

  return db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId);
}

export function addXp(telegramId, amount, reason) {
  const id = String(telegramId);
  const points = Number(amount);
  db.prepare("UPDATE users SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?").run(points, id);
  db.prepare("INSERT INTO xp_events (telegram_id, amount, reason) VALUES (?, ?, ?)").run(id, points, reason);
}

export function addXpOnce(telegramId, amount, reason, eventKey) {
  const tx = db.transaction(() => {
    const inserted = db.prepare("INSERT OR IGNORE INTO audit_events (event_key, actor_type, actor_id, event_type, subject_id, details_json) VALUES (?, 'system', NULL, 'xp_award', ?, ?)")
      .run(eventKey, String(telegramId), JSON.stringify({ amount: Number(amount), reason }));
    if (!inserted.changes) return false;
    addXp(telegramId, amount, reason);
    return true;
  });
  return tx();
}

export function addReferral(referrerId, referredId, referralCode) {
  if (String(referrerId) === String(referredId)) return false;
  const exists = db.prepare("SELECT 1 FROM referrals WHERE referred_id = ?").get(String(referredId));
  if (exists) return false;

  db.prepare(`
    INSERT INTO referrals (referrer_id, referred_id, referral_code)
    VALUES (?, ?, ?)
  `).run(String(referrerId), String(referredId), referralCode);

  db.prepare("UPDATE users SET referral_count = referral_count + 1 WHERE telegram_id = ?").run(String(referrerId));
  return true;
}

export function activateReferralForUser(referredId) {
  const referral = db.prepare("SELECT * FROM referrals WHERE referred_id=?").get(String(referredId));
  if (!referral || referral.verified_at) return false;
  const tx = db.transaction(() => {
    db.prepare("UPDATE referrals SET verified_at=CURRENT_TIMESTAMP WHERE id=? AND verified_at IS NULL").run(referral.id);
    addXpOnce(referral.referrer_id, 50, "Verified referral bonus", `referral:referrer:${referredId}`);
    addXpOnce(referredId, 15, "Joined with verified referral", `referral:referred:${referredId}`);
  });
  tx();
  return true;
}

export function saveWallet(telegramId, walletAddress) {
  db.prepare(`
    INSERT INTO wallets (telegram_id, wallet_address, verification_status)
    VALUES (?, ?, 'pending')
    ON CONFLICT(telegram_id, wallet_address) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
  `).run(String(telegramId), walletAddress);
}

export function getUser(telegramId) {
  return db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(String(telegramId));
}

export function getMissionsForUser(telegramId) {
  const id = String(telegramId);
  db.prepare(`
    INSERT OR IGNORE INTO user_missions (telegram_id, mission_id)
    SELECT ?, id FROM missions WHERE active = 1
  `).run(id);
  return db.prepare(`
    SELECT m.id, m.title, m.description, m.points, m.verification_type, um.status
    FROM missions m
    JOIN user_missions um ON um.mission_id = m.id
    WHERE um.telegram_id = ? AND m.active = 1
    ORDER BY m.points ASC
  `).all(id);
}

export function getLeaderboard(limit = 10) {
  return db.prepare(`
    SELECT username, first_name, xp, referral_count, holder_status,
      'Trencher-' || substr(referral_code, 1, 6) AS fallback_alias
    FROM users
    ORDER BY xp DESC, referral_count DESC
    LIMIT ?
  `).all(limit);
}

export function deleteUserData(telegramId) {
  const id = String(telegramId);
  const tx = db.transaction(() => {
    db.prepare("UPDATE wallet_links SET telegram_id=NULL, unlinked_at=CURRENT_TIMESTAMP WHERE telegram_id=?").run(id);
    db.prepare("DELETE FROM users WHERE telegram_id=?").run(id);
    db.prepare("INSERT INTO audit_events (actor_type, actor_id, event_type, subject_id, details_json) VALUES ('user', NULL, 'privacy_deletion', NULL, '{}')").run();
  });
  tx();
}

export function getActiveRaid() {
  return db.prepare("SELECT * FROM raids WHERE active = 1 ORDER BY id DESC LIMIT 1").get();
}

export function setActiveRaid(url, adminId) {
  db.prepare("UPDATE raids SET active = 0 WHERE active = 1").run();
  db.prepare("INSERT INTO raids (url, title, active, created_by) VALUES (?, 'Current Raid', 1, ?)").run(url, String(adminId));
}

export function getStats() {
  return {
    users: db.prepare("SELECT COUNT(*) count FROM users").get().count,
    wallets: db.prepare("SELECT COUNT(*) count FROM wallets").get().count,
    referrals: db.prepare("SELECT COUNT(*) count FROM referrals").get().count,
    xpEvents: db.prepare("SELECT COUNT(*) count FROM xp_events").get().count
  };
}

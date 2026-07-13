import crypto from "node:crypto";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { getTrenchBalance, isValidSolanaAddress } from "./solana.js";

const SUCCESS_STATUSES = new Set(["verified", "zero_balance"]);

export function contestIsOpen(now = new Date()) {
  const { checkinsOpen, startAt, endAt } = config.contest;
  if (!checkinsOpen || !startAt || !endAt) return false;
  const time = now.getTime();
  return time >= new Date(startAt).getTime() && time <= new Date(endAt).getTime();
}

export function contestPublicConfig(now = new Date()) {
  return {
    id: config.contest.id,
    name: config.contest.name,
    startAt: config.contest.startAt,
    endAt: config.contest.endAt,
    checkinsOpen: contestIsOpen(now),
    awaitingDates: !config.contest.startAt || !config.contest.endAt,
    tokenMint: config.contest.tokenMint,
    tokensPerEntry: config.contest.tokensPerEntry,
    maxEntries: config.contest.maxEntries,
    ownershipRequired: config.contest.ownershipRequired,
    leaderboardPublic: config.contest.leaderboardPublic,
    walletsMasked: config.contest.maskWallets
  };
}

export function calculateEntries(balanceRaw, decimals, options = config.contest) {
  const raw = BigInt(balanceRaw);
  const unitRaw = BigInt(options.tokensPerEntry) * (10n ** BigInt(decimals));
  const calculated = raw / unitRaw;
  return Number(calculated > BigInt(options.maxEntries) ? BigInt(options.maxEntries) : calculated);
}

export function maskWalletAddress(address) {
  if (typeof address !== "string" || address.length < 9) return "Hidden";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function safeAbuseIdentifier(ipAddress) {
  if (!config.abuseHashSecret || !ipAddress) return null;
  const period = new Date().toISOString().slice(0, 7);
  return crypto.createHmac("sha256", config.abuseHashSecret).update(`${period}:${ipAddress}`).digest("hex");
}

function eligibilityFor({ ownershipStatus, entries, manualReview = 0, disqualified = 0 }) {
  if (disqualified) return "disqualified";
  if (manualReview) return "manual_review";
  const ownershipOk = !config.contest.ownershipRequired || ownershipStatus === "ownership_verified";
  return ownershipOk && entries > 0 ? "eligible" : "ineligible";
}

function publicRecord(row, { stale = false, rank = null } = {}) {
  if (!row) return null;
  return {
    walletAddress: row.wallet_address,
    maskedWalletAddress: maskWalletAddress(row.wallet_address),
    contestId: row.contest_id,
    tokenMint: row.token_mint,
    balanceRaw: row.balance_raw,
    balanceUi: row.balance_ui,
    tokenDecimals: row.token_decimals,
    entries: row.entry_count,
    maxEntries: config.contest.maxEntries,
    tokensPerEntry: config.contest.tokensPerEntry,
    ownershipStatus: row.ownership_status,
    eligibilityStatus: row.eligibility_status,
    checkedAt: row.last_checked_at,
    balanceFetchedAt: row.last_balance_fetch_at,
    verificationState: stale ? "stale" : "live",
    stale,
    rank
  };
}

function insertEvent(event) {
  db.prepare(`INSERT INTO contest_check_events (
    id,wallet_address,contest_id,checked_at,check_method,ownership_result,balance_raw,balance_ui,
    calculated_entries,provider,rpc_slot,request_status,failure_category,stale_fallback,
    processing_ms,rate_limit_result,abuse_identifier,app_version
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    event.id || crypto.randomUUID(), event.walletAddress || "invalid", config.contest.id,
    event.checkedAt || new Date().toISOString(), event.method || "public_lookup",
    event.ownershipResult || "ownership_unverified", event.balanceRaw ?? null, event.balanceUi ?? null,
    event.entries ?? null, event.provider ?? null, event.slot ?? null, event.requestStatus,
    event.failureCategory ?? null, event.stale ? 1 : 0, event.processingMs || 0,
    event.rateLimitResult || "allowed", event.abuseIdentifier ?? null, config.commitSha
  );
}

export function recordRejectedContestEvent({ walletAddress, method = "public_lookup", failureCategory, abuseIdentifier, rateLimitResult = "allowed" }) {
  insertEvent({ walletAddress, method, requestStatus: "failed", failureCategory, abuseIdentifier, rateLimitResult, processingMs: 0 });
}

export async function checkContestWallet({
  walletAddress,
  method = "public_lookup",
  ownershipVerified = false,
  balanceFetcher = getTrenchBalance,
  abuseIdentifier = null,
  rateLimitResult = "allowed",
  now = new Date(),
  allowClosed = false
}) {
  const started = Date.now();
  const checkedAt = now.toISOString();
  if (!isValidSolanaAddress(walletAddress)) {
    insertEvent({ walletAddress, method, requestStatus: "failed", failureCategory: "invalid_wallet", abuseIdentifier, rateLimitResult, checkedAt, processingMs: Date.now() - started });
    return { error: "invalid_wallet", statusCode: 400 };
  }
  if (!allowClosed && !contestIsOpen(now)) {
    insertEvent({ walletAddress, method, requestStatus: "failed", failureCategory: "contest_closed", abuseIdentifier, rateLimitResult, checkedAt, processingMs: Date.now() - started });
    return { error: "contest_closed", statusCode: 409, contest: contestPublicConfig(now) };
  }

  let balance;
  try { balance = await balanceFetcher(walletAddress); }
  catch (error) { balance = { status: "rpc_unavailable", failureCategory: "rpc_unavailable", provider: "Solana RPC", error: error.message }; }
  const existing = db.prepare("SELECT * FROM contest_wallets WHERE wallet_address=? AND contest_id=?").get(walletAddress, config.contest.id);
  if (!SUCCESS_STATUSES.has(balance.status)) {
    const failureCategory = balance.failureCategory || balance.status || "rpc_unavailable";
    const tx = db.transaction(() => {
      insertEvent({ walletAddress, method, ownershipResult: ownershipVerified ? "ownership_verified" : "ownership_unverified", requestStatus: "failed", failureCategory, stale: Boolean(existing), provider: balance.provider, abuseIdentifier, rateLimitResult, checkedAt, processingMs: Date.now() - started });
      if (existing) db.prepare("UPDATE contest_wallets SET failed_checks=failed_checks+1,last_checked_at=?,updated_at=?,app_version=? WHERE id=?").run(checkedAt, checkedAt, config.commitSha, existing.id);
    });
    tx();
    if (existing) return { ...publicRecord({ ...existing, last_checked_at: checkedAt }, { stale: true }), warning: failureCategory };
    return { error: failureCategory, statusCode: failureCategory === "rpc_rate_limited" ? 503 : 503 };
  }

  if (balance.mint !== config.contest.tokenMint) {
    insertEvent({ walletAddress, method, requestStatus: "failed", failureCategory: "mint_mismatch", provider: balance.provider, abuseIdentifier, rateLimitResult, checkedAt, processingMs: Date.now() - started });
    return { error: "mint_mismatch", statusCode: 503 };
  }
  const decimals = Number(balance.decimals);
  const entries = calculateEntries(balance.balanceRaw, decimals);
  const ownershipStatus = ownershipVerified || existing?.ownership_status === "ownership_verified" ? "ownership_verified" : "ownership_unverified";
  const eligibilityStatus = eligibilityFor({ ownershipStatus, entries, manualReview: existing?.manual_review, disqualified: existing?.disqualified });
  const verifiedAt = ownershipVerified ? checkedAt : existing?.last_ownership_verified_at || null;
  const recordId = existing?.id || crypto.randomUUID();
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO contest_wallets (
      id,wallet_address,contest_id,token_mint,balance_raw,token_decimals,balance_ui,entry_count,
      ownership_status,eligibility_status,first_checked_at,last_checked_at,last_balance_fetch_at,
      last_ownership_verified_at,successful_checks,failed_checks,provider,rpc_slot,balance_source_at,
      created_at,updated_at,manual_review,disqualified,review_notes,app_version
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?,?,?,?,0,0,NULL,?)
    ON CONFLICT(wallet_address,contest_id) DO UPDATE SET
      token_mint=excluded.token_mint,balance_raw=excluded.balance_raw,token_decimals=excluded.token_decimals,
      balance_ui=excluded.balance_ui,entry_count=excluded.entry_count,ownership_status=excluded.ownership_status,
      eligibility_status=CASE WHEN contest_wallets.disqualified=1 THEN 'disqualified' WHEN contest_wallets.manual_review=1 THEN 'manual_review' ELSE excluded.eligibility_status END,
      last_checked_at=excluded.last_checked_at,last_balance_fetch_at=excluded.last_balance_fetch_at,
      last_ownership_verified_at=COALESCE(excluded.last_ownership_verified_at,contest_wallets.last_ownership_verified_at),
      successful_checks=contest_wallets.successful_checks+1,provider=excluded.provider,rpc_slot=excluded.rpc_slot,
      balance_source_at=excluded.balance_source_at,updated_at=excluded.updated_at,app_version=excluded.app_version`).run(
        recordId,walletAddress,config.contest.id,config.contest.tokenMint,String(balance.balanceRaw),decimals,String(balance.balanceUi),entries,
        ownershipStatus,eligibilityStatus,existing?.first_checked_at || checkedAt,checkedAt,checkedAt,verifiedAt,
        balance.provider || "Solana RPC",balance.slot ?? null,balance.checkedAt || checkedAt,existing?.created_at || checkedAt,checkedAt,config.commitSha
      );
    insertEvent({ walletAddress, method, ownershipResult: ownershipStatus, balanceRaw: String(balance.balanceRaw), balanceUi: String(balance.balanceUi), entries, provider: balance.provider || "Solana RPC", slot: balance.slot, requestStatus: "success", abuseIdentifier, rateLimitResult, checkedAt, processingMs: Date.now() - started });
  });
  tx();
  return publicRecord(db.prepare("SELECT * FROM contest_wallets WHERE id=?").get(recordId));
}

export function getContestLeaderboard({ limit = 25, offset = 0 } = {}) {
  if (!config.contest.leaderboardPublic) return [];
  const rows = db.prepare(`SELECT * FROM contest_wallets
    WHERE contest_id=? AND eligibility_status='eligible' AND ownership_status='ownership_verified' AND disqualified=0
    ORDER BY entry_count DESC, length(balance_raw) DESC, balance_raw DESC, last_ownership_verified_at ASC
    LIMIT ? OFFSET ?`).all(config.contest.id, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0));
  return rows.map((row, index) => ({
    rank: offset + index + 1,
    maskedWalletAddress: maskWalletAddress(row.wallet_address),
    entries: row.entry_count,
    balanceTier: row.entry_count >= config.contest.maxEntries ? "maximum entry tier" : `${row.entry_count}-entry tier`,
    checkedAt: row.last_checked_at,
    verification: "ownership_verified"
  }));
}

export function getContestStatus(walletAddress, { includeRank = false } = {}) {
  const row = db.prepare("SELECT * FROM contest_wallets WHERE wallet_address=? AND contest_id=?").get(walletAddress, config.contest.id);
  if (!row) return null;
  let rank = null;
  if (includeRank && row.eligibility_status === "eligible") {
    rank = db.prepare(`SELECT COUNT(*) + 1 rank FROM contest_wallets WHERE contest_id=? AND eligibility_status='eligible' AND disqualified=0 AND (
      entry_count > ? OR (entry_count=? AND (length(balance_raw)>length(?) OR (length(balance_raw)=length(?) AND balance_raw>?))) OR
      (entry_count=? AND balance_raw=? AND last_ownership_verified_at < ?)
    )`).get(config.contest.id,row.entry_count,row.entry_count,row.balance_raw,row.balance_raw,row.balance_raw,row.entry_count,row.balance_raw,row.last_ownership_verified_at).rank;
  }
  return publicRecord(row, { rank });
}

export function createContestSession(walletAddress) {
  if (!config.contestSessionSecret) return null;
  const payload = Buffer.from(JSON.stringify({ walletAddress, contestId: config.contest.id, exp: Date.now() + 15 * 60_000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", config.contestSessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyContestSession(token) {
  if (!config.contestSessionSecret || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", config.contestSessionSecret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.exp > Date.now() && parsed.contestId === config.contest.id ? parsed : null;
  } catch { return null; }
}

export function listAdminContestRecords({ filter = "all", search = "", limit = 100, offset = 0 } = {}) {
  const clauses = ["contest_id=?"];
  const params = [config.contest.id];
  if (filter === "verified") clauses.push("ownership_status='ownership_verified'");
  if (filter === "unverified") clauses.push("ownership_status!='ownership_verified'");
  if (filter === "eligible") clauses.push("eligibility_status='eligible'");
  if (filter === "ineligible") clauses.push("eligibility_status='ineligible'");
  if (filter === "flagged") clauses.push("manual_review=1");
  if (filter === "disqualified") clauses.push("disqualified=1");
  if (search) { clauses.push("wallet_address LIKE ?"); params.push(`%${search}%`); }
  params.push(Math.min(Math.max(Number(limit) || 100, 1), 500), Math.max(Number(offset) || 0, 0));
  return db.prepare(`SELECT * FROM contest_wallets WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params);
}

export function getAdminWalletHistory(walletAddress, limit = 250) {
  return db.prepare("SELECT * FROM contest_check_events WHERE contest_id=? AND wallet_address=? ORDER BY checked_at DESC LIMIT ?").all(config.contest.id, walletAddress, Math.min(Number(limit) || 250, 1000));
}

export function reviewContestWallet(walletAddress, { action, reason }) {
  if (!reason?.trim()) return { error: "reason_required" };
  const row = db.prepare("SELECT * FROM contest_wallets WHERE contest_id=? AND wallet_address=?").get(config.contest.id, walletAddress);
  if (!row) return { error: "not_found" };
  let manualReview = row.manual_review;
  let disqualified = row.disqualified;
  if (action === "flag") manualReview = 1;
  else if (action === "clear_flag") manualReview = 0;
  else if (action === "disqualify") disqualified = 1;
  else if (action === "restore") disqualified = 0;
  else return { error: "invalid_action" };
  const eligibilityStatus = eligibilityFor({ ownershipStatus: row.ownership_status, entries: row.entry_count, manualReview, disqualified });
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("UPDATE contest_wallets SET manual_review=?,disqualified=?,eligibility_status=?,review_notes=?,updated_at=?,app_version=? WHERE id=?").run(manualReview,disqualified,eligibilityStatus,reason.trim(),now,config.commitSha,row.id);
    db.prepare("INSERT INTO contest_admin_events(id,contest_id,wallet_address,action,reason,created_at,app_version) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(),config.contest.id,walletAddress,action,reason.trim(),now,config.commitSha);
  });
  tx();
  return { ok: true };
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return `${columns.map(escape).join(",")}\r\n${rows.map((row) => columns.map((column) => escape(row[column])).join(",")).join("\r\n")}\r\n`;
}

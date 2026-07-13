export const schema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  referral_count INTEGER NOT NULL DEFAULT 0,
  holder_status TEXT NOT NULL DEFAULT 'Recruit',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  balance_raw TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (telegram_id, wallet_address),
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points INTEGER NOT NULL,
  verification_type TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_missions (
  telegram_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (telegram_id, mission_id),
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id TEXT NOT NULL,
  referred_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (referred_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS raids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Current Raid',
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_challenges (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  telegram_id TEXT,
  challenge_text TEXT NOT NULL,
  challenge_hash TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  verification_result TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_links (
  wallet_address TEXT PRIMARY KEY,
  telegram_id TEXT UNIQUE,
  verified_at TEXT NOT NULL,
  last_balance_raw TEXT,
  last_balance_ui TEXT,
  last_balance_slot INTEGER,
  leaderboard_opt_in INTEGER NOT NULL DEFAULT 1,
  unlinked_at TEXT,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT UNIQUE,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  event_type TEXT NOT NULL,
  subject_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_challenges_wallet ON wallet_challenges(wallet_address);
CREATE INDEX IF NOT EXISTS idx_audit_subject ON audit_events(subject_id, event_type);

CREATE TABLE IF NOT EXISTS contest_wallets (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  contest_id TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  balance_raw TEXT NOT NULL DEFAULT '0',
  token_decimals INTEGER NOT NULL,
  balance_ui TEXT NOT NULL DEFAULT '0',
  entry_count INTEGER NOT NULL DEFAULT 0 CHECK(entry_count BETWEEN 0 AND 100),
  ownership_status TEXT NOT NULL DEFAULT 'ownership_unverified',
  eligibility_status TEXT NOT NULL DEFAULT 'ineligible',
  first_checked_at TEXT NOT NULL,
  last_checked_at TEXT NOT NULL,
  last_balance_fetch_at TEXT,
  last_ownership_verified_at TEXT,
  successful_checks INTEGER NOT NULL DEFAULT 0,
  failed_checks INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  rpc_slot INTEGER,
  balance_source_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  manual_review INTEGER NOT NULL DEFAULT 0,
  disqualified INTEGER NOT NULL DEFAULT 0,
  review_notes TEXT,
  app_version TEXT,
  UNIQUE(wallet_address, contest_id)
);

CREATE TABLE IF NOT EXISTS contest_check_events (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  contest_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  check_method TEXT NOT NULL,
  ownership_result TEXT NOT NULL,
  balance_raw TEXT,
  balance_ui TEXT,
  calculated_entries INTEGER,
  provider TEXT,
  rpc_slot INTEGER,
  request_status TEXT NOT NULL,
  failure_category TEXT,
  stale_fallback INTEGER NOT NULL DEFAULT 0,
  processing_ms INTEGER NOT NULL,
  rate_limit_result TEXT NOT NULL,
  abuse_identifier TEXT,
  app_version TEXT
);

CREATE TABLE IF NOT EXISTS contest_admin_events (
  id TEXT PRIMARY KEY,
  contest_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  app_version TEXT
);

CREATE INDEX IF NOT EXISTS idx_contest_wallet_rank ON contest_wallets(contest_id, eligibility_status, disqualified, entry_count DESC, balance_raw DESC, last_ownership_verified_at ASC);
CREATE INDEX IF NOT EXISTS idx_contest_wallet_filter ON contest_wallets(contest_id, ownership_status, eligibility_status, manual_review, disqualified);
CREATE INDEX IF NOT EXISTS idx_contest_event_wallet ON contest_check_events(contest_id, wallet_address, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_contest_event_abuse ON contest_check_events(abuse_identifier, checked_at DESC);

CREATE TRIGGER IF NOT EXISTS contest_check_events_no_update
BEFORE UPDATE ON contest_check_events BEGIN SELECT RAISE(ABORT, 'contest check events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS contest_check_events_no_delete
BEFORE DELETE ON contest_check_events BEGIN SELECT RAISE(ABORT, 'contest check events are append-only'); END;
`;

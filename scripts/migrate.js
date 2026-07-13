import { db } from "../src/db/index.js";
db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
const migrations = [
  [1, "identity-security-baseline", () => db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_links_active_telegram ON wallet_links(telegram_id) WHERE telegram_id IS NOT NULL AND unlinked_at IS NULL")],
  [2, "challenge-expiration-index", () => db.exec("CREATE INDEX IF NOT EXISTS idx_challenges_expiry ON wallet_challenges(expires_at, used_at)")],
  [3, "audit-event-type-index", () => db.exec("CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_events(event_type, created_at)")]
  ,[4, "verified-referrals", () => {
    const columns = db.prepare("PRAGMA table_info(referrals)").all().map((row) => row.name);
    if (!columns.includes("verified_at")) db.exec("ALTER TABLE referrals ADD COLUMN verified_at TEXT");
  }]
  ,[5, "contest-wallet-tracking", () => {
    const columns = db.prepare("PRAGMA table_info(wallet_challenges)").all().map((row) => row.name);
    if (!columns.includes("verification_result")) db.exec("ALTER TABLE wallet_challenges ADD COLUMN verification_result TEXT");
    if (!columns.includes("challenge_hash")) db.exec("ALTER TABLE wallet_challenges ADD COLUMN challenge_hash TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_contest_wallet_rank_v5 ON contest_wallets(contest_id, eligibility_status, disqualified, entry_count DESC, last_ownership_verified_at ASC)");
  }]
];
const apply = db.transaction(() => {
  for (const [version, name, run] of migrations) {
    if (db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get(version)) continue;
    run();
    db.prepare("INSERT INTO schema_migrations(version,name) VALUES (?,?)").run(version, name);
  }
});
apply();
console.log(`Migrations current: ${migrations.length}`);

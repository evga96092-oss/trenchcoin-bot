import "dotenv/config";
import path from "node:path";

const parseAdminIds = (value = "") =>
  new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );

const parseOptionalDate = (value = "") => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
};

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  appEnv: process.env.APP_ENV || "local",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  adminIds: parseAdminIds(process.env.TELEGRAM_ADMIN_IDS),
  port: Number(process.env.PORT || 3000),
  databasePath: path.resolve(process.env.DATABASE_PATH || "./data/trenchcoin.sqlite"),
  publicBaseUrl: process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000",
  publicAppUrl: process.env.PUBLIC_APP_URL || "http://localhost:3000",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 10000),
  rateLimitMaxCommands: Number(process.env.RATE_LIMIT_MAX_COMMANDS || 8),
  solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  solanaCluster: process.env.SOLANA_CLUSTER || "mainnet-beta",
  trenchMint: process.env.TRENCH_MINT || "H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump",
  challengeTtlMs: Number(process.env.CHALLENGE_TTL_MS || 300000),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:3000,https://trenchcoinhq.netlify.app")
    .split(",").map((value) => value.trim()).filter(Boolean),
  marketDataApiUrl: process.env.MARKET_DATA_API_URL || "",
  holderProvider: (process.env.HOLDER_PROVIDER || "helius").toLowerCase(),
  heliusApiKey: process.env.HELIUS_API_KEY || "",
  holderCacheTtlMs: Number(process.env.HOLDER_CACHE_TTL_MS || 300000),
  telegramCacheTtlMs: Number(process.env.TELEGRAM_CACHE_TTL_MS || 300000),
  integrationTimeoutMs: Number(process.env.INTEGRATION_TIMEOUT_MS || 7000),
  commitSha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_REF || process.env.GIT_COMMIT_SHA || "unknown",
  stakingProgramId: process.env.STAKING_PROGRAM_ID || "",
  stakingEnabled: process.env.STAKING_ENABLED === "true",
  walletLinkingEnabled: process.env.WALLET_LINKING_ENABLED !== "false",
  telegramEnabled: process.env.TELEGRAM_ENABLED !== "false",
  logLevel: process.env.LOG_LEVEL || "info",
  contest: Object.freeze({
    id: process.env.CONTEST_ID || "trench-holdings-contest",
    name: process.env.CONTEST_NAME || "$TRENCH Holdings Contest",
    startAt: parseOptionalDate(process.env.CONTEST_START_AT),
    endAt: parseOptionalDate(process.env.CONTEST_END_AT),
    checkinsOpen: process.env.CONTEST_CHECKINS_OPEN === "true",
    tokenMint: process.env.CONTEST_TOKEN_MINT || process.env.TRENCH_MINT || "H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump",
    tokensPerEntry: process.env.CONTEST_TOKENS_PER_ENTRY || "1000000",
    maxEntries: Number(process.env.CONTEST_MAX_ENTRIES || 10),
    ownershipRequired: process.env.CONTEST_OWNERSHIP_REQUIRED !== "false",
    leaderboardPublic: process.env.CONTEST_LEADERBOARD_PUBLIC !== "false",
    maskWallets: process.env.CONTEST_MASK_WALLETS !== "false"
  }),
  adminApiToken: process.env.ADMIN_API_TOKEN || "",
  contestSessionSecret: process.env.CONTEST_SESSION_SECRET || "",
  abuseHashSecret: process.env.ABUSE_HASH_SECRET || "",
  contestRateLimitWindowMs: Number(process.env.CONTEST_RATE_LIMIT_WINDOW_MS || 60000),
  contestRateLimitPerIp: Number(process.env.CONTEST_RATE_LIMIT_PER_IP || 12),
  contestRateLimitPerWallet: Number(process.env.CONTEST_RATE_LIMIT_PER_WALLET || 6),
  abuseHashRetentionDays: Number(process.env.ABUSE_HASH_RETENTION_DAYS || 30)
};

export function validateConfig(candidate = config) {
  const errors = [];
  const contest = candidate.contest || config.contest;
  const environments = new Set(["local", "test", "devnet", "staging", "production"]);
  if (!environments.has(candidate.appEnv)) errors.push("APP_ENV must be local, test, devnet, staging, or production");
  for (const [name, value] of [["PUBLIC_APP_URL", candidate.publicAppUrl], ["BACKEND_PUBLIC_URL", candidate.publicBaseUrl]]) {
    try { new URL(value); } catch { errors.push(`${name} must be an absolute URL`); }
  }
  if (!candidate.allowedOrigins.length) errors.push("ALLOWED_ORIGINS must contain at least one exact origin");
  for (const origin of candidate.allowedOrigins) {
    try { if (new URL(origin).origin !== origin) errors.push(`ALLOWED_ORIGINS entry must be an exact origin: ${origin}`); }
    catch { errors.push(`Invalid ALLOWED_ORIGINS entry: ${origin}`); }
  }
  const validSolanaKey = (value) => {
    try {
      const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      let number = 0n;
      for (const char of value) { const index = alphabet.indexOf(char); if (index < 0) return false; number = number * 58n + BigInt(index); }
      let bytes = 0; while (number > 0n) { bytes += 1; number /= 256n; }
      for (const char of value) { if (char !== "1") break; bytes += 1; }
      return bytes === 32;
    } catch { return false; }
  };
  if (!validSolanaKey(candidate.trenchMint)) errors.push("TRENCH_MINT must be a valid Solana public key");
  if (candidate.stakingProgramId && !validSolanaKey(candidate.stakingProgramId)) errors.push("STAKING_PROGRAM_ID must be a valid Solana public key");
  if (candidate.appEnv === "staging" && candidate.solanaCluster !== "devnet") errors.push("Staging must use SOLANA_CLUSTER=devnet");
  if (candidate.appEnv === "production") {
    if (candidate.allowedOrigins.some((origin) => /localhost|127\.0\.0\.1/.test(origin))) errors.push("Production origins cannot include localhost");
    if (candidate.solanaCluster !== "mainnet-beta") errors.push("Production must use SOLANA_CLUSTER=mainnet-beta");
  }
  if (candidate.stakingEnabled) {
    errors.push("STAKING_ENABLED cannot be true: recovered source has no verified deployed program or IDL");
  }
  if (!validSolanaKey(contest.tokenMint)) errors.push("CONTEST_TOKEN_MINT must be a valid Solana public key");
  if (contest.tokenMint !== candidate.trenchMint) errors.push("CONTEST_TOKEN_MINT must match the official TRENCH_MINT");
  if (!/^\d+$/.test(contest.tokensPerEntry) || BigInt(contest.tokensPerEntry) <= 0n) errors.push("CONTEST_TOKENS_PER_ENTRY must be a positive whole-token integer");
  if (!Number.isInteger(contest.maxEntries) || contest.maxEntries < 1 || contest.maxEntries > 100) errors.push("CONTEST_MAX_ENTRIES must be an integer from 1 through 100");
  if (contest.startAt && Number.isNaN(new Date(contest.startAt).getTime())) errors.push("CONTEST_START_AT must be an ISO timestamp");
  if (contest.endAt && Number.isNaN(new Date(contest.endAt).getTime())) errors.push("CONTEST_END_AT must be an ISO timestamp");
  if (contest.startAt && contest.endAt && new Date(contest.startAt) >= new Date(contest.endAt)) errors.push("CONTEST_END_AT must be after CONTEST_START_AT");
  if (candidate.appEnv === "production" && contest.checkinsOpen) {
    if (!contest.startAt || !contest.endAt) errors.push("Open production contests require CONTEST_START_AT and CONTEST_END_AT");
    if (!(candidate.contestSessionSecret || config.contestSessionSecret) || (candidate.contestSessionSecret || config.contestSessionSecret).length < 32) errors.push("Open production contests require CONTEST_SESSION_SECRET with at least 32 characters");
    if (!(candidate.abuseHashSecret || config.abuseHashSecret) || (candidate.abuseHashSecret || config.abuseHashSecret).length < 32) errors.push("Open production contests require ABUSE_HASH_SECRET with at least 32 characters");
  }
  if (candidate.appEnv === "production" && candidate.adminApiToken && candidate.adminApiToken.length < 32) errors.push("ADMIN_API_TOKEN must contain at least 32 characters in production");
  return errors;
}

export function assertValidConfig(candidate = config) {
  const errors = validateConfig(candidate);
  if (errors.length) throw new Error(`Configuration invalid:\n- ${errors.join("\n- ")}`);
}

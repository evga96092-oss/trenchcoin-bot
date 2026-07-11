import "dotenv/config";
import path from "node:path";

const parseAdminIds = (value = "") =>
  new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  appEnv: process.env.APP_ENV || "local",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
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
  stakingProgramId: process.env.STAKING_PROGRAM_ID || "",
  stakingEnabled: process.env.STAKING_ENABLED === "true",
  walletLinkingEnabled: process.env.WALLET_LINKING_ENABLED !== "false",
  telegramEnabled: process.env.TELEGRAM_ENABLED !== "false",
  logLevel: process.env.LOG_LEVEL || "info"
};

export function validateConfig(candidate = config) {
  const errors = [];
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
  return errors;
}

export function assertValidConfig(candidate = config) {
  const errors = validateConfig(candidate);
  if (errors.length) throw new Error(`Configuration invalid:\n- ${errors.join("\n- ")}`);
}

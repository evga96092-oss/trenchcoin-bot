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
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  adminIds: parseAdminIds(process.env.TELEGRAM_ADMIN_IDS),
  port: Number(process.env.PORT || 3000),
  databasePath: path.resolve(process.env.DATABASE_PATH || "./data/trenchcoin.sqlite"),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:3000",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 10000),
  rateLimitMaxCommands: Number(process.env.RATE_LIMIT_MAX_COMMANDS || 8),
  solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  marketDataApiUrl: process.env.MARKET_DATA_API_URL || ""
};

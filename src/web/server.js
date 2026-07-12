import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OFFICIAL } from "../constants.js";
import { getLeaderboard } from "../db/index.js";
import { getMarketData } from "../services/marketData.js";
import { tokenDashboardText } from "../utils/format.js";
import { answerQuestion, widgetOptions } from "./knowledge.js";
import { config } from "../config.js";
import { isValidSolanaAddress, getTrenchBalance, explorerAddressUrl, getMintVerification, getHolderSnapshot } from "../services/solana.js";
import { createWalletChallenge, completeWalletChallenge } from "../services/identity.js";
import { db } from "../db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../public");

export function createServer() {
  const app = express();
  const challengeHits = new Map();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], connectSrc: ["'self'", ...config.allowedOrigins], imgSrc: ["'self'", "data:", "https:"] } } }));
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.static(publicDir));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, token: OFFICIAL.ticker, cluster: config.solanaCluster, staking: "preview" });
  });

  app.get("/ready", async (_req, res) => {
    let database = false;
    let rpc = false;
    try { database = db.prepare("SELECT 1 ok").get().ok === 1; } catch {}
    try {
      const response = await fetch(config.solanaRpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }), signal: AbortSignal.timeout(3000) });
      rpc = response.ok;
    } catch {}
    const ready = database && rpc;
    res.status(ready ? 200 : 503).json({ ready, checks: { database, solanaRpc: rpc, telegramConfigured: Boolean(config.telegramBotToken && config.telegramEnabled), staking: "preview" } });
  });

  app.get("/api/links", (_req, res) => {
    res.json(OFFICIAL);
  });

  app.get("/api/widget/options", (_req, res) => {
    res.json({ options: widgetOptions });
  });

  app.post("/api/widget/ask", (req, res) => {
    res.json({ answer: answerQuestion(req.body?.question || "") });
  });

  app.get("/api/price", async (_req, res) => {
    const marketData = await getMarketData();
    res.json({
      tokenName: OFFICIAL.tokenName,
      ticker: OFFICIAL.ticker,
      ca: OFFICIAL.ca,
      text: tokenDashboardText(marketData),
      marketData,
      status: marketData?.status || "unavailable"
    });
  });

  app.get("/api/mint", async (_req, res) => {
    res.json(await getMintVerification());
  });

  app.get("/api/holders", async (_req, res) => {
    res.json(await getHolderSnapshot());
  });

  app.get("/api/dashboard", async (_req, res) => {
    const [marketData, mint, holders] = await Promise.all([
      getMarketData(),
      getMintVerification(),
      getHolderSnapshot()
    ]);
    res.json({
      tokenName: OFFICIAL.tokenName,
      ticker: OFFICIAL.ticker,
      ca: OFFICIAL.ca,
      links: OFFICIAL,
      marketData,
      mint,
      holders,
      staking: {
        status: "preview",
        enabled: false,
        reason: "No verified deployed production staking program or IDL is configured.",
        requirements: ["verified deployed program", "IDL", "program authority review", "devnet transaction tests", "independent security review"]
      },
      telegram: {
        status: config.telegramBotToken && config.telegramEnabled ? "bot_configured" : "join_link_only",
        joinUrl: OFFICIAL.telegram,
        memberCount: null,
        note: "Live private-group counts are not shown without a supported Telegram API integration."
      },
      updatedAt: new Date().toISOString()
    });
  });

  app.get("/api/leaderboard", (_req, res) => {
    res.json({ leaderboard: getLeaderboard() });
  });

  app.post("/api/wallet/challenge", (req, res) => {
    if (!config.walletLinkingEnabled) return res.status(503).json({ error: "wallet_linking_disabled" });
    const key = req.ip || "unknown";
    const now = Date.now();
    const recent = (challengeHits.get(key) || []).filter((time) => now - time < 60000);
    if (recent.length >= 10) return res.status(429).json({ error: "rate_limited" });
    recent.push(now); challengeHits.set(key, recent);
    const walletAddress = String(req.body?.walletAddress || "");
    if (!isValidSolanaAddress(walletAddress)) return res.status(400).json({ error: "invalid_wallet" });
    return res.status(201).json(createWalletChallenge(walletAddress));
  });

  app.post("/api/wallet/verify", async (req, res) => {
    const challengeId = String(req.body?.challengeId || "");
    const signature = String(req.body?.signature || "");
    if (!challengeId || !signature) return res.status(400).json({ error: "missing_challenge_or_signature" });
    const result = await completeWalletChallenge({ challengeId, signature });
    return res.status(result.error ? 400 : 200).json({ ...result, explorer: result.walletAddress ? explorerAddressUrl(result.walletAddress) : undefined });
  });

  app.get("/api/wallet/:address/balance", async (req, res) => {
    const result = await getTrenchBalance(req.params.address);
    return res.status(result.status === "invalid_wallet" ? 400 : result.status === "rpc_unavailable" ? 503 : 200).json(result);
  });

  app.get("/api/status", (_req, res) => res.json({
    cluster: config.solanaCluster,
    mint: config.trenchMint || OFFICIAL.ca,
    walletVerification: "live",
    balanceVerification: "live",
    staking: config.solanaCluster === "devnet" ? "devnet-preview" : "preview",
    financialDistributions: "manual-approval-required"
  }));

  return app;
}

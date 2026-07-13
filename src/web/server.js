import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OFFICIAL } from "../constants.js";
import { getMarketData } from "../services/marketData.js";
import { tokenDashboardText } from "../utils/format.js";
import { answerQuestion, widgetOptions } from "./knowledge.js";
import { config } from "../config.js";
import { isValidSolanaAddress, getTrenchBalance, explorerAddressUrl, getMintVerification, getHolderSnapshot } from "../services/solana.js";
import { createWalletChallenge, completeWalletChallenge } from "../services/identity.js";
import { db } from "../db/index.js";
import { getIndexedHolderCount } from "../services/holders.js";
import { getTelegramMemberCount } from "../services/telegram.js";
import { getLiquidityVerification } from "../services/liquidity.js";
import { checkContestWallet, contestPublicConfig, getContestLeaderboard, getContestStatus, verifyContestSession, safeAbuseIdentifier, recordRejectedContestEvent, listAdminContestRecords, getAdminWalletHistory, reviewContestWallet, toCsv } from "../services/contest.js";
import { requireAdmin } from "../services/adminAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../public");

export function createServer({ contestBalanceFetcher = getTrenchBalance } = {}) {
  const app = express();
  const challengeHits = new Map();
  const contestHits = new Map();
  const duplicateRequests = new Map();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], connectSrc: ["'self'", ...config.allowedOrigins], imgSrc: ["'self'", "data:", "https:"] } } }));
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Idempotency-Key");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
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
    const [indexed, distribution] = await Promise.all([getIndexedHolderCount(), getHolderSnapshot()]);
    res.json({ ...distribution, ...indexed, distribution });
  });

  app.get("/api/telegram/members", async (_req, res) => res.json(await getTelegramMemberCount()));
  app.get("/api/telegram/diagnostics", async (_req, res) => res.json(await getTelegramMemberCount({ force: true })));
  app.get("/api/liquidity", async (_req, res) => res.json(await getLiquidityVerification()));

  app.get("/api/dashboard", async (_req, res) => {
    const [marketData, mint, distribution, indexedHolders, telegram, liquidity] = await Promise.all([
      getMarketData(),
      getMintVerification(),
      getHolderSnapshot(),
      getIndexedHolderCount(),
      getTelegramMemberCount(),
      getLiquidityVerification()
    ]);
    res.json({
      tokenName: OFFICIAL.tokenName,
      ticker: OFFICIAL.ticker,
      ca: OFFICIAL.ca,
      links: OFFICIAL,
      marketData,
      mint,
      holders: { ...distribution, ...indexedHolders, distribution },
      liquidity,
      staking: {
        status: "preview",
        enabled: false,
        reason: "No verified deployed production staking program or IDL is configured.",
        requirements: ["verified deployed program", "IDL", "program authority review", "devnet transaction tests", "independent security review"]
      },
      telegram: { ...telegram, joinUrl: OFFICIAL.telegram },
      updatedAt: new Date().toISOString()
    });
  });

  app.get("/api/leaderboard", (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    res.json({ contest: contestPublicConfig(), leaderboard: getContestLeaderboard({ limit, offset }) });
  });

  app.get("/api/contest/config", (_req, res) => res.json(contestPublicConfig()));

  function consumeRateLimit(req, walletAddress) {
    const now = Date.now();
    if (contestHits.size > 10000) contestHits.clear();
    if (duplicateRequests.size > 10000) duplicateRequests.clear();
    const abuseIdentifier = safeAbuseIdentifier(req.ip || "unknown") || "unavailable";
    const checks = [[`ip:${abuseIdentifier}`, config.contestRateLimitPerIp], [`wallet:${walletAddress}`, config.contestRateLimitPerWallet]];
    for (const [key, max] of checks) {
      const recent = (contestHits.get(key) || []).filter((time) => now - time < config.contestRateLimitWindowMs);
      if (recent.length >= max) return { allowed: false, abuseIdentifier };
      recent.push(now); contestHits.set(key, recent);
    }
    const idempotencyKey = String(req.headers["idempotency-key"] || `${walletAddress}:${req.path}`);
    const duplicateKey = `${abuseIdentifier}:${idempotencyKey}`;
    const previous = duplicateRequests.get(duplicateKey);
    duplicateRequests.set(duplicateKey, now);
    return { allowed: true, duplicate: previous && now - previous < 3000, abuseIdentifier };
  }

  app.post("/api/contest/check", async (req, res) => {
    const walletAddress = String(req.body?.walletAddress || "").trim();
    if (!isValidSolanaAddress(walletAddress)) {
      recordRejectedContestEvent({ walletAddress, failureCategory: "invalid_wallet", abuseIdentifier: safeAbuseIdentifier(req.ip) });
      return res.status(400).json({ error: "invalid_wallet" });
    }
    const limit = consumeRateLimit(req, walletAddress);
    if (!limit.allowed) {
      recordRejectedContestEvent({ walletAddress, failureCategory: "rate_limited", abuseIdentifier: limit.abuseIdentifier, rateLimitResult: "blocked" });
      return res.status(429).json({ error: "rate_limited" });
    }
    if (limit.duplicate) {
      recordRejectedContestEvent({ walletAddress, failureCategory: "duplicate_request", abuseIdentifier: limit.abuseIdentifier });
      return res.status(409).json({ error: "duplicate_request" });
    }
    const result = await checkContestWallet({ walletAddress, method: "public_lookup", ownershipVerified: false, balanceFetcher: contestBalanceFetcher, abuseIdentifier: limit.abuseIdentifier });
    return res.status(result.statusCode || 200).json(result);
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
    const result = await completeWalletChallenge({ challengeId, signature, abuseIdentifier: safeAbuseIdentifier(req.ip) });
    return res.status(result.error ? 400 : 200).json({ ...result, explorer: result.walletAddress ? explorerAddressUrl(result.walletAddress) : undefined });
  });

  app.get("/api/contest/me", (req, res) => {
    const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
    const session = verifyContestSession(token);
    if (!session) return res.status(401).json({ error: "ownership_session_required" });
    const status = getContestStatus(session.walletAddress, { includeRank: true });
    return status ? res.json(status) : res.status(404).json({ error: "contest_record_not_found" });
  });

  app.get("/api/admin/contest/records", requireAdmin, (req, res) => {
    res.json({ records: listAdminContestRecords(req.query) });
  });
  app.get("/api/admin/contest/wallet/:address/history", requireAdmin, (req, res) => {
    if (!isValidSolanaAddress(req.params.address)) return res.status(400).json({ error: "invalid_wallet" });
    res.json({ events: getAdminWalletHistory(req.params.address, req.query.limit) });
  });
  app.patch("/api/admin/contest/wallet/:address/review", requireAdmin, (req, res) => {
    if (!isValidSolanaAddress(req.params.address)) return res.status(400).json({ error: "invalid_wallet" });
    const result = reviewContestWallet(req.params.address, { action: req.body?.action, reason: req.body?.reason });
    return res.status(result.error === "not_found" ? 404 : result.error ? 400 : 200).json(result);
  });
  app.get("/api/admin/contest/export/:kind", requireAdmin, (req, res) => {
    let rows;
    if (req.params.kind === "records") rows = db.prepare("SELECT * FROM contest_wallets WHERE contest_id=? ORDER BY updated_at DESC").all(config.contest.id);
    else if (req.params.kind === "events") rows = db.prepare("SELECT * FROM contest_check_events WHERE contest_id=? ORDER BY checked_at DESC").all(config.contest.id);
    else return res.status(404).json({ error: "export_not_found" });
    res.type("text/csv").set("Content-Disposition", `attachment; filename=contest-${req.params.kind}.csv`).send(toCsv(rows));
  });

  app.get("/api/wallet/:address/balance", async (req, res) => {
    return res.status(410).json({ error: "wallet_check_moved", method: "POST", endpoint: "/api/contest/check" });
  });

  app.get("/api/status", (_req, res) => res.json({
    cluster: config.solanaCluster,
    mint: config.trenchMint || OFFICIAL.ca,
    walletVerification: "live",
    balanceVerification: "live",
    contest: contestPublicConfig(),
    staking: config.solanaCluster === "devnet" ? "devnet-preview" : "preview",
    financialDistributions: "manual-approval-required"
  }));

  app.get("/api/diagnostics", async (_req, res) => {
    const [holders, telegram, liquidity] = await Promise.all([getIndexedHolderCount(), getTelegramMemberCount(), getLiquidityVerification()]);
    let database = false; try { database = db.prepare("SELECT 1 ok").get().ok === 1; } catch {}
    res.json({
      checkedAt: new Date().toISOString(), version: process.env.npm_package_version || "0.1.0", commitSha: config.commitSha,
      integrations: {
        solanaRpc: { configured: Boolean(config.solanaRpcUrl), cluster: config.solanaCluster },
        holderProvider: { configured: Boolean(config.heliusApiKey), provider: config.holderProvider, status: holders.status },
        dexScreener: { configured: true }, liquidityVerification: { status: liquidity.status },
        telegram: { tokenConfigured: Boolean(config.telegramBotToken), chatConfigured: Boolean(config.telegramChatId), status: telegram.status },
        staking: { enabled: false, programConfigured: Boolean(config.stakingProgramId), idlConfigured: false, network: config.solanaCluster, status: "production_disabled" },
        database: { configured: Boolean(config.databasePath), working: database }
      }
    });
  });

  return app;
}

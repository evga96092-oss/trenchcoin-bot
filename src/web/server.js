import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OFFICIAL } from "../constants.js";
import { getLeaderboard } from "../db/index.js";
import { getMarketData } from "../services/marketData.js";
import { tokenDashboardText } from "../utils/format.js";
import { answerQuestion, widgetOptions } from "./knowledge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../public");

export function createServer() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "32kb" }));
  app.use(express.static(publicDir));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, token: OFFICIAL.ticker });
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
      status: marketData ? "live" : "pending"
    });
  });

  app.get("/api/leaderboard", (_req, res) => {
    res.json({ leaderboard: getLeaderboard() });
  });

  return app;
}

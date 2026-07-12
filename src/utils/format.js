import { OFFICIAL } from "../constants.js";

export function officialLinksText() {
  return [
    "Official $TRENCH Links",
    "",
    `Buy / Chart: ${OFFICIAL.pumpFun}`,
    `Website: ${OFFICIAL.website}`,
    `X: ${OFFICIAL.x}`,
    `Telegram: ${OFFICIAL.telegram}`,
    "",
    "Contract address:",
    OFFICIAL.ca,
    "",
    "Only use official links. No profit promises, no unofficial contracts."
  ].join("\n");
}

export function helpText(botUsername = "TrenchcoinHQBot") {
  return [
    "Trenchcoin Bot Commands",
    "",
    "/start - home menu",
    "/buy - official buy links",
    "/price - token dashboard",
    "/verify <wallet> - save wallet for holder verification",
    "/missions - daily missions",
    "/referral - your referral link",
    "/leaderboard - top XP",
    "/raid - current raid",
    "/help - command list",
    "",
    `In the group, use /buy@${botUsername} if another bot command appears first.`
  ].join("\n");
}

export function tokenDashboardText(marketData = null) {
  const lines = [
    "Trenchcoin Token Dashboard",
    "",
    `Token: ${OFFICIAL.tokenName}`,
    `Ticker: ${OFFICIAL.ticker}`,
    `CA: ${OFFICIAL.ca}`,
    "",
    `Chart / Buy: ${OFFICIAL.pumpFun}`,
    `Website: ${OFFICIAL.website}`,
    `X: ${OFFICIAL.x}`,
    `Telegram: ${OFFICIAL.telegram}`,
    ""
  ];

  if (!marketData) {
    lines.push("Live market data pending integration.");
    lines.push("Use the Pump.fun link above for the current live chart.");
    return lines.join("\n");
  }

  lines.push(
    `Price: ${marketData.priceUsd ?? marketData.price ?? "unavailable"} USD`,
    `Market cap: ${marketData.marketCapUsd ?? marketData.marketCap ?? "unavailable"} USD`,
    `Liquidity: ${marketData.liquidityUsd ?? marketData.liquidity ?? "unavailable"} USD`,
    `24H Volume: ${marketData.volume24hUsd ?? marketData.volume ?? "unavailable"} USD`,
    `24H Change: ${marketData.priceChange24hPct ?? "unavailable"}%`,
    `Source: ${marketData.source ?? "configured API"}`
  );
  return lines.join("\n");
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

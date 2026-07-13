import { OFFICIAL } from "../constants.js";

export const widgetOptions = [
  "Buy $TRENCH",
  "Official CA",
  "Wallet check",
  "Market stats",
  "Staking status",
  "Holder status",
  "Mission intel",
  "Security check",
  "Join Telegram",
  "Official links",
  "View roadmap",
  "Report issue",
  "Help"
];

export function answerQuestion(input = "") {
  const question = input.toLowerCase();

  if (question.includes("buy")) {
    return `Buy $TRENCH on the official Pump.fun page: ${OFFICIAL.pumpFun}`;
  }

  if (question.includes("what") || question.includes("trench")) {
    return "$TRENCH is Trenchcoin: a community token built around trench energy, raids, holders, and launch-day momentum.";
  }

  if (question.includes("telegram") || question.includes("join")) {
    return `Join the official Telegram here: ${OFFICIAL.telegram}`;
  }

  if (question.includes("stake")) {
    return [
      "Staking status: preview-only.",
      "No production staking transactions, APY, token locking, reward claims, or claim buttons are live.",
      "Launch requires a verified deployed program, IDL, account configuration, tests, and independent review."
    ].join("\n");
  }

  if (question.includes("wallet")) {
    return "Wallet Check is read-only. Connect a compatible Solana Wallet Standard wallet for signed ownership verification, or paste a public address for a balance-only lookup. It does not request a spending transaction.";
  }

  if (question.includes("market") || question.includes("price")) {
    return "Market stats load from the dashboard API. If DexScreener has a Solana pair for $TRENCH, the dashboard shows price, market cap, liquidity, volume, and 24h change.";
  }

  if (question.includes("holder")) {
    return "Holder status uses a limited Solana largest-account snapshot. Unique holder and 24h active holder counts require an indexed holder provider and are not fabricated.";
  }

  if (question.includes("mission") || question.includes("intel")) {
    return "Mission intel is a curated project-update feed, not fake real-time on-chain activity. It shows source labels for repo, API, config, and official references.";
  }

  if (question.includes("security")) {
    return "Security check: verify the official CA, never share a seed phrase, ignore fake support DMs, and remember the dashboard wallet check is read-only.";
  }

  if (question.includes("link") || question.includes("official")) {
    return [
      `Website: ${OFFICIAL.website}`,
      `X: ${OFFICIAL.x}`,
      `Telegram: ${OFFICIAL.telegram}`,
      `Pump.fun: ${OFFICIAL.pumpFun}`
    ].join("\n");
  }

  if (question.includes("address") || question.includes("ca") || question.includes("contract")) {
    return `Token address: ${OFFICIAL.ca}`;
  }

  if (question.includes("roadmap")) {
    return "Roadmap: live official links, read-only wallet checks, real market/mint/supply panels, honest staking preview, Telegram ops, and leaderboard infrastructure.";
  }

  if (question.includes("report")) {
    return `Report issues in the official Telegram and include browser, wallet type, and what action failed: ${OFFICIAL.telegram}`;
  }

  if (question.includes("faq") || question.includes("help")) {
    return "Try: Buy $TRENCH, Official CA, Wallet check, Market stats, Staking status, Holder status, Mission intel, Security check, Join Telegram, View roadmap, or Report issue.";
  }

  return "I only answer from official Trenchcoin info. Try: Buy $TRENCH, official links, token address, Telegram, staking, roadmap, or FAQ.";
}

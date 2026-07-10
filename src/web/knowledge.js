import { OFFICIAL } from "../constants.js";

export const widgetOptions = [
  "Buy $TRENCH",
  "What is $TRENCH?",
  "How to join Telegram",
  "How to stake",
  "Official links",
  "Token address",
  "Roadmap",
  "FAQ"
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
      "Staking program is deployed on Solana devnet.",
      "Mainnet staking is not live yet unless manually updated later.",
      `Devnet Program ID: ${OFFICIAL.devnetStakingProgramId}`
    ].join("\n");
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
    return "Launch focus: Telegram bot, website widget, token dashboard, holder verification, missions, referrals, and leaderboard foundation.";
  }

  if (question.includes("faq")) {
    return "Use the quick options for official links, token address, staking status, and how to join the Telegram.";
  }

  return "I only answer from official Trenchcoin info. Try: Buy $TRENCH, official links, token address, Telegram, staking, roadmap, or FAQ.";
}

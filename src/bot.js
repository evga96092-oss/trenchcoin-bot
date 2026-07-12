import { Markup, Telegraf } from "telegraf";
import { config } from "./config.js";
import { OFFICIAL } from "./constants.js";
import {
  addXp,
  ensureUser,
  getActiveRaid,
  getLeaderboard,
  getMissionsForUser,
  getStats,
  getUser,
  deleteUserData,
  setActiveRaid
} from "./db/index.js";
import { getMarketData } from "./services/marketData.js";
import { checkTrenchBalance, isLikelySolanaWallet } from "./services/holderVerification.js";
import { helpText, officialLinksText, tokenDashboardText } from "./utils/format.js";
import { linkedStatus, unlinkWallet } from "./services/identity.js";

const commandHits = new Map();
const botCommands = [
  { command: "start", description: "Open the Trenchcoin menu" },
  { command: "buy", description: "Official buy links" },
  { command: "price", description: "Token dashboard" },
  { command: "link", description: "Securely link a wallet on the website" },
  { command: "verify", description: "Check linked verification status" },
  { command: "balance", description: "Refresh linked $TRENCH balance" },
  { command: "staking", description: "Staking status" },
  { command: "points", description: "Your XP status" },
  { command: "privacy", description: "Privacy and account controls" },
  { command: "unlink", description: "Unlink your wallet" },
  { command: "missions", description: "Daily missions" },
  { command: "referral", description: "Your referral link" },
  { command: "leaderboard", description: "Top XP" },
  { command: "raid", description: "Current raid" },
  { command: "help", description: "Command list" }
];

function homeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url("Buy $TRENCH", OFFICIAL.pumpFun), Markup.button.url("Chart / Pump.fun", OFFICIAL.pumpFun)],
    [Markup.button.url("Official X", OFFICIAL.x), Markup.button.url("Telegram", OFFICIAL.telegram)],
    [Markup.button.callback("Verify Holder", "verify_help"), Markup.button.callback("Daily Missions", "missions")],
    [Markup.button.callback("Referral", "referral"), Markup.button.callback("Leaderboard", "leaderboard")],
    [Markup.button.callback("Help", "help")]
  ]);
}

function isAdmin(ctx) {
  return config.adminIds.has(String(ctx.from?.id));
}

function rateLimit(ctx, next) {
  const id = String(ctx.from?.id || ctx.chat?.id || "anonymous");
  const now = Date.now();
  const bucket = commandHits.get(id) || [];
  const fresh = bucket.filter((time) => now - time < config.rateLimitWindowMs);
  fresh.push(now);
  commandHits.set(id, fresh);

  if (fresh.length > config.rateLimitMaxCommands) {
    return ctx.reply("Slow down a little. The trenches are moving, but the bot needs room to breathe.");
  }

  return next();
}

function requireAdmin(ctx) {
  if (!isAdmin(ctx)) {
    ctx.reply("Admin command restricted.");
    return false;
  }
  return true;
}

function botUsername(ctx) {
  return ctx.botInfo?.username || "TrenchcoinHQBot";
}

function groupCommandHint(ctx) {
  if (ctx.chat?.type === "private") return "";
  return `\n\nGroup tip: use /buy@${botUsername(ctx)} if Telegram shows another bot first.`;
}

export function createBot() {
  if (!config.telegramBotToken || !config.telegramEnabled) return null;

  const bot = new Telegraf(config.telegramBotToken);
  bot.use(rateLimit);
  bot.use((ctx, next) => {
    const text = ctx.message?.text || "";
    if (ctx.from && !text.startsWith("/start")) ensureUser(ctx.from);
    return next();
  });

  bot.start((ctx) => {
    const payload = ctx.startPayload || "";
    const user = ensureUser(ctx.from, payload);
    return ctx.reply(
      [
        "Welcome to the trenches.",
        "",
        `${OFFICIAL.tokenName} ${OFFICIAL.ticker}`,
        "Official links, raids, missions, referrals, and holder verification are ready.",
        "",
        `Your referral code: ${user.referral_code}`,
        groupCommandHint(ctx).trim()
      ].join("\n"),
      homeKeyboard()
    );
  });

  bot.command("buy", (ctx) => ctx.reply(officialLinksText()));

  bot.command("help", (ctx) => ctx.reply(helpText(botUsername(ctx))));

  // Returns only the current chat's Telegram identifier. This is safe for
  // setup diagnostics and avoids exposing the bot token or other secrets.
  bot.command("chatid", (ctx) => ctx.reply(`Telegram chat ID: ${ctx.chat.id}\nType: ${ctx.chat.type}\nTitle: ${ctx.chat.title || "private chat"}`));

  bot.command("price", async (ctx) => {
    const marketData = await getMarketData();
    return ctx.reply(tokenDashboardText(marketData));
  });

  bot.command("link", (ctx) => ctx.reply(["Secure wallet linking requires signing a one-time message on the official site.", `${config.publicBaseUrl}/#wallet-link`, "Never share a seed phrase or private key."].join("\n")));
  bot.command("verify", (ctx) => {
    const link = linkedStatus(ctx.from.id);
    return ctx.reply(link ? `Verified wallet: ${link.wallet_address.slice(0, 6)}…${link.wallet_address.slice(-6)}\nLast balance: ${link.last_balance_ui ?? "refresh required"} $TRENCH` : "No verified wallet is linked. Use /link.");
  });
  bot.command("balance", async (ctx) => {
    const link = linkedStatus(ctx.from.id);
    if (!link) return ctx.reply("No verified wallet is linked. Use /link.");
    const balance = await checkTrenchBalance(link.wallet_address);
    return ctx.reply(`$TRENCH balance status: ${balance.status}\nBalance: ${balance.balanceUi ?? "unavailable"}\nMint: ${OFFICIAL.ca}\nCluster: ${balance.cluster || config.solanaCluster}`);
  });
  bot.command("staking", (ctx) => ctx.reply(`Staking Preview only. No production staking transactions are enabled. Devnet program reference: ${OFFICIAL.devnetStakingProgramId}`));
  bot.command("points", (ctx) => {
    const user = getUser(ctx.from.id);
    return ctx.reply(`XP: ${user?.xp || 0}\nReferrals: ${user?.referral_count || 0}\nStatus: ${user?.holder_status || "Recruit"}`);
  });
  bot.command("privacy", (ctx) => ctx.reply("We store Telegram account identifiers, referral/XP records, and any wallet you explicitly verify. Use /unlink to disconnect a wallet. Use /delete_me to request deletion of account data; minimal fraud/audit records may be retained without direct identifiers."));
  bot.command("unlink", (ctx) => ctx.reply(unlinkWallet(ctx.from.id) ? "Wallet unlinked. Historical XP/audit events remain for anti-abuse integrity." : "No linked wallet found."));
  bot.command("delete_me", (ctx) => { deleteUserData(ctx.from.id); return ctx.reply("Account data deleted. Minimal de-identified audit records may remain for fraud prevention."); });

  const showMissions = (ctx) => {
    const missions = getMissionsForUser(ctx.from.id);
    const lines = missions.map((mission, index) => {
      const verification = mission.verification_type === "automatic" ? "auto" : "manual review";
      return `${index + 1}. ${mission.title} - ${mission.points} XP\n${mission.description}\nStatus: ${mission.status} | ${verification}`;
    });
    return ctx.reply(
      [
        "Daily Trench Missions",
        "Complete missions, stack XP, and climb the leaderboard.",
        "",
        ...lines,
        "",
        "Today: keep it official, keep it clean, no profit promises."
      ].join("\n\n")
    );
  };

  const showReferral = (ctx) => {
    const user = getUser(ctx.from.id);
    const link = `https://t.me/${ctx.botInfo.username}?start=${user.referral_code}`;
    return ctx.reply(
      [
        "Your referral link:",
        link,
        "",
        `Code: ${user.referral_code}`,
        `Referrals: ${user.referral_count}`,
        "Share this in DMs or posts. Referral XP is tracked once a new user starts the bot with your link."
      ].join("\n")
    );
  };

  const showLeaderboard = (ctx) => {
    const rows = getLeaderboard();
    if (!rows.length) return ctx.reply("Leaderboard is warming up.");
    const lines = rows.map((row, index) => {
      const name = row.username ? `@${row.username}` : row.first_name || row.fallback_alias;
      return `${index + 1}. ${name} | ${row.xp} XP | ${row.holder_status}`;
    });
    return ctx.reply(["Trench Leaderboard", "", ...lines].join("\n"));
  };

  bot.command("missions", showMissions);
  bot.command("referral", showReferral);
  bot.command("leaderboard", showLeaderboard);

  bot.command("raid", (ctx) => {
    const raid = getActiveRaid();
    return ctx.reply(
      [
        "Raid Center",
        "",
        `Target: ${raid?.url || OFFICIAL.x}`,
        "",
        "Mission:",
        "1. Visit the official X.",
        "2. Like and repost the latest post.",
        "3. Reply with real $TRENCH energy.",
        "4. Bring one new trench recruit back here.",
        "",
        "No spam. No fake claims. Keep it clean and loud."
      ].join("\n")
    );
  });

  bot.command("admin_stats", (ctx) => {
    if (!requireAdmin(ctx)) return;
    const stats = getStats();
    return ctx.reply(
      [
        "Admin Stats",
        `Users: ${stats.users}`,
        `Wallets: ${stats.wallets}`,
        `Referrals: ${stats.referrals}`,
        `XP events: ${stats.xpEvents}`
      ].join("\n")
    );
  });

  bot.command("admin_addxp", (ctx) => {
    if (!requireAdmin(ctx)) return;
    const [, userId, amount] = ctx.message.text.split(/\s+/);
    if (!userId || !amount || Number.isNaN(Number(amount))) return ctx.reply("Use: /admin_addxp <user_id> <amount>");
    addXp(userId, Number(amount), `Admin add by ${ctx.from.id}`);
    return ctx.reply(`Added ${amount} XP to ${userId}.`);
  });

  bot.command("admin_setraid", (ctx) => {
    if (!requireAdmin(ctx)) return;
    const url = ctx.message.text.split(/\s+/)[1];
    const allowed = ["https://x.com/TrenchcoinHQ", OFFICIAL.website, OFFICIAL.pumpFun];
    if (!url || !allowed.some((prefix) => url.startsWith(prefix))) return ctx.reply("Raid URL must use an approved official Trenchcoin destination.");
    setActiveRaid(url, ctx.from.id);
    return ctx.reply(`Raid target updated: ${url}`);
  });

  bot.command("admin_broadcast", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    return ctx.reply("Broadcast command scaffolded. Add chat opt-in storage before mass messaging.");
  });

  bot.action("verify_help", (ctx) => ctx.reply("Use: /verify <wallet>"));
  bot.action("missions", showMissions);
  bot.action("referral", showReferral);
  bot.action("leaderboard", showLeaderboard);
  bot.action("help", (ctx) => ctx.reply(helpText(botUsername(ctx))));

  bot.catch((error, ctx) => {
    console.error("Bot error", error, ctx.updateType);
  });

  return bot;
}

export async function registerBotCommands(bot) {
  await bot.telegram.setMyCommands(botCommands);
}

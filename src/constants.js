export const OFFICIAL = Object.freeze({
  tokenName: "Trenchcoin",
  ticker: "$TRENCH",
  ca: "H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump",
  x: "https://x.com/TrenchcoinHQ",
  website: "https://trenchcoinhq.netlify.app/",
  telegram: "https://t.me/+_ct7Uyx2-C1kYzYx",
  pumpFun: "https://pump.fun/coin/H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump",
  devnetStakingProgramId: "BhMs58CFjPj8qMnyKRBNEau4VvHDWatSvGoBSCHi6Zio"
});

export const ROLE_TIERS = [
  "Recruit",
  "Holder",
  "Raider",
  "Veteran",
  "Commander",
  "General"
];

export const INITIAL_MISSIONS = [
  ["follow_x", "Follow X", "Follow the official Trenchcoin X account.", 25, "manual"],
  ["join_telegram", "Join Telegram", "Join the official Telegram trench.", 25, "manual"],
  ["share_pumpfun", "Share Pump.fun link", "Share the official Pump.fun link.", 35, "manual"],
  ["invite_friend", "Invite 1 friend", "Bring one new trench recruit through your referral link.", 50, "automatic"],
  ["post_trench_x", "Post $TRENCH on X", "Post about $TRENCH and keep it clean: no profit promises.", 40, "manual"],
  ["verify_wallet", "Verify wallet", "Save your Solana wallet for holder verification.", 30, "automatic"],
  ["hold_trench", "Hold $TRENCH", "Hold any $TRENCH once live verification is enabled.", 100, "automatic"]
];

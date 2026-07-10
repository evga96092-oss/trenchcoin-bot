export function isLikelySolanaWallet(wallet) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
}

export async function checkTrenchBalance() {
  return {
    status: "pending",
    holderStatus: "Recruit",
    balanceRaw: null,
    note: "Solana token balance lookup is scaffolded but not live yet."
  };
}

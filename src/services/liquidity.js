import { config } from "../config.js";
import { OFFICIAL } from "../constants.js";

const dexNames = { raydium: "Raydium", meteora: "Meteora", orca: "Orca", pumpswap: "PumpSwap", pumpfun: "Pump.fun" };
export function normalizeLiquidityPairs(payload) {
  return (Array.isArray(payload?.pairs) ? payload.pairs : []).filter((p) => p?.chainId === "solana").map((p) => ({
    poolAddress: p.pairAddress || null, dex: dexNames[p.dexId] || p.dexId || "Unknown", poolType: "Unable to verify from discovery data", liquidityUsd: Number.isFinite(Number(p.liquidity?.usd)) ? Number(p.liquidity.usd) : null,
    lpMint: null, positionIdentifier: null, burnedPercentage: null, lockedPercentage: null, creatorControlledPercentage: null,
    verificationMethod: "DexScreener discovery only; on-chain pool layout/ownership not yet identified", dataSource: "DexScreener", explorer: p.pairAddress ? `https://solscan.io/account/${p.pairAddress}` : null,
    status: "unable_to_verify", confidence: "discovery_only"
  }));
}
export async function getLiquidityVerification() {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(config.trenchMint || OFFICIAL.ca)}`, { signal: AbortSignal.timeout(config.integrationTimeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const pools = normalizeLiquidityPairs(await response.json());
    return { status: pools.length ? "unable_to_verify" : "not_found", mint: config.trenchMint, pools, checkedAt, note: "Pool discovery is live. LP burned/locked is intentionally unset until the DEX-specific on-chain account layout proves it." };
  } catch (error) { return { status: "provider_unavailable", mint: config.trenchMint, pools: [], checkedAt, error: error.message }; }
}

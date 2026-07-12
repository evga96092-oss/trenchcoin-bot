import { config } from "../config.js";
import { OFFICIAL } from "../constants.js";

const CACHE_TTL_MS = 60_000;
let cache = { value: null, fetchedAt: 0 };

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeDexScreenerPair(pair) {
  if (!pair) return null;
  const price = numeric(pair.priceUsd);
  return {
    status: "live",
    source: "DexScreener",
    sourceUrl: pair.url || `https://dexscreener.com/solana/${OFFICIAL.ca}`,
    pairAddress: pair.pairAddress || null,
    dexId: pair.dexId || null,
    priceUsd: price,
    marketCapUsd: numeric(pair.marketCap ?? pair.fdv),
    liquidityUsd: numeric(pair.liquidity?.usd),
    volume24hUsd: numeric(pair.volume?.h24),
    priceChange24hPct: numeric(pair.priceChange?.h24),
    updatedAt: new Date().toISOString()
  };
}

export function normalizeDexScreenerResponse(payload) {
  const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
  const viablePairs = pairs
    .filter((pair) => pair?.chainId === "solana")
    .sort((a, b) => numeric(b?.liquidity?.usd) - numeric(a?.liquidity?.usd));
  return normalizeDexScreenerPair(viablePairs[0]);
}

async function fetchJsonWithRetry(url, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function getMarketData({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.value && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { ...cache.value, cache: "fresh" };
  }

  const url = config.marketDataApiUrl || `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(config.trenchMint || OFFICIAL.ca)}`;

  try {
    const payload = await fetchJsonWithRetry(url);
    const normalized = config.marketDataApiUrl ? payload : normalizeDexScreenerResponse(payload);
    if (!normalized) throw new Error("No market pair returned for token");
    cache = { value: normalized, fetchedAt: now };
    return { ...normalized, cache: "fresh" };
  } catch (error) {
    if (cache.value) return { ...cache.value, status: "stale", cache: "stale", error: error.message };
    return { status: "unavailable", source: config.marketDataApiUrl ? "Configured market API" : "DexScreener", error: error.message, updatedAt: new Date().toISOString() };
  }
}

import { config } from "../config.js";

let cache = { value: null, fetchedAt: 0 };

export function normalizeHeliusTokenAccounts(payload) {
  const accounts = Array.isArray(payload?.result?.token_accounts) ? payload.result.token_accounts : [];
  const owners = new Set(accounts.filter((a) => BigInt(a.amount || "0") > 0n).map((a) => a.owner).filter(Boolean));
  return { owners, cursor: payload?.result?.cursor || null };
}

async function fetchHeliusHolders() {
  const owners = new Set();
  let cursor;
  let pages = 0;
  do {
    const body = { jsonrpc: "2.0", id: "holders", method: "getTokenAccounts", params: { mint: config.trenchMint, limit: 1000, ...(cursor ? { cursor } : {}) } };
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(config.heliusApiKey)}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(config.integrationTimeoutMs)
    });
    if (response.status === 429) throw new Error("provider_rate_limited");
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || "provider_error");
    const page = normalizeHeliusTokenAccounts(payload);
    for (const owner of page.owners) owners.add(owner);
    cursor = page.cursor;
    pages += 1;
    if (pages > 1000) throw new Error("provider_pagination_limit");
  } while (cursor);
  return owners.size;
}

export async function getIndexedHolderCount({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.value && now - cache.fetchedAt < config.holderCacheTtlMs) return { ...cache.value, status: "cached", cacheAgeMs: now - cache.fetchedAt };
  if (config.holderProvider !== "helius") return { status: "configuration_required", totalHolders: null, source: config.holderProvider, message: "Set HOLDER_PROVIDER=helius, add HELIUS_API_KEY, and redeploy." };
  if (!config.heliusApiKey) return { status: "configuration_required", totalHolders: null, source: "Helius DAS", message: "Add HELIUS_API_KEY to Railway and redeploy. The key is never sent to the browser." };
  try {
    const totalHolders = await fetchHeliusHolders();
    const value = { status: "verified", totalHolders, activeHolders: null, activeHolderWindow: null, activeHolderDefinition: "Not reported: a defensible transfer-activity index is not configured.", source: "Helius DAS getTokenAccounts", updatedAt: new Date().toISOString(), freshness: "fresh" };
    cache = { value, fetchedAt: now };
    return { ...value, cacheAgeMs: 0 };
  } catch (error) {
    if (cache.value) return { ...cache.value, status: "cached", freshness: "stale", cacheAgeMs: now - cache.fetchedAt, error: error.message };
    return { status: "provider_unavailable", totalHolders: null, source: "Helius DAS", updatedAt: new Date().toISOString(), freshness: "unavailable", error: error.message };
  }
}

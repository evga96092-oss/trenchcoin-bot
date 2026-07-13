import crypto from "node:crypto";
import { config } from "../config.js";
import { OFFICIAL } from "../constants.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function decodeBase58(value) {
  if (typeof value !== "string" || !value.length) throw new Error("Invalid base58 value");
  let number = 0n;
  for (const char of value) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base58 character");
    number = number * 58n + BigInt(index);
  }
  const bytes = [];
  while (number > 0n) {
    bytes.push(Number(number % 256n));
    number /= 256n;
  }
  for (const char of value) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}

export function isValidSolanaAddress(address) {
  try { return decodeBase58(address).length === 32; } catch { return false; }
}

export function verifyWalletSignature(address, message, signatureBase58) {
  const publicKey = decodeBase58(address);
  const signature = decodeBase58(signatureBase58);
  if (publicKey.length !== 32 || signature.length !== 64) return false;
  const key = crypto.createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]), format: "der", type: "spki" });
  return crypto.verify(null, Buffer.from(message, "utf8"), key, signature);
}

async function rpc(method, params) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(config.solanaRpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
        signal: AbortSignal.timeout(config.integrationTimeoutMs)
      });
      if (response.status === 429) { const error = new Error("Solana RPC HTTP 429"); error.category = "rpc_rate_limited"; throw error; }
      if (!response.ok) { const error = new Error(`Solana RPC HTTP ${response.status}`); error.category = "rpc_unavailable"; throw error; }
      const payload = await response.json();
      if (payload.error) { const error = new Error(`Solana RPC: ${payload.error.message || "unknown error"}`); error.category = "rpc_unavailable"; throw error; }
      return payload.result;
    } catch (error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") error.category = "rpc_timeout";
      lastError = error;
      if (attempt === 0 && error.category !== "rpc_rate_limited") continue;
    }
  }
  throw lastError;
}

export function rawToUiAmount(raw, decimals) {
  const places = decimals ?? 0;
  const base = 10n ** BigInt(places);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(places, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export async function getTrenchBalance(walletAddress) {
  if (!isValidSolanaAddress(walletAddress)) return { status: "invalid_wallet" };
  const mint = config.trenchMint || OFFICIAL.ca;
  if (!isValidSolanaAddress(mint)) return { status: "invalid_mint" };
  try {
    const result = await rpc("getTokenAccountsByOwner", [walletAddress, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }]);
    let raw = 0n;
    let decimals = null;
    for (const entry of result.value || []) {
      const amount = entry.account?.data?.parsed?.info?.tokenAmount;
      if (!amount) continue;
      raw += BigInt(amount.amount);
      decimals = amount.decimals;
    }
    const places = decimals ?? 6;
    return { status: raw === 0n ? "zero_balance" : "verified", balanceRaw: raw.toString(), balanceUi: rawToUiAmount(raw, places), decimals: places, slot: result.context?.slot ?? null, mint, cluster: config.solanaCluster, provider: "Solana RPC", checkedAt: new Date().toISOString() };
  } catch (error) {
    return { status: error.category || "rpc_unavailable", failureCategory: error.category || "rpc_unavailable", error: error.message, mint, cluster: config.solanaCluster, provider: "Solana RPC", checkedAt: new Date().toISOString() };
  }
}

export async function getMintVerification() {
  const mint = config.trenchMint || OFFICIAL.ca;
  if (!isValidSolanaAddress(mint)) return { status: "invalid_mint", mint, cluster: config.solanaCluster };
  try {
    const [account, supply] = await Promise.all([
      rpc("getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }]),
      rpc("getTokenSupply", [mint, { commitment: "confirmed" }])
    ]);
    const parsed = account.value?.data?.parsed;
    const info = parsed?.info || {};
    const tokenSupply = supply.value || {};
    return {
      status: "verified",
      source: "Solana RPC",
      checkedAt: new Date().toISOString(),
      slot: account.context?.slot ?? supply.context?.slot ?? null,
      mint,
      cluster: config.solanaCluster,
      tokenProgram: account.value?.owner || "unknown",
      decimals: tokenSupply.decimals ?? info.decimals ?? null,
      totalSupplyRaw: tokenSupply.amount ?? null,
      totalSupplyUi: tokenSupply.uiAmountString ?? null,
      mintAuthority: info.mintAuthority || null,
      freezeAuthority: info.freezeAuthority || null,
      mintAuthorityStatus: info.mintAuthority ? "active" : "revoked",
      freezeAuthorityStatus: info.freezeAuthority ? "active" : "revoked",
      explorer: explorerAddressUrl(mint),
      lpStatus: "Unable to verify automatically",
      taxStatus: "Not applicable to SPL token mint data"
    };
  } catch (error) {
    return { status: "rpc_unavailable", source: "Solana RPC", error: error.message, mint, cluster: config.solanaCluster, checkedAt: new Date().toISOString() };
  }
}

export async function getHolderSnapshot() {
  const mint = config.trenchMint || OFFICIAL.ca;
  if (!isValidSolanaAddress(mint)) return { status: "invalid_mint", mint, cluster: config.solanaCluster };
  try {
    const [largest, supply] = await Promise.all([
      rpc("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]),
      rpc("getTokenSupply", [mint, { commitment: "confirmed" }])
    ]);
    const accounts = largest.value || [];
    const decimals = supply.value?.decimals ?? 6;
    const totalRaw = BigInt(supply.value?.amount || "0");
    const top = accounts.map((entry) => {
      const raw = BigInt(entry.amount || "0");
      return {
        address: entry.address,
        amountRaw: raw.toString(),
        amountUi: entry.uiAmountString || rawToUiAmount(raw, decimals),
        percentOfSupply: totalRaw > 0n ? Number(raw * 10_000n / totalRaw) / 100 : null
      };
    });
    const top10Pct = top.slice(0, 10).reduce((sum, entry) => sum + (entry.percentOfSupply || 0), 0);
    const whaleThresholdPct = 1;
    return {
      status: "limited",
      source: "Solana RPC getTokenLargestAccounts",
      checkedAt: new Date().toISOString(),
      slot: largest.context?.slot ?? supply.context?.slot ?? null,
      mint,
      cluster: config.solanaCluster,
      definition: "Largest token accounts only. Unique holder count requires an indexed holder provider.",
      totalHolders: null,
      activeHolders24h: null,
      whaleThreshold: ">= 1% of current supply",
      whaleCount: top.filter((entry) => (entry.percentOfSupply || 0) >= whaleThresholdPct).length,
      topHolderPercent: top[0]?.percentOfSupply ?? null,
      top10Percent: Number(top10Pct.toFixed(2)),
      topAccounts: top.slice(0, 10),
      unavailable: ["unique_holders", "active_holders_24h", "program_owned_account_exclusions"]
    };
  } catch (error) {
    return { status: "rpc_unavailable", source: "Solana RPC", error: error.message, mint, cluster: config.solanaCluster, checkedAt: new Date().toISOString() };
  }
}

export function explorerAddressUrl(address) {
  const suffix = config.solanaCluster === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(config.solanaCluster)}`;
  return `https://explorer.solana.com/address/${address}${suffix}`;
}

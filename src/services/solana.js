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
  const response = await fetch(config.solanaRpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error(`Solana RPC HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Solana RPC: ${payload.error.message || "unknown error"}`);
  return payload.result;
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
    const base = 10n ** BigInt(places);
    const whole = raw / base;
    const fraction = (raw % base).toString().padStart(places, "0").replace(/0+$/, "");
    return { status: raw === 0n ? "zero_balance" : "verified", balanceRaw: raw.toString(), balanceUi: fraction ? `${whole}.${fraction}` : whole.toString(), decimals: places, slot: result.context?.slot ?? null, mint, cluster: config.solanaCluster };
  } catch (error) {
    return { status: "rpc_unavailable", error: error.message, mint, cluster: config.solanaCluster };
  }
}

export function explorerAddressUrl(address) {
  const suffix = config.solanaCluster === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(config.solanaCluster)}`;
  return `https://explorer.solana.com/address/${address}${suffix}`;
}

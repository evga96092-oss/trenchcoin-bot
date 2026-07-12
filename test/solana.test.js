import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { decodeBase58, isValidSolanaAddress, verifyWalletSignature } from "../src/services/solana.js";
import { normalizeDexScreenerResponse } from "../src/services/marketData.js";

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(buffer) {
  let number = BigInt(`0x${buffer.toString("hex") || "0"}`);
  let encoded = "";
  while (number > 0n) { encoded = alphabet[Number(number % 58n)] + encoded; number /= 58n; }
  for (const byte of buffer) { if (byte !== 0) break; encoded = `1${encoded}`; }
  return encoded || "1";
}

test("base58 decoding and canonical mint validation", () => {
  const mint = "H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump";
  assert.equal(decodeBase58(mint).length, 32);
  assert.equal(isValidSolanaAddress(mint), true);
  assert.equal(isValidSolanaAddress("not-a-wallet"), false);
});

test("verifies an Ed25519 signed challenge and rejects tampering", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  const address = encodeBase58(der.subarray(-32));
  const message = "Trenchcoin Wallet Verification\nNonce: test";
  const signature = encodeBase58(crypto.sign(null, Buffer.from(message), privateKey));
  assert.equal(verifyWalletSignature(address, message, signature), true);
  assert.equal(verifyWalletSignature(address, `${message}!`, signature), false);
});

test("normalizes DexScreener market data without inventing fields", () => {
  const normalized = normalizeDexScreenerResponse({
    pairs: [
      { chainId: "ethereum", liquidity: { usd: 1_000_000 }, priceUsd: "2" },
      {
        chainId: "solana",
        dexId: "raydium",
        pairAddress: "pair",
        url: "https://dexscreener.com/solana/pair",
        priceUsd: "0.00001",
        marketCap: 12345,
        liquidity: { usd: 4567 },
        volume: { h24: 789 },
        priceChange: { h24: -1.25 }
      }
    ]
  });
  assert.equal(normalized.source, "DexScreener");
  assert.equal(normalized.priceUsd, 0.00001);
  assert.equal(normalized.marketCapUsd, 12345);
  assert.equal(normalized.liquidityUsd, 4567);
  assert.equal(normalized.volume24hUsd, 789);
  assert.equal(normalized.priceChange24hPct, -1.25);
});

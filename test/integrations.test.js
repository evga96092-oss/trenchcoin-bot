import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHeliusTokenAccounts } from "../src/services/holders.js";
import { normalizeLiquidityPairs } from "../src/services/liquidity.js";

test("Helius holder page counts unique positive-balance owners", () => {
  const page = normalizeHeliusTokenAccounts({ result: { cursor: "next", token_accounts: [
    { owner: "wallet-a", amount: "10" }, { owner: "wallet-a", amount: "2" }, { owner: "wallet-b", amount: "0" }, { owner: "wallet-c", amount: "1" }
  ] } });
  assert.equal(page.owners.size, 2); assert.equal(page.cursor, "next");
});

test("liquidity discovery never fabricates burn or lock verification", () => {
  const [pool] = normalizeLiquidityPairs({ pairs: [{ chainId: "solana", dexId: "raydium", pairAddress: "pool", liquidity: { usd: 123 } }] });
  assert.equal(pool.dex, "Raydium"); assert.equal(pool.burnedPercentage, null); assert.equal(pool.lockedPercentage, null); assert.equal(pool.status, "unable_to_verify");
});

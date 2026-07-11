import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config.js";

const base = {
  appEnv: "staging",
  publicAppUrl: "https://trench-stage.netlify.app",
  publicBaseUrl: "https://trench-stage.up.railway.app",
  allowedOrigins: ["https://trench-stage.netlify.app"],
  trenchMint: "H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump",
  solanaCluster: "devnet",
  stakingEnabled: false
};

test("valid staging configuration passes", () => assert.deepEqual(validateConfig(base), []));
test("staging cannot silently use mainnet", () => assert.match(validateConfig({ ...base, solanaCluster: "mainnet-beta" }).join(" "), /Staging must use/));
test("production rejects localhost and devnet", () => {
  const errors = validateConfig({ ...base, appEnv: "production", allowedOrigins: ["http://localhost:3000"], solanaCluster: "devnet" }).join(" ");
  assert.match(errors, /localhost/); assert.match(errors, /mainnet-beta/);
});
test("staking feature flag fails closed", () => assert.match(validateConfig({ ...base, stakingEnabled: true }).join(" "), /cannot be true/));

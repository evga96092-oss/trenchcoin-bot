import { config, assertValidConfig } from "../src/config.js";
assertValidConfig();
console.log(JSON.stringify({ ok: true, appEnv: config.appEnv, cluster: config.solanaCluster, stakingEnabled: config.stakingEnabled, origins: config.allowedOrigins.length }));

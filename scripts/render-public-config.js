import fs from "node:fs";
const backendUrl = process.env.BACKEND_PUBLIC_URL || "http://localhost:3000";
const appEnv = process.env.APP_ENV || "local";
const cluster = process.env.SOLANA_CLUSTER || "mainnet-beta";
const content = `window.TRENCH_CONFIG=${JSON.stringify({ backendUrl, appEnv, cluster, staking: "preview" })};\n`;
fs.writeFileSync(new URL("../public/config.js", import.meta.url), content);
console.log(`Rendered public config for ${appEnv}/${cluster}`);

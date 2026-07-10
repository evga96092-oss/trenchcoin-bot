import { config } from "../config.js";

export async function getMarketData() {
  if (!config.marketDataApiUrl) return null;

  try {
    const response = await fetch(config.marketDataApiUrl, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

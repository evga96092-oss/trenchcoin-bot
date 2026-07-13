import assert from "node:assert/strict";
import test from "node:test";

test("Wallet Standard discovery registers and unregisters wallets", async () => {
  const originalWindow = globalThis.window;
  const mockWindow = new EventTarget();
  globalThis.window = mockWindow;

  const wallet = { name: "Test Wallet", accounts: [], features: {} };
  mockWindow.addEventListener("wallet-standard:app-ready", (event) => event.detail.register(wallet));

  try {
    const { getWallets } = await import(`../public/wallet-standard-app.js?test=${Date.now()}`);
    const registry = getWallets();
    assert.deepEqual(registry.get(), [wallet]);

    let registered;
    registry.on("register", (...wallets) => { registered = wallets; });
    const second = { name: "Second Wallet", accounts: [], features: {} };
    const unregister = registry.register(second);
    assert.deepEqual(registered, [second]);
    assert.deepEqual(registry.get(), [wallet, second]);

    unregister();
    assert.deepEqual(registry.get(), [wallet]);
  } finally {
    globalThis.window = originalWindow;
  }
});

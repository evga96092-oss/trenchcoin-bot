// Minimal browser-side implementation of the Wallet Standard app discovery API.
// Protocol reference: https://github.com/wallet-standard/wallet-standard

let walletsApi;
const registeredWallets = new Set();
const listeners = { register: [], unregister: [] };

class WalletStandardAppReadyEvent extends Event {
  constructor(api) {
    super("wallet-standard:app-ready", { bubbles: false, cancelable: false, composed: false });
    this.detail = api;
  }
}

function notify(event, wallets) {
  for (const listener of listeners[event]) {
    try { listener(...wallets); }
    catch (error) { console.error(error); }
  }
}

function register(...wallets) {
  const newWallets = wallets.filter((wallet) => !registeredWallets.has(wallet));
  if (!newWallets.length) return () => {};
  newWallets.forEach((wallet) => registeredWallets.add(wallet));
  notify("register", newWallets);
  return () => {
    newWallets.forEach((wallet) => registeredWallets.delete(wallet));
    notify("unregister", newWallets);
  };
}

function get() {
  return [...registeredWallets];
}

function on(event, listener) {
  if (!listeners[event]) throw new Error(`Unsupported wallet event: ${event}`);
  listeners[event].push(listener);
  return () => { listeners[event] = listeners[event].filter((candidate) => candidate !== listener); };
}

export function getWallets() {
  if (walletsApi) return walletsApi;
  walletsApi = Object.freeze({ register, get, on });
  if (typeof window === "undefined") return walletsApi;

  const registrationApi = Object.freeze({ register });
  window.addEventListener("wallet-standard:register-wallet", (event) => {
    try { event.detail(registrationApi); }
    catch (error) { console.error("Wallet Standard registration failed", error); }
  });
  window.dispatchEvent(new WalletStandardAppReadyEvent(registrationApi));
  return walletsApi;
}

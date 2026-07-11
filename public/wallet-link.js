(() => {
  const addressInput = document.querySelector("#wallet-address");
  const result = document.querySelector("#wallet-result");
  const connect = document.querySelector("#connect-wallet");
  const verify = document.querySelector("#verify-wallet");
  let provider = null;
  const apiBase = (window.TRENCH_CONFIG?.backendUrl || "").replace(/\/$/, "");

  const findPhantomProvider = () => {
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom) return window.solana;
    return null;
  };

  const walletErrorMessage = (error) => {
    if (error?.code === 4001) return "Wallet connection was cancelled in Phantom.";
    if (error?.message) return error.message;
    if (typeof error === "string") return error;
    return "Unable to connect Phantom. Make sure the Phantom extension is installed, unlocked, and allowed on this site.";
  };

  if (window.TRENCH_CONFIG?.appEnv !== "production") {
    const banner = document.createElement("p");
    banner.className = "status";
    banner.textContent = `${window.TRENCH_CONFIG?.appEnv || "local"} · ${window.TRENCH_CONFIG?.cluster || "unknown cluster"} · staking preview`;
    document.querySelector("main")?.prepend(banner);
  }

  const setResult = (text, isError = false) => {
    result.textContent = text;
    result.style.color = isError ? "#a40000" : "#145c2e";
  };

  connect.addEventListener("click", async () => {
    try {
      provider = findPhantomProvider();
      if (!provider) throw new Error("Phantom wallet extension was not detected. Install or unlock Phantom, then refresh this page.");
      const response = await provider.connect();
      addressInput.value = response.publicKey.toString();
      setResult("Wallet connected. Sign the verification message when ready.");
    } catch (error) { setResult(walletErrorMessage(error), true); }
  });

  verify.addEventListener("click", async () => {
    verify.disabled = true;
    try {
      provider = provider || findPhantomProvider();
      if (!provider) throw new Error("Connect Phantom before signing.");
      const walletAddress = addressInput.value.trim();
      if (provider.publicKey?.toString() !== walletAddress) throw new Error("Connected wallet does not match the entered address.");
      setResult("Creating a short-lived challenge…");
      const challengeResponse = await fetch(`${apiBase}/api/wallet/challenge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ walletAddress }) });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok) throw new Error(challenge.error || "Unable to create challenge.");
      const signed = await provider.signMessage(new TextEncoder().encode(challenge.message), "utf8");
      const signature = encodeBase58(signed.signature);
      const verifyResponse = await fetch(`${apiBase}/api/wallet/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId: challenge.challengeId, signature }) });
      const payload = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(payload.error || "Verification failed.");
      setResult(`Verified. Live balance: ${payload.balance?.balanceUi ?? "unavailable"} $TRENCH (${payload.balance?.status || "unknown"}).`);
    } catch (error) { setResult(walletErrorMessage(error), true); }
    finally { verify.disabled = false; }
  });

  function encodeBase58(bytes) {
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let digits = [0];
    for (const byte of bytes) {
      let carry = byte;
      for (let i = 0; i < digits.length; i += 1) { carry += digits[i] << 8; digits[i] = carry % 58; carry = Math.floor(carry / 58); }
      while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
    }
    for (let i = 0; i < bytes.length - 1 && bytes[i] === 0; i += 1) digits.push(0);
    return digits.reverse().map((digit) => alphabet[digit]).join("");
  }
})();

(function () {
  const fallbackOptions = [
    "How to buy $TRENCH?",
    "Official CA",
    "Wallet check",
    "Staking status",
    "Mission intel",
    "Security check",
    "Join Telegram",
    "Report issue"
  ];

  const root = document.createElement("div");
  root.id = "trench-widget";
  root.innerHTML = `
    <button class="trench-toggle" aria-label="Open Command Bot">COMMAND BOT</button>
    <section class="trench-panel" aria-live="polite" aria-label="Trench Command Bot">
      <header>
        <span><strong>Command Bot</strong><small><i></i> Online</small></span>
        <button class="trench-close" aria-label="Close">×</button>
      </header>
      <div class="trench-log">
        <p class="bot">&gt; Welcome, Trench Commander.<br>&gt; How can I assist your mission today?</p>
      </div>
      <div class="trench-options"></div>
      <form class="trench-input">
        <input aria-label="Command Bot question" placeholder="Type command...">
        <button aria-label="Send command" type="submit">➜</button>
      </form>
    </section>
  `;
  document.body.appendChild(root);

  const panel = root.querySelector(".trench-panel");
  const log = root.querySelector(".trench-log");
  const options = root.querySelector(".trench-options");
  const form = root.querySelector(".trench-input");
  const input = form.querySelector("input");
  const apiBase = (window.TRENCH_CONFIG?.backendUrl || "").replace(/\/$/, "");

  root.querySelector(".trench-toggle").addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) input.focus({ preventScroll: true });
  });
  root.querySelector(".trench-close").addEventListener("click", () => panel.classList.remove("open"));

  function addMessage(text, source) {
    const p = document.createElement("p");
    p.className = source;
    p.textContent = source === "user" ? `> ${text}` : text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function deterministicAnswer(question) {
    const q = question.toLowerCase();
    if (q.includes("buy")) return "Buy only through the official Pump.fun link: https://pump.fun/coin/H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump";
    if (q.includes("ca") || q.includes("address") || q.includes("mint")) return "Official CA: H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump";
    if (q.includes("wallet")) return "Use Wallet Check on the dashboard. It reads public Solana balance data and does not request a spending transaction.";
    if (q.includes("stake")) return "Staking is preview-only. No token locking, APY, or claims are live until the Solana staking program is deployed and configured.";
    if (q.includes("security")) return "Security check: never share a seed phrase; verify the CA; signing a message should not spend funds; ignore fake support DMs.";
    if (q.includes("telegram") || q.includes("join")) return "Official Telegram: https://t.me/+_ct7Uyx2-C1kYzYx";
    if (q.includes("report")) return "Report issues in the official Telegram and include browser, wallet type, and what action failed.";
    if (q.includes("intel") || q.includes("mission")) return "Mission intel: production site is live, Railway backend is healthy, wallet checks are live, staking remains preview-only.";
    return "Command received. Use official links only: X, Telegram, Coinbase price page, and Pump.fun official $TRENCH coin page.";
  }

  async function ask(question) {
    if (!question.trim()) return;
    addMessage(question, "user");
    input.value = "";
    if (!apiBase) {
      addMessage(deterministicAnswer(question), "bot");
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/widget/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const data = await response.json().catch(() => ({ answer: deterministicAnswer(question) }));
      addMessage(response.ok ? (data.answer || deterministicAnswer(question)) : (data.error || deterministicAnswer(question)), "bot");
    } catch {
      addMessage(deterministicAnswer(question), "bot");
    }
  }

  function renderOptions(items) {
    options.innerHTML = "";
    for (const option of items.slice(0, 8)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option;
      button.addEventListener("click", () => ask(option));
      options.appendChild(button);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });

  window.addEventListener("trench:bot-question", (event) => {
    panel.classList.add("open");
    ask(String(event.detail || ""));
  });

  if (apiBase) {
    fetch(`${apiBase}/api/widget/options`)
      .then((response) => response.json())
      .then((data) => renderOptions(Array.isArray(data.options) && data.options.length ? data.options : fallbackOptions))
      .catch(() => renderOptions(fallbackOptions));
  } else {
    renderOptions(fallbackOptions);
  }
})();

(function () {
  const root = document.createElement("div");
  root.id = "trench-widget";
  root.innerHTML = `
    <button class="trench-toggle" aria-label="Open Trenchcoin bot">$TRENCH</button>
    <section class="trench-panel" aria-live="polite">
      <header>
        <strong>Trench Bot</strong>
        <button class="trench-close" aria-label="Close">x</button>
      </header>
      <div class="trench-log">
        <p>Welcome to the trenches.</p>
      </div>
      <div class="trench-options"></div>
    </section>
  `;
  document.body.appendChild(root);

  const panel = root.querySelector(".trench-panel");
  const log = root.querySelector(".trench-log");
  const options = root.querySelector(".trench-options");

  root.querySelector(".trench-toggle").addEventListener("click", () => panel.classList.toggle("open"));
  root.querySelector(".trench-close").addEventListener("click", () => panel.classList.remove("open"));

  function addMessage(text, source) {
    const p = document.createElement("p");
    p.className = source;
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  async function ask(question) {
    addMessage(question, "user");
    const response = await fetch("/api/widget/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const data = await response.json();
    addMessage(data.answer, "bot");
  }

  fetch("/api/widget/options")
    .then((response) => response.json())
    .then((data) => {
      for (const option of data.options) {
        const button = document.createElement("button");
        button.textContent = option;
        button.addEventListener("click", () => ask(option));
        options.appendChild(button);
      }
    });
})();

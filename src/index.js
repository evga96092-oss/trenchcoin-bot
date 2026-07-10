import { config } from "./config.js";
import { createBot, registerBotCommands } from "./bot.js";
import { createServer } from "./web/server.js";

const app = createServer();
let currentPort = config.port;
let server = app.listen(currentPort, () => {
  console.log(`Trenchcoin backend listening on http://localhost:${currentPort}`);
});

server.on("error", (error) => {
  if (error.code !== "EADDRINUSE") throw error;

  currentPort += 1;
  console.log(`Port ${currentPort - 1} is busy. Trying ${currentPort}.`);
  server = app.listen(currentPort, () => {
    console.log(`Trenchcoin backend listening on http://localhost:${currentPort}`);
  });
});

const bot = createBot();
if (bot) {
  bot.launch();
  registerBotCommands(bot).catch((error) => console.error("Unable to register Telegram commands", error));
  console.log("Telegram bot launched.");
} else {
  console.log("TELEGRAM_BOT_TOKEN not set. Backend/widget running without Telegram polling.");
}

function shutdown(signal) {
  console.log(`${signal} received. Shutting down.`);
  server.close(() => process.exit(0));
  bot?.stop(signal);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

# Trenchcoin Unified Website + Telegram Backend

Launch-focused bot/backend for `$TRENCH`. Wallet ownership is verified through a short-lived Ed25519 signed challenge; balances are read from the canonical mint on the configured Solana cluster. Staking remains an explicitly labeled preview.

## What is included

- Telegram bot with `/start`, `/buy`, `/price`, `/verify`, `/missions`, `/referral`, `/leaderboard`, `/raid`, and `/help`
- Admin-only `/admin_stats`, `/admin_addxp`, `/admin_setraid`, and `/admin_broadcast` scaffold
- SQLite tables for users, wallets, missions, user missions, referrals, raids, XP events, and settings
- Referral codes and XP tracking
- Daily mission foundation
- Signed, replay-resistant Solana wallet verification
- Live canonical-mint SPL balance lookup
- Privacy-safe wallet/Telegram association, unlinking and deletion controls
- Idempotent XP audit events and privacy-safe leaderboards
- Website chatbot widget with fixed official knowledge
- API endpoints for links, widget answers, token dashboard, health, and leaderboard

## Official links

- X: https://x.com/TrenchcoinHQ
- Website: https://trenchcoinhq.netlify.app/
- Telegram: https://t.me/+_ct7Uyx2-C1kYzYx
- Pump.fun: https://pump.fun/coin/H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump
- CA: `H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump`

## Setup

1. Install dependencies:

```bash
npm install
```

On Windows, if PowerShell blocks `npm`, use `npm.cmd install --cache ./.npm-cache`.

2. Create your environment file:

```bash
cp .env.example .env
```

3. Fill in:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_IDS=123456789,987654321
```

4. Check the database:

```bash
npm run db:check
```

5. Start locally:

```bash
npm run dev
```

The backend defaults to `http://localhost:3000`.

## Telegram Commands

- `/start` - branded home menu
- `/buy` - official buy and social links
- `/price` - token dashboard
- `/link` - open the secure website signature flow
- `/verify` - show linked verification status
- `/balance` - refresh the linked `$TRENCH` balance
- `/staking` - accurate preview/devnet status
- `/points` - personal XP/referral summary
- `/privacy` - data-use and account-control summary
- `/unlink` - unlink the verified wallet
- `/delete_me` - delete account data, subject to de-identified anti-fraud audit retention
- `/missions` - daily mission list
- `/referral` - personal referral link/code
- `/leaderboard` - top users by XP
- `/raid` - current raid target
- `/help` - command list

## Admin Commands

Set `TELEGRAM_ADMIN_IDS` to comma-separated Telegram user IDs.

- `/admin_stats`
- `/admin_addxp <user_id> <amount>`
- `/admin_setraid <url>`
- `/admin_broadcast <message>`

Broadcast is intentionally scaffolded until chat opt-in storage is added.

## Website Widget

Local preview:

```text
http://localhost:3000/
```

To embed on the website, include:

```html
<link rel="stylesheet" href="https://your-backend.example/widget.css">
<script src="https://your-backend.example/widget.js" defer></script>
```

The widget answers only from fixed official knowledge. It does not generate freeform investment claims.

## API

- `GET /health`
- `GET /api/links`
- `GET /api/widget/options`
- `POST /api/widget/ask` with `{ "question": "Buy $TRENCH" }`
- `GET /api/price`
- `GET /api/leaderboard`

## Deploy Notes

- Use Node 20+.
- Set environment variables in the deploy platform.
- Persist `DATABASE_PATH` on a durable volume if the platform supports it.
- Use long polling for the Telegram bot today. Webhooks can be added after launch.
- Set `PUBLIC_BASE_URL` to the deployed backend URL.

## Testing Checklist

- Bot starts with `TELEGRAM_BOT_TOKEN`.
- `/start` shows “Welcome to the trenches.” and buttons.
- `/buy` returns only official links.
- `/price` shows token details and “live market data pending integration” if no API is configured.
- `/verify <wallet>` rejects invalid wallet text and saves likely Solana wallet addresses.
- `/missions` shows the seeded missions.
- `/referral` generates a bot start link.
- Start bot from a referral link and confirm referrer XP/referral count changes.
- `/leaderboard` ranks users by XP.
- `/raid` shows the current target.
- Admin commands reject non-admin users.
- Website preview opens and widget options return official answers.

## Production activation status

- Wallet signature and live SPL balance verification are implemented.
- Add market data provider and map fields to price, market cap, liquidity, volume, and holders.
- Add chat opt-in tracking before enabling real broadcasts.
- Add mission completion review/admin approval flow.
- Add webhook deployment mode if long polling becomes inconvenient.
- Add production backup plan for SQLite data.

Staking is not production-ready. The repository contains a devnet program ID reference but no staking program source, IDL, authority specification, instruction builder, audit, or end-to-end tests. Do not enable mainnet staking controls until those artifacts are supplied and independently verified.

See [SPECIFICATION.md](SPECIFICATION.md) and [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

## Safety Rules

- No private keys.
- No fake APYs.
- No promises of profit.
- No investment advice.
- No guaranteed returns.
- No unofficial links.

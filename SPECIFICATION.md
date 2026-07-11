# Trenchcoin Unified Platform Specification

## Status

- Canonical mint: `H57tU3NiERFgfok2Z2iJrgdjh2h12e6bMJwe7HANpump`
- Production cluster default: Solana `mainnet-beta`
- Wallet signature verification: implemented in backend
- SPL balance verification: implemented through configured Solana RPC
- Telegram linking: backend identity model and bot status commands implemented; browser deep-link UX requires deployment URL wiring
- Staking: **preview only**. A devnet program ID is recorded, but no program source, IDL, instruction builder, audit, or reproducible test suite exists in this repository.
- Token distributions: manual approval required; no automated transfer path exists.

## Architecture and data ownership

The Express backend owns wallet challenges, verified wallet links, Telegram associations, XP events, referrals, leaderboards, privacy actions, and balance snapshots. The website and TrenchBot must call this backend rather than implement their own eligibility logic. Solana is authoritative for token balances and any future staking state. SQLite is authoritative for off-chain identity, engagement XP, consent, and audit records.

## Wallet authentication

The server generates a random UUID nonce and an exact message containing domain, wallet, cluster, action, issue time, expiry and a no-transaction warning. The wallet signs the exact UTF-8 message using Ed25519. The server reconstructs the public key from the Solana address and verifies the signature. Challenges are single-use and expire after five minutes by default. A verified wallet cannot be linked to another Telegram identity without support intervention.

## Telegram linking

The bot directs users to the configured public backend for signature verification. Telegram-linked challenges bind the expected Telegram ID server-side. `/verify`, `/balance`, `/points`, `/privacy`, `/unlink`, and `/staking` read backend state. Raw Telegram IDs are never returned by public leaderboards.

## XP and referrals

XP awards use unique audit event keys. Wallet XP is awarded only after a valid signature and only once per wallet. Referral records are unique per referred Telegram identity; production should additionally require verified wallet status before referral payout. Admin XP adjustments require a future audited admin service before launch.

## Privacy

Stored data includes Telegram ID/profile fields, verified public wallet address, referral relationships, XP/audit events and recent public balance snapshots. Users can unlink wallets or delete account data. Minimal de-identified audit events may remain for fraud prevention. Public leaderboards show username, first name, or generated alias—not raw IDs.

## Staking

All production staking controls remain disabled. Public UI must say “Staking Preview” and must not advertise APY, returns, locking or live mainnet staking. Production activation requires program source, IDL, reproducible devnet deployment, authority review, integer-safe math tests, independent security review, mainnet program ID approval and explicit human authorization.

## API

- `GET /health` — backend/cluster/staking summary
- `GET /api/status` — feature truth table
- `POST /api/wallet/challenge` `{walletAddress}`
- `POST /api/wallet/verify` `{challengeId, signature}`
- `GET /api/wallet/:address/balance`
- Existing official links, widget, price and privacy-safe leaderboard endpoints remain.

## Deployment and rollback

Deploy first to an isolated staging service with a staging database and devnet RPC. Run tests and smoke checks, then deploy backend code without enabling financial transfers. Back up SQLite before schema activation. Rollback by restoring the previous application image; new tables are additive and may remain unused. Production environment changes and Telegram webhook activation require human approval.

## Known limitations

- No staking program source or tests in this repository.
- Telegram-to-browser link token presentation is backend-ready but requires the final public backend URL and frontend wallet adapter.
- Mainnet RPC reliability depends on the configured provider.
- No automated financial rewards or token distribution is permitted.

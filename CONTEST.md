# Contest operations

The contest uses the existing Railway SQLite database and the official configured Solana mint. It does not trust balances, decimals, entries, eligibility, or timestamps from the browser.

## Entry rule

The backend calculates `min(maxEntries, rawBalance / (tokensPerEntry × 10^tokenDecimals))` using `BigInt`. Defaults are 1,000,000 whole `$TRENCH` per entry and 10 entries maximum. Display-formatted or floating-point balances are never used in this calculation.

## Verification levels

- `public_lookup`: a pasted public address is checked and audited but does not prove ownership and is excluded from prize eligibility and the official leaderboard.
- `ownership_verified`: Phantom signs a short-lived, single-use human-readable message. The backend verifies Ed25519 ownership. Signing is free and does not authorize a transaction, token access, or spending.

The returned 15-minute signed contest session allows the owner to request `/api/contest/me` and their current rank. It is not a wallet secret and grants no blockchain permissions.

## Reliability and privacy

Successful balance reads transactionally upsert one `contest_wallets` record and append one immutable `contest_check_events` event. Provider failures increment the failure count without replacing the last successful balance or entries. If prior data exists, it may be returned only as `stale: true`.

The database stores the public wallet, public balance, timestamps, verification result, contest entries, provider/slot metadata, application version, and an HMAC-derived abuse identifier. It never stores seed phrases, private keys, transaction authority, raw IP addresses, or browser fingerprints. Abuse identifiers are keyed and scoped to a calendar month. Rotate `ABUSE_HASH_SECRET` every 30 days and retain the previous key only for the minimum incident-review window. Historical contest events are append-only.

## Activation

Check-ins fail closed until `CONTEST_START_AT`, `CONTEST_END_AT`, and `CONTEST_CHECKINS_OPEN=true` are configured. Production validation also requires strong `CONTEST_SESSION_SECRET` and `ABUSE_HASH_SECRET` values. Dates must be official; do not invent them.

Run `npm run release:check` before enabling check-ins. Railway runs `npm run migrate` before deployment.

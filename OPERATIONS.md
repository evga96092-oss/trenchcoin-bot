# Operations

## Monitoring

- Poll `/health` every minute for process availability.
- Poll `/ready` every five minutes; alert after two consecutive failures.
- Alert on Solana RPC readiness failures, repeated challenge verification failures, HTTP 429 spikes, database backup failures and Telegram polling exits.
- Retain structured application logs for 14 days in staging and 30 days in production; redact message signatures, bot tokens, challenge contents, wallet/Telegram associations and database paths.

## Backups

- Mount Railway persistent storage at `/data` when SQLite is used.
- Set `DATABASE_PATH=/data/trenchcoin.sqlite` and `BACKUP_DIR=/data/backups`.
- Run `npm run backup` daily and copy encrypted backups to a separate provider/account.
- Retain seven daily and four weekly backups for the initial launch.
- Test one restore monthly with `npm run restore:validate -- <file>`.

## Incident response

1. Set `WALLET_LINKING_ENABLED=false` or `TELEGRAM_ENABLED=false` and restart if abuse is active.
2. Revoke/rotate affected platform tokens without putting values in chat or logs.
3. Preserve database and logs before remediation.
4. Roll back to the last known release.
5. Validate official links, CORS, `/ready`, signature replay rejection and leaderboard privacy.
6. Publish a factual incident notice only after owner approval.

## Promotion to production

1. Pass CI and staging smoke checks.
2. Create a database backup.
3. Copy configuration names, not secret values, from staging.
4. Set production to mainnet-beta and exact production origins.
5. Keep `STAKING_ENABLED=false`.
6. Deploy backend, then frontend, then enable the production bot after smoke verification.
7. Do not promote staging user data into production.

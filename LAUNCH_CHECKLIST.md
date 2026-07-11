# Controlled Launch Checklist

## Before staging

- [ ] Confirm canonical mint and cluster in environment variables.
- [ ] Use a dedicated RPC key with read-only chain access.
- [ ] Set `PUBLIC_BASE_URL` and exact `ALLOWED_ORIGINS`.
- [ ] Create a durable database volume and encrypted backup.
- [ ] Rotate Telegram bot token if it has ever appeared in logs/screenshots.
- [ ] Run `npm run check`, `npm test`, `npm run db:check`, and `npm audit --omit=dev`.

## Staging smoke test

- [ ] `/health` and `/api/status` report the intended cluster.
- [ ] Challenge expires and cannot be replayed.
- [ ] Wrong signature and mismatched wallet fail closed.
- [ ] Correct signature reads live canonical-mint balance.
- [ ] Repeat verification does not add XP.
- [ ] Public leaderboard contains no Telegram IDs.
- [ ] `/privacy`, `/unlink`, and deletion behavior work.
- [ ] Staking is visibly labeled preview/devnet-only.
- [ ] Official links and full mint match the reference library.

## Manual approval gates

- Mainnet staking program deployment or upgrade.
- Authority, treasury or multisig changes.
- Production database migration with destructive changes.
- Token distributions, transfers, burns, mints or staking.
- Telegram mass announcements or webhook switch.

## Rollback

1. Stop traffic or put the site in maintenance mode.
2. Restore the previous application image/release.
3. Keep additive tables; do not drop them during emergency rollback.
4. Restore the pre-launch database backup only if integrity checks prove corruption.
5. Revoke/rotate compromised tokens or keys and document the incident.
6. Re-run read-only health, RPC and official-link checks before reopening.

## Post-launch monitoring

- Challenge failure/replay rates.
- RPC latency and errors.
- Database write/backup health.
- Bot polling/webhook health.
- Duplicate XP/referral attempts.
- Admin actions and official-link changes.
- Privacy deletion/unlink requests.

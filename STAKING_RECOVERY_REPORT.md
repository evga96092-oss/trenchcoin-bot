# Staking Recovery Report

Date: 2026-07-10

## Locations searched

- Trenchcoin project directories dated 2026-07-06 through 2026-07-10.
- Current backend repository, archived upload package, bot push workspace, website packages and staking-related outputs.
- Filename/content patterns including Anchor/Cargo files, `programs/`, IDLs, `lib.rs`, `declare_id!`, staking instructions, program IDs and deployment notes.

## Material recovered

Anchor workspace:

`C:\Users\Kakozaps\Documents\Codex\2026-07-08\jus\work\trench-staking-anchor`

Recovered non-secret artifacts:

- `Anchor.toml`
- Workspace and program `Cargo.toml`
- `Cargo.lock`
- `programs/trench_staking/src/lib.rs`
- `README.md`
- `DEPLOY-TODAY.md`

The program implements initialize, reward funding, stake, withdraw, claim, pause, minimum stake changes and authority transfer using Anchor 0.30.1 and SPL Token.

## Program IDs and cluster facts

- Recovered source declares: `Fg6PaFpoGXkYsidMpWxTWqMEW2X4tqbJMBGkLZuc8ZLU`.
- Existing website/backend reference: `BhMs58CFjPj8qMnyKRBNEau4VvHDWatSvGoBSCHi6Zio`.
- `Anchor.toml` repeats `Fg6Pa...` for localnet, devnet and mainnet. This is unsafe configuration and resembles a placeholder/default development ID rather than verified environment-specific deployment data.
- Read-only Solana devnet `getMultipleAccounts` at slot 475371379 returned `null` for **both** program IDs. Neither was a deployed executable account at verification time.
- No mainnet query or deployment was performed.

## Secret handling

A file named `trench_staking-keypair.json` exists in a related output directory. It was deliberately not opened, copied, printed or incorporated. Its presence must not be treated as proof of deployment or authority.

## Missing artifacts

- Generated Anchor IDL and TypeScript types.
- Reproducible build output and verified program binary hash.
- Anchor tests.
- Devnet deployment transaction signature.
- Initialized config/vault account addresses.
- Verified upgrade authority.
- Confirmed stake/reward mint account state.
- Evidence that initialize, fund, stake, withdraw and claim succeeded on devnet.
- Independent security review.

## Can staking development continue safely?

Yes, as isolated source development and local/devnet testing. No, as a public or production feature. The recovered source is useful but does not match a verified deployed program. `STAKING_ENABLED` therefore remains forced off, and the UI must remain **Staking Preview**.

Before any deployment, generate a fresh program keypair under secure human control, sync the program ID, remove the identical local/devnet/mainnet IDs, build a reproducible IDL, add comprehensive Anchor tests, review reward-vault solvency behavior and authority controls, deploy only to devnet, and independently verify every instruction.

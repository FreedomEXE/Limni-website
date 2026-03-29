# Limni Agent Notes

## Required Read Before Strategy Research

Before running any backtest, reconstruction, or strategy comparison in this repo, read:

- [docs/BACKTEST_CANONICAL_PROTOCOL.md](C:/Users/User/Documents/GitHub/limni-website/docs/BACKTEST_CANONICAL_PROTOCOL.md)

## Non-Negotiable Rule

Weekly dealer, commercial, and sentiment research must reconcile to the app's canonical source of truth before any new result is trusted.

If a new script cannot reproduce the canonical app baselines documented in the protocol, stop research and fix parity first.

## Canonical Source

Use:

- [src/lib/performance/basketSource.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/basketSource.ts)

Do not rebuild base-model weekly directions independently from raw data if the canonical basket source already defines them.

## Hand-off Line

Use this line in future sessions or handoffs:

`Before any new backtest, verify parity against canonical app baselines using basketSource.ts and the approved closed-week window. If parity fails, stop research and fix parity first.`

# Bots

Trading worker entrypoints.

## Contents

| Path | Purpose |
|---|---|
| `bitget-perp-bot.ts` | Bitget perpetual worker. Started by `npm run bot:bitget`. |
| `oanda-universal-bot.ts` | OANDA universal worker. Started by `npm run bot:oanda`. |

## Rules

- Treat as live automation code.
- `render.yaml` starts these workers through package scripts.
- Future move target is `services/bots/`, but move only in a service migration
  gate that updates package scripts and deployment config together.

# Scripts

App tooling, verification commands, maintenance scripts, and legacy research
runners.

## Key Folders

| Path | Purpose |
|---|---|
| `verification/` | App/indicator parity exporters and inspectors. |
| `research/` | Research-only helper scripts that still belong with script tooling. |
| `db/` | DB probes and maintenance helpers. |
| `pinescript/` | TradingView verifier scripts. |

## Rules

- Package scripts and workflows reference many files here directly.
- Do not move scripts broadly without updating package scripts, imports, docs,
  and workflow commands.
- `migrate-trades-to-unified-ledger.ts` is production-sensitive and needs its
  own DB migration safety review.

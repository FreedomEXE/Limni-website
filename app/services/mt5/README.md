# MT5

MetaTrader 5 integration workspace.

## Contents

| Path | Purpose |
|---|---|
| `Experts/` | Expert advisors and generated include files. |
| `Indicators/` | MT5 indicators. |
| `Scripts/` | MT5 utility scripts. |
| `Templates/` | MT5 chart/template assets. |
| `docs/` | MT5-specific notes. |

## Rules

- This folder is anchored by `.github/workflows/contract-artifacts-sync.yml`,
  `.husky/pre-commit`, `.vercelignore`, and `scripts/generate-contracts.ts`.
- Future move target is `services/mt5/`, but do not move it in broad cleanup.
- Generated files must stay consistent with the contract generator.

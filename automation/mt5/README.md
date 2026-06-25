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
  `.husky/pre-commit`, `.vercelignore`, and
  `automation/scripts/generate-contracts.ts`.
- MT5 belongs under root `automation/mt5/`.
- Generated files must stay consistent with the contract generator.

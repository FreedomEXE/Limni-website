# MT5

MetaTrader 5 integration workspace.

## Contents

| Path | Purpose |
|---|---|
| `Experts/` | Expert advisors and generated include files. |
| `Indicators/` | MT5 indicators. |
| `Scripts/` | MT5 utility scripts. |
| `Templates/` | MT5 chart/template assets. |

MT5 research receipts and historical notes live under root `docs/` or
`archive/`.

## Active Hedge EA

- `Experts/LimniBasketHedgeEAAlphaV3.mq5` is the active raw no-boundary harvest
  EA.
- `Experts/Include/Strategy/RawHarvestEngine.mqh` is its only project-local
  strategy include.
- Previous hedged prototype versions belong under root `archive/automation/mt5/`.

## Rules

- This folder is anchored by `.github/workflows/contract-artifacts-sync.yml`,
  `.husky/pre-commit`, `.vercelignore`, and
  `automation/scripts/generate-contracts.ts`.
- MT5 belongs under root `automation/mt5/`.
- Generated files must stay consistent with the contract generator.

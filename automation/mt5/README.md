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

## Active Portfolio EA

- `Experts/Limni/LimniPortfolioEA.mq5` is the active institutional portfolio EA path.
- `Experts/Include/Core/Engine.mqh` owns lifecycle orchestration.
- Strategy lanes under `Experts/Include/Strategies/` emit intents only.
- `Experts/Include/Execution/TradeRouter.mqh` is the only layer allowed to own
  MT5 trade execution.
- Legacy root-level EAs and root-level legacy indicators are parked under
  `Experts/Archived/` and `Indicators/Archived/` for reference only.

## Rules

- This folder is anchored by `.github/workflows/contract-artifacts-sync.yml`,
  `.husky/pre-commit`, `.vercelignore`, and
  `automation/scripts/generate-contracts.ts`.
- MT5 belongs under root `automation/mt5/`.
- Generated files must stay consistent with the contract generator.

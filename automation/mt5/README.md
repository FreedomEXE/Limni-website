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

## Portfolio EA Strategy Graduation Rule

`LimniPortfolioEA` is the portfolio allocator/executor, not the research
playground. New strategy ideas must not be added directly to the portfolio EA
as loose inputs or experimental branches.

The required lifecycle is:

```text
idea -> isolated scaffold/prototype -> evidence review -> simplified formula
-> lifecycle/receipt proof -> minimal operator surface -> portfolio allocation
```

Before a strategy graduates into `LimniPortfolioEA`, it must be explainable as a
small named account mode, not as a bag of tuning parameters. Revma is the first
active example: the target operating surface is account-level language such as
`Revma`, `Revma Fast`, `Revma Slow`, or `Revma Hybrid`, with the underlying
formula and lifecycle rules hardcoded or nearly hardcoded.

Graduation requirements:

- stable formula identity and formula hash
- fixed birth/reentry/add/exit ownership rules
- receipt proof for lifecycle behavior
- no placeholder inputs for future systems
- no duplicated account-level exit logic without an explicit architecture gate
- clear capital/margin allocation model before multi-strategy operation
- dashboard/read-only monitoring separated from execution ownership

Research scaffolds may be messy. `LimniPortfolioEA` should only receive
strategies after they have been reduced to a durable formula and a small,
operator-readable account mode.

## Revma v001 Exit Contract

Revma v001 is the current Pair Direction / Grid Sleeve strategy.

The active one-pair crude exit mode is grid based. In
`StopTakeProfitMode=SinglePairQAfterFees`, `TakeProfit` and `StopLoss` are q
units for the frozen active Revma grid, not broker-side ticket TP/SL distances.
The EA sums the active grid's open money, subtracts estimated close fees, and
queues a close-grid intent when the configured threshold is reached.

In this mode, the MT5 trade table `T/P` and `S/L` fields can remain `0.00000`.
Correctness is proven by `revma_grid_exit`, close request/result receipts, and
flat post-close grid inventory, not by broker-side TP values on individual
tickets.

Account-level percent mode remains separate and must stay behind the account
close execution switch. Do not duplicate account harvest, portfolio harvest, or
strategy grid-exit logic without a named architecture gate.

## Rules

- This folder is anchored by `.github/workflows/contract-artifacts-sync.yml`,
  `.husky/pre-commit`, `.vercelignore`, and
  `automation/scripts/generate-contracts.ts`.
- MT5 belongs under root `automation/mt5/`.
- Generated files must stay consistent with the contract generator.

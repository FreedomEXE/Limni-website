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
- `Experts/Include/Core/Engine.mqh` owns the current lifecycle orchestration
  checkpoint, but the target boundary is a generic portfolio orchestrator only.
- Strategy lanes under `Experts/Include/Strategies/` emit intents only; strategy
  internals should be owned in per-strategy folders, not scattered across the
  include tree.
- `Experts/Include/Execution/TradeRouter.mqh` is the only layer allowed to own
  MT5 trade execution.
- Legacy root-level EAs and root-level legacy indicators are parked under
  `Experts/Archived/` and `Indicators/Archived/` for reference only.

## Portfolio EA Architecture Boundary

The portfolio EA must not become either a monolithic EA or a collection of
mini-engines. Keep one thin wrapper and one portfolio engine:

```text
LimniPortfolioEA.mq5 -> LP_Engine -> shared portfolio/risk/execution modules
```

`LP_Engine` should coordinate:

- init/deinit/tick/timer/trade-transaction entry points
- config loading and module initialization
- portfolio, grid, exposure, and signal refresh order
- lifecycle/protection manager calls
- strategy registry calls
- intent bus, risk arbitration, trade routing, and receipt flushing

`LP_Engine` should not own strategy-specific rules. In particular, Revma
startup/reentry state, observed direction/sleeve/variant state, Revma grid TP
math, Revma post-close same-state blocking, Revma dashboard rendering, and
Revma-specific receipt construction belong outside `Core/Engine.mqh`.

Do not split into `RevmaEngine`, `TrendEngine`, `KataraktiEngine`, or similar
strategy engines. That fragments portfolio-level governance. Use one portfolio
engine with strategy modules and lifecycle/protection managers.

Target include ownership:

```text
Experts/Include/
  Core/
    Engine.mqh
    Config.mqh
    Types.mqh
    SymbolUniverse.mqh

  Strategies/
    StrategyRegistry.mqh
    StrategyContracts.mqh
    Revma/
      RevmaStrategy.mqh
      RevmaTypes.mqh
      RevmaSignalState.mqh
      RevmaGridSleeve.mqh
      RevmaLifecycleGate.mqh
      RevmaGridExitManager.mqh
      RevmaGridProtectionManager.mqh
      RevmaVisualReporter.mqh

  Portfolio/
    PositionIndex.mqh
    GridBook.mqh
    GridProtectionBook.mqh
    CurrencyExposureGuard.mqh
    PortfolioStopTakeProfitGuard.mqh

  Execution/
    RiskArbiter.mqh
    TradeRouter.mqh
    RetcodeClassifier.mqh
    MagicCodec.mqh

  Receipts/
    ReceiptWriter.mqh
```

Folder rule:

- Strategy-specific code lives under that strategy folder, for example
  `Strategies/Revma/`.
- `Strategies/` root should hold registry/contracts only.
- `Signals/` should hold shared signal primitives only. If a signal file is
  Revma-only, move it under `Strategies/Revma/` during the architecture gate.
- Shared portfolio inventory, exposure, execution, and receipt code stays in
  shared folders only when it is genuinely strategy-agnostic.

Pitfalls to avoid:

- Do not add broker-visible grid TP logic directly to `Engine.mqh`.
- Do not put `CTrade`, `PositionModify`, or `TRADE_ACTION_SLTP` outside
  `TradeRouter.mqh`.
- Do not let a temporary strategy scaffold become a shared contract without an
  architecture gate.
- Do not duplicate account-level harvest, account-percent SL/TP, and
  strategy-grid exit logic in separate places.
- Do not treat managed close-grid receipts as proof of visible broker-side
  ticket TP behavior.
- Do not run all-28, optimization, or promotion tests while the one-pair Revma
  lifecycle and grid TP mechanics are still under architecture repair.

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

## Revma v001 Exit Contract Checkpoint

Revma v001 is the current Pair Direction / Grid Sleeve strategy.

In `StopTakeProfitMode=SinglePairQAfterFees`, Revma single-pair exits are owned
by the frozen active grid, not by individual entry signals. Reversion and
continuation grids have separate operator values:

```text
RevmaReversionGridSpacingQ
RevmaContinuationGridSpacingQ
RevmaReversionTakeProfit
RevmaReversionStopLoss
RevmaContinuationTakeProfit
RevmaContinuationStopLoss
```

The generic `RevmaGridSpacingQ`, `TakeProfit`, and `StopLoss` inputs remain the
default Revma controls. Sleeve-specific values are overrides: keep a sleeve
field at `0.0` to inherit the generic value, and set it above zero only when
that sleeve must differ.

Continuation grids need a reachable target. If a continuation grid is configured
with `RevmaContinuationTakeProfit <= RevmaContinuationGridSpacingQ`, the next
with-trend add can move the basket TP away at least as fast as the add cadence.
The EA must skip continuation adds under that impossible setup instead of
building an unhittable grid.

The intended Revma grid TP behavior is broker-visible grid TP synchronization:

```text
one trade -> ticket has visible TP
new add fills -> all open tickets in that grid update to one shared basket TP
broker TP hit -> intended grid closes
```

The Revma dashboard must show the operator state first (`LONG`/`SHORT` and
`ACTIVE`/`WAITING`), then secondary details. The centerline is not optional for
visual review because it determines whether the current signal is continuation
or reversion. `BIRTH ID` means the live signal still matches the frozen grid
identity; it is not a TP or profitability status.

Account-level percent mode remains separate and must stay behind the account
close execution switch. Do not duplicate account harvest, portfolio harvest, or
strategy grid-exit logic without a named architecture gate.

## Rules

- This folder is anchored by `.github/workflows/contract-artifacts-sync.yml`,
  `.husky/pre-commit`, `.vercelignore`, and
  `automation/scripts/generate-contracts.ts`.
- MT5 belongs under root `automation/mt5/`.
- Generated files must stay consistent with the contract generator.

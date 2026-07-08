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

Revma v001 is the current Pair Direction / Mean-Reversion Grid strategy.

In `StopTakeProfitMode=SinglePairQAfterFees`, Revma single-pair exits are owned
by the frozen active grid, not by individual entry signals. Revma has one
operator grid spacing and one generic stop/take-profit control set:

```text
RevmaGridSpacingQ
TakeProfit
StopLoss
StopTakeProfitCloseCommissionPerLot
```

Revma is mean-reversion only. LONG signals are eligible only below the
centerline, and SHORT signals are eligible only above the centerline. With-trend
states are rejected by Revma instead of being treated as a continuation sleeve.
No continuation controls are registered, exposed, or executable in
`LimniPortfolioEA`; if a continuation strategy returns later, it must return as
a separate strategy with its own lifecycle, receipts, dashboard terms, and
operator surface.

The intended Revma grid TP behavior is broker-visible grid TP synchronization:

```text
one trade -> ticket has visible TP
new add fills -> all open tickets in that grid update to one shared basket TP
broker TP hit -> intended grid closes
```

The Revma dashboard must show the operator state first (`LONG`/`SHORT` and
`ACTIVE`/`WAITING`), then secondary details. The centerline is not optional for
visual review because it determines whether the current signal is a valid
mean-reversion setup. `BIRTH ID` means the live signal still matches the frozen
grid identity; it is not a TP or profitability status.

Account-level percent mode remains separate and must stay behind the account
close execution switch. Do not duplicate account harvest, portfolio harvest, or
strategy grid-exit logic without a named architecture gate.

## Terminal Sync Gate

A repo compile is not sufficient proof that Freedom's MT5 terminals are running
the updated EA. Before calling an MT5 EA gate done, run the terminal sync gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\mt5\tools\Sync-LimniPortfolioEA-Terminals.ps1
```

Configured terminal roots live in `automation/mt5/terminal-roots.json`. Keep that
manifest current when the active MT5 install changes.

The sync gate:

- compiles the repo EA source;
- mirrors `Experts/Limni/LimniPortfolioEA.mq5`,
  `Experts/Limni/LimniPortfolioEA.ex5`, and `Experts/Include/` into each
  configured terminal `MQL5` tree;
- compiles each terminal-local EA source;
- writes SHA256 parity proof for the repo source/includes against each terminal
  copy;
- can install and hash-check the canonical FX28 tester profile
  `MQL5\Profiles\Tester\LimniPortfolioEA.set`;
- can archive saved tester profiles that still contain banned old input names,
  then enforce zero stale tester-profile matches;
- fails if active EA/README paths reintroduce old Revma split-sleeve terms;
- warns by default if saved tester profiles still contain stale keys, because
  those are user/tester settings rather than active EA source;
- records running `terminal64.exe` processes and can fail on unknown terminals
  with `-FailOnUnknownRunningTerminal`.

Use `-FailOnStaleTesterProfiles` only when the gate explicitly includes tester
profile cleanup.

When an all-28 Strategy Tester run is part of the gate, force the tester profile
into the MT5 data roots before launch:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\mt5\tools\Sync-LimniPortfolioEA-Terminals.ps1 -SyncTesterProfile -FailOnTesterProfileDrift
```

When stale saved tester profiles must be removed from active MT5 profile roots,
archive them into the gate artifact instead of deleting them:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\mt5\tools\Sync-LimniPortfolioEA-Terminals.ps1 -SyncTesterProfile -FailOnTesterProfileDrift -ArchiveStaleTesterProfiles -FailOnStaleTesterProfiles
```

## Revma FX28 Fast Smoke

`LimniPortfolioEA` supports all-28 Revma testing. Use:

```text
RevmaUniverseMode = UniverseFx28
```

The first fast all-28 mechanics preset is:

```text
automation/mt5/tester-presets/limni-portfolio-revma-fx28-fast-smoke-20260101-20260108.ini
```

For the Strategy Tester input grid, load:

```text
automation/mt5/tester-presets/limni-portfolio-revma-fx28-fast-smoke.set
```

For repeatable command-line proof, use the runner instead of relying on the MT5
UI's remembered input grid:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\mt5\tools\Run-LimniPortfolioEA-FX28Smoke.ps1
```

The runner installs a run-specific `LimniPortfolioEA.set`, launches the official
tester config path, verifies receipt proof for 28-symbol evaluation and
account-level close execution, then restores the canonical FX28 `.set` profile
in each configured terminal data root.

Recommended first-pass MT5 settings:

```text
Expert=Limni\LimniPortfolioEA.ex5
Symbol=EURUSD.i
Period=M1
Model=Open prices only / fastest smoke
RevmaUniverseMode=UniverseFx28
RevmaQProfile=Fast
RevmaShowVisualDashboard=false
StopTakeProfitMode=MultiCurrencyPercentAfterFees
EnableCloseExecution=true
EnableAccountCloseExecution=true
RequireAllSymbols=true
```

`Symbol=EURUSD.i` only drives the tester clock. With `UniverseFx28`, the EA
evaluates the fixed 28-pair universe from `Experts/Include/Core/SymbolUniverse.mqh`.
Start with the fast one-week preset before extending the date range.

For the first patched FX28 run, verify the first `engine_step` receipt reports:

```text
active_symbols_scanned=28
clock_ready_symbols=28
evaluated_symbols=28
forced_initial_fx28_symbols=28
```

For multi-currency TP proof, use the managed close-all receipts. In
`StopTakeProfitMode=MultiCurrencyPercentAfterFees`, broker ticket `T/P` fields
are not the proof surface. The expected receipts are:

```text
stop_take_profit_guard status=monitoring
stop_take_profit_guard status=account_exit_intent liquidation_active=true
order_request status=close_scan_complete close_scope=account_all_ea
```

If `close_all_pending=true`, later engine steps should keep emitting account
close-all intents and should block new Revma entries until managed positions are
flat.

## Rules

- This folder is anchored by `.github/workflows/contract-artifacts-sync.yml`,
  `.husky/pre-commit`, `.vercelignore`, and
  `automation/scripts/generate-contracts.ts`.
- MT5 belongs under root `automation/mt5/`.
- Generated files must stay consistent with the contract generator.

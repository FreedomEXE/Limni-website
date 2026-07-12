# Gate 99ZX - Revma Portfolio EA Architecture Review Packet

Date: 2026-07-07

## Review Target

Primary EA path:

- `automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`
- all direct and indirect `.mqh` includes under `automation/mt5/Experts/Include/`
- Revma strategy modules under `automation/mt5/Experts/Include/Strategies/`
- Revma closed-M1 state module under `automation/mt5/Experts/Include/Signals/`
- shared pair-direction truth in `automation/mt5/Indicators/Include/LimniPairDirectionCore.mqh`
- StateMap only where it proves the visual indicator and EA consume the same pair-direction core
- settings/input architecture in `automation/mt5/Experts/Include/Core/Config.mqh`
- receipt/event architecture under `automation/mt5/Experts/Include/Receipts/`

Explicitly not the review target:

- raw hedge EA experiments
- Alpha V3
- legacy Katarakti strategy code
- old archived EA variants
- repo-wide cleanup/removal decisions
- backtest or performance claims

## Exact Entry Point

`automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`

This file is intentionally thin. It includes:

`automation/mt5/Experts/Include/Core/Engine.mqh`

## Dependency / Include Tree

Generated artifacts:

- `docs/research/gates/gate99/artifacts/gate99zx-revma-portfolio-ea-architecture-review-2026-07-07/LimniPortfolioEA-include-tree.txt`
- `docs/research/gates/gate99/artifacts/gate99zx-revma-portfolio-ea-architecture-review-2026-07-07/LimniPortfolioEA-include-flat-list.txt`

Top-level include shape:

```text
automation/mt5/Experts/Limni/LimniPortfolioEA.mq5
  automation/mt5/Experts/Include/Core/Engine.mqh
    Core: BuildInfo, Types, Config, SymbolUniverse
    Market: SessionCalendar, NewsCalendar, SymbolSpecCache, TickBarCache, M1Clock
    Signals: LrmgState, RevmaSignalState
    Strategies: StrategyRegistry, PortfolioIntentSelector, IntentBus
    Portfolio: PositionIndex, GridBook, PortfolioState, CurrencyExposureGuard, AccountHarvestGuard, RiskArbiter
    Execution: TradeRouter, MagicCodec, TradePlan, RetcodeClassifier
    Receipts: ReceiptWriter, RunManifest, DecisionLog, StateSnapshot
    Shared indicators: LimniPairDirectionCore, LimniRadialMovementGrid, LimniQStateCore, LimniLRMGStackCore
```

`TradeRouter.mqh` also includes MT5 standard library `Trade/Trade.mqh`.

## Common Portfolio Infrastructure

Common infrastructure is the EA shell and reusable plumbing, not Revma alpha:

- `Engine.mqh`: central orchestration, init/deinit, closed-M1 stepping, portfolio refresh, harvest close intent, strategy dispatch, risk arbitration, execution, and engine receipts.
- `Types.mqh`: shared enums/structs for symbols, lanes, variants, intents, risk decisions, config, grid inventory, receipts, and portfolio state.
- `Config.mqh`: inputs and `LP_Config` loading.
- `SymbolUniverse.mqh`, `SymbolSpecCache.mqh`: canonical FX28 mapping and broker symbol metadata.
- `M1Clock.mqh`, `TickBarCache.mqh`: common market timing/tick cache.
- `PositionIndex.mqh`, `GridBook.mqh`, `PortfolioState.mqh`: common open-position and grid inventory.
- `CurrencyExposureGuard.mqh`, `AccountHarvestGuard.mqh`, `RiskArbiter.mqh`: common risk/harvest controls.
- `TradeRouter.mqh`: common order execution and close execution.
- `ReceiptWriter.mqh`, `ReceiptTypes.mqh`, `RunManifest.mqh`, `DecisionLog.mqh`, `StateSnapshot.mqh`: common event/audit output.

Important current defaults in `Config.mqh`:

- `RequireAllSymbols=false` for current-chart tester workflow.
- `EnableCurrencyExposureGuard=false` for loose first Revma research.
- `EnableRevmaSystem=true`.
- `RevmaUniverseMode=LP_UNIVERSE_CURRENT_CHART`.
- `EnableQStateTrendVariant=false`.

## Revma-Specific Strategy Logic

Revma-specific files:

- `RevmaTypes.mqh`: system identity, formula identity, sleeve enum, Revma signal contract, pip helper, sleeve classifier.
- `RevmaSignalState.mqh`: closed-M1 chart-symbol/incremental state builder that produces `LP_RevmaSignal`.
- `RevmaGridSleeve.mqh`: locked grid-sleeve strategy, birth/add metadata, add policy, and birth/add receipts.

Revma identity:

- `system_id=revma-v001`
- `system_name=Revma v001`
- `formula_id=revma-pair-direction-grid-v001`

Revma is active through `StrategyRegistry.EvaluateRevma()`. The old trend/reversal lane path remains compiled but is gated behind disabled Q-state settings.

## Shared Pair Direction Core

Shared truth:

`automation/mt5/Indicators/Include/LimniPairDirectionCore.mqh`

The pair-direction core owns:

- deterministic point/sample evaluation
- raw direction
- confirmed direction
- pending direction/count
- trend score
- exhaustion score
- confidence
- formula id/hash

StateMap uses the array/replay path from this shared core for visual display. Revma EA uses the scalar `LimniPairDirectionEvaluatePoint()` path from the same core for incremental closed-M1 processing. That is the intended shared direction truth: one formula file, two consumers.

## RevmaSignalState State

The user prompt mentioned `RevaSignalState.mqh`; the current implemented file is:

`automation/mt5/Experts/Include/Signals/RevmaSignalState.mqh`

State held per symbol:

- bootstrapped flag
- last processed closed-M1 time
- closed-M1 bar count
- current day bar arrays
- completed day q samples
- radial event stack
- cached anchor/line/range metrics
- last trend state
- previous raw direction
- confirmed direction latch
- pending flip direction/count
- pair-direction extreme tracker
- latest pair-direction result

Why this file exists:

- The EA must be fast enough for tester runs and should not rebuild indicator arrays on every tick.
- The EA needs closed-M1 state that survives across ticks within one tester run.
- q-day calculation, event stack, anchor, stochastic, trend state, and confirmed direction need to be incrementally maintained per symbol.
- This keeps Revma strategy logic out of the portfolio shell and keeps the pair-direction formula in the shared core.

## Settings Ownership

Portfolio shell settings:

- execution mode
- trading/routing enable flags
- hedging requirement
- symbol universe metadata requirement
- calendar/news guard settings
- harvest governor settings
- common portfolio risk guard settings
- diagnostics/output settings

Revma settings:

- `EnableRevmaSystem`
- `RevmaUniverseMode`
- `RevmaEnableContinuationSleeve`
- `RevmaEnableReversionSleeve`
- `RevmaFixedLots`
- `RevmaGridSpacingQ`
- `RevmaIntentExpiryMinutes`
- `RevmaBootstrapM1Bars`

Future system settings:

- should live under their own named input section
- should have their own enable toggle
- should have system-specific receipts and formula identity
- must not borrow hidden Revma logic unless explicitly promoted to common infrastructure

## Katarakti Exclusion

Revma excludes Katarakti at the strategy level:

- `RevmaTypes.mqh`, `RevmaSignalState.mqh`, and `RevmaGridSleeve.mqh` have no Katarakti references.
- Revma birth/add receipts do not include Katarakti fields.
- `Engine.mqh` calls `EvaluateRevma()` when Revma is enabled and does not invoke Katarakti strategy code.
- Legacy Q-state/Katarakti-adjacent include paths still exist elsewhere in the repo, but Revma does not use them for trigger/filter/fallback logic.

Static scan artifact from Gate 99ZW:

`docs/research/gates/gate99/artifacts/gate99zw-revma-v001-grid-sleeve-ea-prototype-2026-07-07/static-scan-revma-no-katarakti-qstate.txt`

## StateMap And EA Direction Truth

StateMap relevant files:

- `automation/mt5/Indicators/Limni/StateMap.mq5`
- `automation/mt5/Indicators/Include/LimniPairDirectionCore.mqh`

StateMap displays `confirmed_direction` from `LimniPairDirectionCore.mqh`.

Revma uses `LimniPairDirectionEvaluatePoint()` from `LimniPairDirectionCore.mqh`, then carries `confirmed_direction` into `LP_RevmaSignal.direction`.

Expected review question:

- verify that StateMap array replay and EA scalar point evaluation remain formula-equivalent for the same closed-M1 source sequence.

## Grid Birth Classification

Birth classification happens in:

`RevmaSignalState.mqh -> BuildSignalFromResult()`

It calls:

`RevmaTypes.mqh -> LP_RevmaClassifySleeve()`

Classification rule:

- direction LONG and price above anchor: continuation
- direction SHORT and price below anchor: continuation
- direction LONG and price below anchor: reversion
- direction SHORT and price above anchor: reversion

The resulting `sleeve` maps to:

- `LP_VARIANT_REVMA_CONTINUATION`
- `LP_VARIANT_REVMA_REVERSION`

## Setup Type Lock

The sleeve/setup type is locked by the first open grid intent:

- `RevmaGridSleeve.mqh -> BuildIntent()` writes `lane_id=LP_LANE_REVMA` and `variant_id=signal.variant_id`.
- Magic/grid identity then flows through common execution and inventory.
- `GridBook.mqh -> FindGrid()` groups existing positions by symbol, lane, variant, and direction.
- Later adds only look for the same symbol/lane/variant/direction row.

The live grid does not reclassify if price later crosses the anchor.

## Add Policy Lock

Add policy is derived from locked sleeve plus direction in:

`RevmaGridSleeve.mqh`

Continuation:

- LONG continuation: add higher.
- SHORT continuation: add lower.

Reversion:

- LONG reversion: add lower.
- SHORT reversion: add higher.

The add policy string is written into birth/add receipt metadata.

## Receipts

Revma signal receipts:

- `Engine.mqh -> WriteRevmaSignalReceipt()`

Revma birth/add receipts:

- `RevmaGridSleeve.mqh -> LP_RECEIPT_REVMA_GRID_BIRTH`
- `RevmaGridSleeve.mqh -> LP_RECEIPT_REVMA_GRID_ADD`

Common intent/risk/plan receipts:

- `DecisionLog.mqh -> LP_LogTradeIntent()`
- `DecisionLog.mqh -> LP_LogRiskDecision()`
- `DecisionLog.mqh -> LP_LogTradePlan()`

Order request/result receipts:

- `TradeRouter.mqh -> LP_RECEIPT_ORDER_REQUEST`
- `TradeRouter.mqh -> LP_RECEIPT_ORDER_RESULT`

Trade transaction receipts:

- `Engine.mqh -> OnTradeTransaction()`

Harvest receipts:

- `Engine.mqh -> LP_WriteHarvestState()`
- `Engine.mqh -> AddHarvestCloseIntent()`
- `AccountHarvestGuard.mqh -> RequiresAccountClose()`

Close execution receipts:

- close intent/decision/plan are logged through the common DecisionLog path
- close order request/result are logged through `TradeRouter.mqh`

## Cross-Contamination Controls

Current controls:

- system-specific enable toggle: `EnableRevmaSystem`
- future/legacy Q-state toggle: `EnableQStateTrendVariant=false`
- engine dispatch: Revma branch runs before legacy Q-state branch
- legacy Q-state branch is only reachable when Revma is disabled and Q-state is enabled
- Revma lane id: `LP_LANE_REVMA`
- Revma variants: continuation/reversion
- Revma formula id/hash in manifest and receipts
- Revma-only files statically scan clean for Katarakti/Q-state references
- strategy modules emit intents; common router executes plans
- receipt kinds separate Revma signal/birth/add from common intent/risk/order events

Known review caveat:

- `Config.mqh` and `RunManifest.mqh` still include `LimniQStateCore.mqh` for the disabled legacy Q-state settings/metadata path. That is not a Revma trigger/filter path, but it is still part of the compile include tree and should be reviewed as legacy coupling to clean up in a later repo-wide cleanup gate.

## Review Questions For ChatGPT Pro

1. Does `RevmaSignalState.mqh` correctly preserve formula equivalence with `LimniPairDirectionCore.mqh` while avoiding indicator-array rebuilds?
2. Is the engine dispatch clean enough, or should legacy Q-state be moved further away from the active Revma branch?
3. Is sleeve/setup locking sufficiently durable through magic/grid inventory?
4. Are birth/add receipts rich enough for first visual tester audits?
5. Are portfolio-shell inputs separated cleanly from Revma-specific settings?
6. Are there any hidden paths where legacy Q-state or Katarakti can influence Revma decisions?
7. Is the current common infrastructure boundary clear enough before adding future systems?

## Non-Claims

This packet does not claim:

- backtest results
- profitability
- live readiness
- VPS readiness
- exposure guard effectiveness
- grid cap effectiveness
- repo cleanup completion

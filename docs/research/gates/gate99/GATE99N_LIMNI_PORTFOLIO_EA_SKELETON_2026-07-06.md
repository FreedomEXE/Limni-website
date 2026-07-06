# Gate 99N - LimniPortfolioEA Institutional Skeleton

Date: 2026-07-06

## Scope

Gate 99N opens the new product EA path:

- `automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`

`LimniBeta.mq5` is no longer the product path. It remains untouched as a legacy
diagnostic/reference scaffold.

This gate builds the zero-trading institutional skeleton only. It does not add
real strategy logic, grid entries, account harvest execution, live trading, or
promotion claims.

## Architecture Contract

The enforced chain is:

```text
TradeIntent -> RiskDecision -> TradePlan -> TradeRouter -> Receipt
```

Hard boundaries:

- Strategies emit `TradeIntent` only.
- `RiskArbiter` converts intents into `RiskDecision` and `TradePlan`.
- Only `TradeRouter.mqh` includes `Trade/Trade.mqh` or owns `CTrade`.
- Receipts are centralized through `ReceiptWriter.mqh`.
- v1 requires a hedging account; netting fails fast.
- Live trading is disabled by default and requires explicit execution-mode
  authorization.
- `OnTick` is a heartbeat, not a 28-symbol event feed.
- No full-history copy is done in strategy paths.

## Added Source Files

- `automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`
- `automation/mt5/Experts/Include/Core/BuildInfo.mqh`
- `automation/mt5/Experts/Include/Core/Types.mqh`
- `automation/mt5/Experts/Include/Core/Config.mqh`
- `automation/mt5/Experts/Include/Core/SymbolUniverse.mqh`
- `automation/mt5/Experts/Include/Core/Engine.mqh`
- `automation/mt5/Experts/Include/Market/SessionCalendar.mqh`
- `automation/mt5/Experts/Include/Market/SymbolSpecCache.mqh`
- `automation/mt5/Experts/Include/Market/TickBarCache.mqh`
- `automation/mt5/Experts/Include/Market/M1Clock.mqh`
- `automation/mt5/Experts/Include/Signals/SignalSnapshot.mqh`
- `automation/mt5/Experts/Include/Signals/LrmgState.mqh`
- `automation/mt5/Experts/Include/Strategies/IntentBus.mqh`
- `automation/mt5/Experts/Include/Strategies/StrategyRegistry.mqh`
- `automation/mt5/Experts/Include/Strategies/TrendFollowLane.mqh`
- `automation/mt5/Experts/Include/Strategies/ReversalLane.mqh`
- `automation/mt5/Experts/Include/Portfolio/PositionIndex.mqh`
- `automation/mt5/Experts/Include/Portfolio/GridBook.mqh`
- `automation/mt5/Experts/Include/Portfolio/PortfolioState.mqh`
- `automation/mt5/Experts/Include/Portfolio/CurrencyExposureGuard.mqh`
- `automation/mt5/Experts/Include/Portfolio/AccountHarvestGuard.mqh`
- `automation/mt5/Experts/Include/Portfolio/RiskArbiter.mqh`
- `automation/mt5/Experts/Include/Execution/MagicCodec.mqh`
- `automation/mt5/Experts/Include/Execution/TradePlan.mqh`
- `automation/mt5/Experts/Include/Execution/TradeRouter.mqh`
- `automation/mt5/Experts/Include/Execution/RetcodeClassifier.mqh`
- `automation/mt5/Experts/Include/Receipts/ReceiptTypes.mqh`
- `automation/mt5/Experts/Include/Receipts/ReceiptWriter.mqh`
- `automation/mt5/Experts/Include/Receipts/RunManifest.mqh`
- `automation/mt5/Experts/Include/Receipts/DecisionLog.mqh`
- `automation/mt5/Experts/Include/Receipts/StateSnapshot.mqh`

## Calendar And News Guard

`SessionCalendar.mqh` now owns the shared calendar guard contract.

Week-boundary no-trade windows are preserved:

```text
Sunday 17:00-17:59 EST
Friday 16:00-16:59 EST
```

These are still no opens, no closes, and no grid adds. The new skeleton also
adds the explicit news-guard contract:

- `NewsGuardMode`
- `NewsCalendarFile`
- `NewsBlockBeforeMinutes`
- `NewsBlockAfterMinutes`

Gate 99N does not implement event ingestion yet. In live mode, the architecture
has a barrier for required news-guard configuration so news controls cannot be
forgotten later.

## Compile Proof

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99n-limni-portfolio-ea-skeleton-2026-07-06/`

Repo compile:

- `repo-LimniPortfolioEA-compile-log.txt`
- Result: `0 errors, 0 warnings`

Active-terminal compile:

- `active-LimniPortfolioEA-compile-log.txt`
- Result: `0 errors, 0 warnings`

Active terminal installed source:

- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Experts/Limni/LimniPortfolioEA.mq5`

Current Gate 99P relocation proof supersedes the original root-path compile
location for review.

Repo and active-terminal source hash:

```text
647D285706BCC53D02E26F1DC9B39BA30EB8086F371ED0EB01AD4D6A742F100B
```

## Boundary Check

Mechanical scan confirmed only:

- `automation/mt5/Experts/Include/Execution/TradeRouter.mqh`

contains:

- `#include <Trade/Trade.mqh>`
- `CTrade`

No strategy, portfolio, market, receipt, signal, or core module owns trade calls.

## Frozen Areas

- No strategy entry logic.
- No live trading.
- No real order placement.
- No account harvest execution.
- No grid lifecycle implementation beyond placeholder contracts.
- No news-event ingestion.
- No `LimniBeta.mq5` deletion or mutation.
- No `LimniKataraktiEA.mq5`, `LimniTrendFollow.mq5`, or
  `LimniHedge_V1.mq5` mutation.
- No promotion or live-readiness claim.

## Next Gate

Recommended next gate:

```text
Gate 99O - all-28 symbol universe and clock smoke
```

Goal: run the new zero-trading EA in tester/terminal mode and verify receipts
for symbol resolution, hedging fail-fast behavior, week-boundary/news guard
manifest fields, M1 clock heartbeat behavior, and managed-position recovery
with no strategy intents emitted.

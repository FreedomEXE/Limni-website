# Gate 107A - Revma State Harvest Harness Implementation

Date: 2026-07-09

Status: IMPLEMENTED, REPAIRED, COMPILED. No MT5 Strategy Tester/backtest run
was executed by Codex.

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

## Implemented Scope

Gate 107A implements the approved smallest safe contract:

- one active Revma grid per symbol/lane.
- q-anchor location is metadata, not a trade-validity filter.
- q stochastic is metadata, not a live filter.
- adverse and favorable adds are both allowed and tagged.
- Revma birth metadata persists by `grid_key`.
- individual grid exits and broker TP sync remain exact-grid scoped.
- account/HWM/block-new-entry states no longer suppress existing Revma grid
  exits or broker TP sync.
- TP layers are separated: individual grid q TP/SL is the harvest layer;
  account percent/HWM is the portfolio cleanup layer.
- same-symbol opposite-grid concurrency remains deferred.

## Code Changes

Changed source files:

```text
automation/mt5/Experts/Include/Core/BuildInfo.mqh
automation/mt5/Experts/Include/Core/Config.mqh
automation/mt5/Experts/Include/Core/Types.mqh
automation/mt5/Experts/Include/Core/Engine.mqh
automation/mt5/Experts/Include/Portfolio/PortfolioStopTakeProfitGuard.mqh
automation/mt5/Experts/Include/Portfolio/GridBook.mqh
automation/mt5/Experts/Include/Receipts/RunManifest.mqh
automation/mt5/Experts/Include/Strategies/Revma/RevmaGridProtectionManager.mqh
automation/mt5/Experts/Include/Strategies/RevmaGridSleeve.mqh
automation/mt5/Experts/Include/Strategies/RevmaTypes.mqh
automation/mt5/Experts/Include/Strategies/StrategyRegistry.mqh
automation/mt5/Experts/Limni/LimniPortfolioEA.mq5
automation/mt5/Experts/Limni/LimniPortfolioEA.ex5
automation/mt5/tester-presets/limni-portfolio-revma-fx28-fast-smoke.set
```

### State signal tradability

`LP_RevmaClassifySleeve(...)` now assigns the Revma reversion sleeve for valid
state directions regardless of whether price is above or below the q-anchor.
Anchor relation is still computed and emitted as metadata.

The Revma formula hash payload was updated for Gate 107A so receipts cannot be
mistaken for the previous q-anchor-gated formula.

### Metadata

Added q-anchor buckets:

- `LONG_ABOVE_Q_ANCHOR`
- `LONG_BELOW_Q_ANCHOR`
- `SHORT_ABOVE_Q_ANCHOR`
- `SHORT_BELOW_Q_ANCHOR`
- `UNKNOWN_Q_ANCHOR_LOCATION`

Added q stochastic buckets:

- `STOCH_0`
- `STOCH_0_5`
- `STOCH_5_10`
- `STOCH_10_20`
- `STOCH_20_40`
- `STOCH_40_60`
- `STOCH_60_80`
- `STOCH_80_90`
- `STOCH_90_95`
- `STOCH_95_100`
- `STOCH_100`
- `STOCH_UNKNOWN`

Birth/add/current metadata now includes raw stochastic and stochastic bucket
fields. Add metadata also includes add type, add sequence, adverse/favorable
counts, pre-add grid state, basket age, and pre-add net money after estimated
fees.

### Restart-safe birth state

Birth snapshots are persisted to:

```text
Common Files / LimniPortfolioEA_State / revma_grid_birth_state.csv
```

State rows are hash guarded by active config hash and Revma formula hash.
Mismatched state fails closed and emits a receipt instead of silently
reconstructing stale birth context.

The store writes only on lifecycle events:

- birth
- add
- stale cleanup after a grid is gone

### Harvest separation

Revma grid exits and broker TP sync are evaluated even when account/HWM logic is
blocking new entries. Births/adds still respect the block-new-entry path through
the existing engine evaluation gate.

### Bounded blocked-birth receipt

When a valid opposite-direction birth candidate is blocked by the one-active-grid
symbol/lane contract, Gate 107A emits:

```text
birth_candidate_blocked_active_grid
```

This is bounded by symbol/direction/grid/source-bar hash to avoid per-tick spam.

### Grid inventory auditability

`GridBook` now records ticket IDs in the `tickets` metadata field that receipts
already printed.

### MT5 visual smoke support

`LimniPortfolioEA.mq5` now declares visible MT5 properties:

```text
#property version     "1.022"
#property description "LimniPortfolioEA 0.1.22-gate107a-tpsep Revma TP layer separation repair"
```

The internal build string is now `0.1.22-gate107a-tpsep` after the TP layer
separation repair.

The Revma visual dashboard now exposes:

- q-anchor bucket, such as `LONG_ABOVE_Q_ANCHOR` or
  `SHORT_BELOW_Q_ANCHOR`.
- q stochastic raw value and bucket.
- `ADD MODEL = ADVERSE + FAVORABLE`.
- adverse and favorable add counts.

These are intended for Freedom's one-pair visual Strategy Tester smoke review.
Codex did not run that test.

## Gate 107A TP Layer Separation Repair

Repair date: 2026-07-09.

Reason:

- Freedom's current-chart visual output in
  `MULTI_CURRENCY_PERCENT_AFTER_FEES` mode showed births and both adverse and
  favorable adds, but no `revma_grid_close_intent`, no
  `broker_tp_sync_intent`, and no account basket TP receipt.
- Code inspection confirmed individual Revma grid TP/SL and broker TP sync were
  gated to `SinglePairQAfterFees`, while the account-level percent/HWM guard
  was gated to `FX28`.
- The previous `TakeProfit` and `StopLoss` inputs were overloaded between grid
  q targets and account percent targets.

Repair:

- Replaced the overloaded EA inputs with:
  - `GridTakeProfitQ`
  - `GridStopLossQ`
  - `AccountTakeProfitPct`
  - `AccountStopLossPct`
- Revma grid TP/SL now reads only `grid_take_profit_q` and
  `grid_stop_loss_q`.
- Account percent cleanup now reads only `account_take_profit_pct` and
  `account_stop_loss_pct`.
- HWM inputs remain separate.
- Revma grid exit evaluation and broker TP sync no longer depend on
  `StopTakeProfitMode`.
- Revma grid exit evaluation and broker TP sync no longer require
  `CURRENT_CHART`; they can operate for existing Revma grids in `FX28` as well.
- Account percent/HWM cleanup remains in the portfolio guard and remains
  `FX28`-scoped.
- Run manifest and summary receipts now print:
  - `grid_take_profit_q`
  - `grid_stop_loss_q`
  - `account_take_profit_pct`
  - `account_stop_loss_pct`
  - HWM fields separately
- Legacy summary aliases `take_profit_value` and `stop_loss_value` are retained
  as grid q aliases for report continuity only.
- Repo tester preset keys were updated to the new split input names.

Build metadata:

```text
LP_EA_VERSION = 0.1.22-gate107a-tpsep
LP_BUILD_GATE = Gate107A
LP_BUILD_SCOPE = revma-state-harvest-tp-layer-separation-repair
#property version = 1.022
#property description = LimniPortfolioEA 0.1.22-gate107a-tpsep Revma TP layer separation repair
```

## Verification

Allowed compile/sync only:

```text
powershell -ExecutionPolicy Bypass -File automation/mt5/tools/Sync-LimniPortfolioEA-Terminals.ps1
```

Latest repair artifact:

```text
docs/research/gates/gate101/artifacts/mt5-terminal-sync-20260709-072435/
```

Compile result:

```text
repo:           0 errors, 0 warnings
terminal-14275: 0 errors, 0 warnings
terminal-94497: 0 errors, 0 warnings
source hash mismatches: 0
compile failures: 0
active Experts stale-input matches: 0
tester profile stale-input matches: 0
unknown running terminal64.exe count: 0
```

Previous Gate 107A implementation artifact:

```text
docs/research/gates/gate101/artifacts/mt5-terminal-sync-20260709-060317/
```

Compile result:

```text
repo:          0 errors, 0 warnings
terminal-14275: 0 errors, 0 warnings
terminal-94497: 0 errors, 0 warnings
source hash mismatches: 0
compile failures: 0
unknown running terminal64.exe count: 0
```

Remaining non-blocking warning:

```text
tester profile hash mismatches: 2
terminal Profiles/Tester/LimniPortfolioEA.set files differ from the repo
limni-portfolio-revma-fx28-fast-smoke.set preset, but stale input key search
reports NO MATCHES for active Experts and tester profiles.
```

This warning is tester-profile drift, not EA source compile failure. No tester
run was executed.

## Stop Line Preserved

Not included:

- same-symbol opposite-grid concurrency.
- Candidate B/regime overlay work.
- deposit-load governor implementation.
- HWM formula work.
- stochastic filter.
- q-anchor filter.
- quarantine/recovery-only mode.
- optimization.
- promotion/live-readiness claim.

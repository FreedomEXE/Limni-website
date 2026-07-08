# Gate 99ZZG - Revma Broker-Visible Grid TP Sync

Date: 2026-07-07

Status: PATCHED - repo compile/static proof; visual MT5 proof still required

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

## Purpose

Freedom's intended Revma TP behavior is broker-visible grid TP:

```text
one trade -> ticket has visible TP
new add fills -> all open tickets in that grid update to one shared basket TP
broker TP hit -> intended grid closes
```

The prior code did not implement that contract. It only had a managed
close-grid trigger: once the EA calculated that the basket q target had already
been reached, it emitted `LP_INTENT_CLOSE_GRID`. That path cannot make MT5
position tickets show a non-zero `T/P`.

This gate adds the missing broker-visible TP synchronization route.

## Implementation Summary

Shared intent/plan contract:

- Added `LP_INTENT_SYNC_GRID_TP`.
- Added absolute protection fields to `LP_TradeIntent` and `LP_TradePlan`:
  `target_take_profit_price` and `target_stop_loss_price`.
- Updated intent/plan receipts to include target protection prices.

Revma strategy/protection:

- Added
  `automation/mt5/Experts/Include/Strategies/Revma/RevmaGridProtectionManager.mqh`.
- The manager computes the shared basket TP price from:
  - active grid weighted average entry,
  - frozen birth q,
  - configured `TakeProfit` q value,
  - active grid lots,
  - symbol tick value/tick size,
  - estimated close commission.
- It emits `LP_INTENT_SYNC_GRID_TP` with `target_take_profit_price`.
- `RevmaGridSleeve.mqh` now calls this manager for active Revma grids in
  `StopTakeProfitMode=SinglePairQAfterFees`.

Execution:

- `TradeRouter.mqh` now owns the only broker modify path.
- It handles `LP_INTENT_SYNC_GRID_TP` with `TRADE_ACTION_SLTP`.
- It matches positions by grid magic and symbol.
- It preserves each position's current SL and modifies only TP.
- It skips already-synced tickets.
- It writes `grid_tp_modify_request`, modify result, and
  `grid_tp_sync_scan_complete` receipts.

Engine:

- `Engine.mqh` remains coordinator-only.
- It checks existing Revma grid close exits first.
- If no close-grid exit is queued, it asks `StrategyRegistry` to sync Revma grid
  TPs.
- TP sync intents do not block new entries; close-grid exits still do.

Dashboard:

- The Revma dashboard text was reduced to a fixed-width ASCII panel.
- The first visible rows now show only `STATE` and `STATUS`.
- Secondary rows are separated into `SIGNAL`, `GRID`, and `NOTE` sections.
- The renderer now uses one monospace font and a larger line height to reduce
  overlap/squishing risk.

## Formula

For an active grid:

```text
money_per_price =
  (SYMBOL_TRADE_TICK_VALUE / SYMBOL_TRADE_TICK_SIZE) * abs(grid_lots)

take_profit_money_after_fees =
  frozen_birth_q * TakeProfit * money_per_price

estimated_close_fee =
  abs(grid_lots) * StopTakeProfitCloseCommissionPerLot

required_gross_money =
  take_profit_money_after_fees + estimated_close_fee

price_distance =
  required_gross_money / money_per_price
```

For a buy grid:

```text
target_tp = grid_avg_entry + price_distance
```

For a sell grid:

```text
target_tp = grid_avg_entry - price_distance
```

## Expected Receipt Path

When an active Revma grid exists and TP sync is eligible:

- `revma_grid_exit` with `status=broker_tp_sync_intent`
- `intent` with `action=LP_INTENT_SYNC_GRID_TP`
- `trade_plan` with `target_take_profit_price`
- `order_request` with `status=grid_tp_modify_request`
- `order_result` with `status=modified` or `modify_failed`
- `order_request` with `status=grid_tp_sync_scan_complete`

If the ticket TP is already correct, the router skips the ticket and reports it
in `skipped_already_synced`.

## Evidence

Artifacts:

`docs/research/gates/gate99/artifacts/gate99zzg-revma-broker-visible-grid-tp-2026-07-07/`

Compile proof:

- Source:
  `automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`
- Log:
  `docs/research/gates/gate99/artifacts/gate99zzg-revma-broker-visible-grid-tp-2026-07-07/repo-compile.log`
- Result:
  `Result: 0 errors, 0 warnings, 19196 msec elapsed, cpu='X64 Regular'`

MetaEditor returned local exit code `1` on a clean result line, matching the
known local clean-log pattern. The compile verdict is based on the result line.

Static proof:

- `TRADE_ACTION_SLTP` appears only in `TradeRouter.mqh`.
- `Engine.mqh` coordinates TP sync through `StrategyRegistry`; it does not own
  Revma TP math or broker modify calls.

## Limits

This gate has not yet run MT5 visual proof.

Compile proves the EA now has a broker-visible TP sync route. Acceptance still
requires a one-pair forced tiny TP visual run proving:

- first open grid ticket receives non-zero MT5 `T/P` after the position exists,
- after an add fills, all open grid tickets update to the same shared basket TP,
- dashboard shows a clean ASCII panel with `STATE` and `STATUS` readable at the
  top,
- receipt path shows `broker_tp_sync_intent` and `grid_tp_modify_request`,
- broker modify results are successful,
- the grid closes at TP or the managed close-grid fallback closes if target is
  already crossed before a valid broker modify can be placed.

No all-28, optimization, profitability, promotion, live-readiness, Katarakti, or
future-system work was opened in this gate.

# Gate 99ZZE - Revma Grid Basket TP Repair

Date: 2026-07-07

Status: PASS - compile/static proof plus one-pair hidden MT5 smoke

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

## Purpose

Freedom's visual tester run exposed a contract error in the temporary Revma
SL/TP scaffolding. The MT5 trade table showed open Revma tickets with
`T/P=0.00000`, and the grid did not close when the visible summed grid profit
had already passed the intended q target.

The correction is not to force broker-side TP onto each ticket. The intended
single-pair Revma contract is grid/basket based:

```text
single-pair q mode closes the frozen Revma grid when summed open grid money,
after estimated close fees, reaches the configured q target.
```

This gate repairs that lifecycle contract for one-pair crude TP/SL testing.

## Corrected Contract

`StopTakeProfitMode=LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES` now means:

- `TakeProfit` is q units for the active frozen Revma grid.
- `StopLoss` is q units for the active frozen Revma grid.
- The EA evaluates the in-memory active Revma grid from `GridBook`.
- The EA uses the grid's frozen Revma birth snapshot for q identity and birth
  price.
- The EA sums the active grid's floating money, subtracts estimated close fees,
  and compares that net value with the q-derived target.
- When the threshold is reached, the strategy emits a close-grid intent.
- The risk/execution path closes matching positions by exact symbol and grid
  magic.

The MT5 position table `T/P` and `S/L` columns are expected to remain
`0.00000` in this mode. That is no longer the proof surface. The proof surface
is the managed close lifecycle: `revma_grid_exit`, close request/result
receipts, and final flat grid inventory.

## Target Formula

For each active Revma grid:

```text
money_per_price =
  (SYMBOL_TRADE_TICK_VALUE / SYMBOL_TRADE_TICK_SIZE) * abs(grid.lots)

target_money =
  frozen_birth_q * configured_q_target * money_per_price

estimated_close_fee =
  abs(grid.lots) * StopTakeProfitCloseCommissionPerLot

net_open_money_after_fees =
  grid.floating_pnl - estimated_close_fee
```

The take-profit trigger fires when:

```text
net_open_money_after_fees >= take_profit_target_money
```

The stop-loss trigger fires when `StopLoss > 0` and:

```text
net_open_money_after_fees <= -stop_loss_target_money
```

## Implementation Summary

Changed Revma behavior:

- Removed the Revma single-pair broker-side ticket TP/SL attachment path.
- Added Revma grid-exit evaluation before new-bar entry/add evaluation.
- Added `revma_grid_exit` receipts.
- Added close-grid intents for active Revma grid TP/SL hits.
- Blocked same-tick new entries/adds when a Revma grid exit intent is queued.
- Kept account-level close-all execution disabled unless explicitly enabled by
  the separate account-close switch.

Changed tester defaults for the first crude one-pair smoke:

- `EnableCloseExecution=true`
- `EnableAccountCloseExecution=false`
- `StopTakeProfitMode=SinglePairQAfterFees`
- `TakeProfit=0.1`
- `StopLoss=0.0`
- `StopTakeProfitCloseCommissionPerLot=0.00`
- `OutputFolder=LimniPortfolioEA_Gate99ZZE_Smoke`

The close router still obeys `MaxClosePositionsPerStep`. If a grid has more
positions than that cap, the EA should continue closing on later steps until
the grid is flat.

## Receipts To Check

Expected TP path:

- `revma_grid_exit` with `status=revma_basket_tp_reached`
- `revma_grid_exit` with `status=revma_grid_close_intent`
- `trade_plan`
- `close_request`
- `order_result`
- `close_scan_complete`
- later `grid_inventory` showing no active managed grid positions
- `post_harvest_reentry_blocked` if current state has not changed after close

Expected SL path when `StopLoss > 0`:

- `revma_grid_exit` with `status=revma_basket_sl_reached`
- the same close request/result/flat-inventory proof path

Diagnostic/failure path:

- `revma_grid_exit` with `status=basket_exit_unavailable` when tick value or
  tick size cannot support q-to-money conversion.

## Evidence

Artifacts:

`docs/research/gates/gate99/artifacts/gate99zze-revma-grid-basket-tp-repair-2026-07-07/`

Compile proof:

- Repo `LimniPortfolioEA`: `Result: 0 errors, 0 warnings`
- Active-terminal `LimniPortfolioEA`: `Result: 0 errors, 0 warnings`
- Active-terminal source hash comparison:
  `source_hash_mismatches=0`

MetaEditor returned local exit code `1` on clean compile logs, matching the
known local pattern. The compile verdict is based on the result lines.

Alt tester terminal proof:

- Full include-tree sync into terminal data folder
  `14275C4F9441C73E9E6547075C33FE6C`.
- Alt terminal `LimniPortfolioEA`: `Result: 0 errors, 0 warnings`.

One-pair hidden smoke:

- Config:
  `smoke-configs/gate99zze-audchf-tp01-20260101-20260104.ini`
- Symbol: `AUDCHF.i`
- Window: `2026.01.01` through `2026.01.04`
- Mode: one-pair current chart, `TakeProfit=0.1`, `StopLoss=0.0`,
  `EnableCloseExecution=true`, `EnableAccountCloseExecution=false`
- Receipt path:
  `gate99zze-audchf-tp01-smoke-paths.txt`
- Parsed analysis:
  `gate99zze-audchf-tp01-smoke-analysis.txt`
- Chronology:
  `gate99zze-audchf-tp01-smoke-chronology.csv`

Smoke result:

- `births=3`
- `adds=36`
- `revma_grid_exit_rows=12`
- `revma_basket_tp_reached=6`
- `revma_grid_close_intent=6`
- `close_scan_complete_rows=6`
- `close_scan_attempted_total=39`
- `close_scan_closed_total=39`
- `bad_order_result_count=0`
- `final_grid_open_grids=0`
- `final_grid_positions=0`
- `post_harvest_reentry_blocked=294`

Interpretation:

- The repaired single-pair q TP path did emit grid-summed TP receipts.
- Close-grid intents reached the close router.
- The router closed all attempted matching grid positions.
- The test ended flat by managed grid inventory.
- Same-state reentry was blocked between fresh state-change births.

## Limits

This is not a profitability claim and not the final institutional exit
architecture.

Still not proven by this repair:

- Manual visual tester readability/inspection.
- SL path.
- Trailing path.
- All-28 behavior.
- Long-window survival.
- Final institutional exit architecture.

Not opened:

- no all-28 test;
- no optimization;
- no edge or survival claim;
- no final q-native institutional exit design;
- no Katarakti work;
- no paper-ingestion work.

## Next Test

For Freedom's manual visual confirmation, run one-pair visual/tester smoke with:

```text
StopTakeProfitMode=SinglePairQAfterFees
TakeProfit=0.1
StopLoss=0.0
EnableCloseExecution=true
EnableAccountCloseExecution=false
OutputFolder=LimniPortfolioEA_Gate99ZZE_Smoke
```

Pass condition:

```text
fresh state change -> one Revma grid birth -> summed grid net reaches TP
-> close-grid receipts -> MT5 tickets close -> grid inventory flat
-> no immediate same-state reentry
```

Fail condition:

```text
grid reaches target but no revma_grid_exit receipt appears, close requests fail,
positions remain open after successful close claims, or the EA immediately
rebirths on the same current state after close.
```

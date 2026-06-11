# Limni Sizing Audit (Pre-Market Checklist)

Script: `mt5/Scripts/LimniSizingAudit.mq5`
Output: common files folder CSV (default: `LimniSizingAudit.csv`)

## Purpose
Run the exact EA sizing formulas against your broker symbol specs and export per-pair lots for both profiles:
- `EIGHTCAP` baseline path
- `5ERS` constrained path

This validates whether lots are being reduced by:
- lot cap guard
- 1% move USD cap guard
- broker symbol volume step/min/max normalization

## How to run
1. Open MT5 terminal logged into broker account (first Eightcap, then 5ers).
2. Compile `mt5/Scripts/LimniSizingAudit.mq5` in MetaEditor.
3. Drag `LimniSizingAudit` onto any chart.
4. Keep inputs aligned with your EA config (especially caps/multipliers/aliases).
5. Let script finish and copy CSV from the terminal common files directory.

Suggested output names:
- `LimniSizingAudit_eightcap.csv`
- `LimniSizingAudit_5ers.csv`

## Required checks before open
For each CSV row:
1. `*_ok` should be `1`.
2. `trade_mode` should be tradable for pairs you expect to execute.
3. For Eightcap validation: `eightcap_final_lot` should match your known good lot map range.
4. For 5ers validation: check `fiveers_lot_cap_hit` and `fiveers_move_cap_hit`.
5. If any pair has `*_reason` not empty, that leg can be blocked or reduced.

## Interpreting columns
- `*_base_lot_raw`: pure 1:1 lot before multipliers/risk scaling/normalization.
- `*_target_lot`: after multipliers and profile risk scale.
- `*_final_lot`: final executable lot after normalization + guards.
- `delta_lot_pct`: `%` difference of 5ers lot vs Eightcap lot.

## Notes
- This is a broker-spec sizing audit, not a historical PnL backtest.
- To compare broker behavior, run the same script on both broker logins.
- If you change EA inputs, rerun the script.

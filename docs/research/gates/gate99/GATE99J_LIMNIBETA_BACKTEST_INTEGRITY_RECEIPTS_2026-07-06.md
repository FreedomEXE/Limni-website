# Gate 99J - LimniBeta Backtest Integrity Receipts

Date: 2026-07-06

## Scope

Gate 99J keeps `LimniBeta` as the current MT5 diagnostic scaffold and adds
receipts that make backtests easier to audit before more entry variants are
added.

Changed file:

- `automation/mt5/Experts/LimniBeta.mq5`

Frozen areas:

- No `LimniKataraktiEA.mq5` changes.
- No `LimniTrendFollow.mq5` changes.
- No `LimniHedge_V1.mq5` changes.
- No entry, exit, grid, sizing, or indicator formula changes.
- No canonical promotion claim from MT5 terminal-history output.

## What Changed

- Added `TradeStartTime` under `----- Backtest Integrity -----`.
  - Default `0` disables the gate.
  - When set, closed M1 bars before `TradeStartTime` can load indicator inputs
    and count warm-up receipts, but cannot open, close, or add grid fills.
- Added summary receipts for processed closed M1 bars:
  - processed bars
  - signal-input ready bars
  - signal-input missing bars
  - trade-eligible bars
  - first/last processed and trade-eligible timestamps
  - first/last warm-up-blocked timestamps
- Added summary receipts for internal LRMG q source history:
  - `CopyRates` request/failure/cache counts
  - last copied-bar count and min/max copied-bar counts
  - last source-from/requested-to/source-first/source-last timestamps
  - last built day count, valid-q day count, sample count, target day index
  - first q-ready bar and first q-ready source timestamp
  - last q value
- Added explicit backtest lineage flags:
  - `diagnostic_only=true`
  - blank `price_bundle_id`
  - `price_source=mt5_terminal_history`
  - closed-bar-only and indicator-shift receipts
  - tester/optimization mode receipts

## Why It Matters

This prevents a common false read: a profitable MT5 pass with hidden warm-up or
unknown price lineage should not be treated as final evidence. Gate 99J makes the
summary CSV show whether the run had enough indicator-ready bars, when trading
actually became eligible, and what LRMG q history was available at signal time.

Per `docs/BACKTEST_CANONICAL_PROTOCOL.md`, MT5 terminal-history output remains
diagnostic-only until it can declare canonical price-bundle lineage.

## Compile Proof

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99j-limnibeta-backtest-integrity-2026-07-06/`

Compile logs:

- `repo-LimniBeta-compile-log.txt`
- `active-LimniBeta-compile-log.txt`

Both logs report:

```text
Result: 0 errors, 0 warnings
```

Source hash parity after active-terminal install:

```text
D9558C346DB4A73958FB5E9C5D410A120901A356AC43F85E0B8FCD597FA39982
```

The repo source and active-terminal source match. The compiled `.ex5` sizes can
differ because MetaEditor embeds different absolute include paths between the
repo compile and active-terminal compile.

## Next Use

For honest comparison of `Strict` versus `Loose`:

- Keep the same symbol, date window, spread model, deposit, leverage, `TP`,
  `GridSpacingLrmgUnits`, and `GridCap`.
- Use `TradeStartTime` when the first part of the test window is only intended
  to warm up indicators and LRMG q history.
- Read the summary CSV before comparing profit:
  - `diagnostic_only`
  - `processed_closed_bars`
  - `signal_input_ready_bars`
  - `signal_input_missing_bars`
  - `warmup_blocked_bars`
  - `q_copy_requests`
  - `q_ready_builds`
  - `q_not_ready_builds`
  - `q_last_sample_count`
  - `q_first_ready_bar_time`

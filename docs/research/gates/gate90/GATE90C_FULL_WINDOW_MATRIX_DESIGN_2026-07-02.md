# Gate 90C Full-Window Matrix Design

Generated: 2026-07-02

## Purpose

Build one full-history structural map for the current Gate 90 execution surface:
ADR-event signal clock, David MA reversion TP, adverse-only grid adds, and the
New York daily session window.

This is not a promotion run. It is a full-window research map to identify which
combination of signal brick, MA speed, grid spacing, and direction selector is
worth a narrower full-stat replay.

## Implemented Before Launch

- Added `candidate_b_david_contra_confirm`.
  - Allows a side only when Candidate B and David contra agree.
- Added `candidate_b_david_contra_conflict_candidate`.
  - Allows Candidate B's side only when it conflicts with David contra.
- Added summary-only close-cycle metrics:
  - `close_event_count`
  - `close_event_win_count`
  - `close_event_loss_count`
  - `close_event_flat_count`
  - `close_event_profit_factor`
  - `close_event_win_pct`
  - `close_event_gross_profit_usd`
  - `close_event_gross_loss_abs_usd`
  - `target_close_net_usd`
  - `session_flatten_close_net_usd`

The close-cycle metrics are aggregate counters, not retained close-event rows.
They allow the full matrix to run in `--summary-only` mode while still ranking
by event PF and win rate.

## Smoke Evidence

Command surface was smoke-tested on one all-pair week:
`2026-05-03T23:00:00.000Z..2026-05-03T23:00:00.000Z`.

Report:
`docs/research/gates/gate90/GATE90C_COMBINED_VARIANT_SMOKE_ALLPAIRS_1W_2026-07-02.md`

Key smoke rows:

| Rule | Net | Event PF | Event Win % | Entries | Max Open | Flatten Net |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `candidate_b` | `+$131.24` | `2.666859` | `79.78` | `275` | `23` | `-$71.41` |
| `david_contra` | `+$164.36` | `1.948972` | `85.27` | `399` | `55` | `-$164.25` |
| `candidate_b_david_contra_confirm` | `+$116.35` | `8.455620` | `90.67` | `99` | `8` | `-$12.27` |
| `candidate_b_david_contra_conflict_candidate` | `+$72.11` | `2.142201` | `74.79` | `194` | `19` | `-$59.10` |

The smoke is not evidence of long-run edge. It proves both combined variants are
live, produce rows, and expose summary-only PF metrics.

## Full-Window Span

- Warehouse: `gate74b_trade_leg_path_ECDE7C4A6553`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Universe: all 28 FX pairs
- Date guard: `2019-04-14..2026-05-31`
- Expected selected weeks: 373

## Fixed Execution Surface

- `--bar-path-mode=ohlc_high_low`
- `--signal-clock=adr_event`
- `--session-mode=ny_daily_window`
- `--session-time-zone=America/New_York`
- `--session-trade-start-et=18:05`
- `--session-trade-end-et=15:45`
- `--session-flatten-et=16:00`
- `--session-sunday-start-et=20:00`
- `--target-mode=david_ma_reversion`
- `--target-adr=1`
- `--min-ma-expansion-adr=0.10`
- `--grid-add-mode=adverse_only`
- David RSI: `50/60/40`
- Stoch state filter: `100/3/100 60/40`
- `--summary-only`

## Matrix Axes

Activation rules:

- `raw_both`
- `david_contra`
- `candidate_b`
- `candidate_b_david_contra_confirm`
- `candidate_b_david_contra_conflict_candidate`
- `stoch_contra`
- `david_stoch_confirm`

Signal ADR bricks:

- `0.025`
- `0.05`
- `0.075`
- `0.10`
- `0.125`
- `0.15`

David MA periods:

- `25`
- `35`
- `50`
- `75`
- `100`

Grid spacing:

- `0.10`
- `0.15`
- `0.20`
- `0.25`
- `0.30`

Total execution queue:

- `6` signal bricks x `5` MA periods x `5` spacings = `150` runner invocations.
- Each runner invocation batches `7` activation rules.
- Total summary rows expected: `1,050`.

## Command Plan

CSV:
`docs/research/gates/gate90/artifacts/gate90c-full-window-matrix-command-plan.csv`

Each row contains:

- ordinal
- signal ADR brick
- David MA period
- grid spacing
- activation-rule batch
- artifact directory
- report path
- exact command

Representative command:

```powershell
npm run engine:gate90:grid-activation-accuracy-one-sided-selection -- --all-pairs --week-from=2019-04-14 --week-to=2026-05-31 --activation-rules=raw_both,david_contra,candidate_b,candidate_b_david_contra_confirm,candidate_b_david_contra_conflict_candidate,stoch_contra,david_stoch_confirm --bar-path-mode=ohlc_high_low --signal-clock=adr_event --signal-adr-brick=0.10 --session-mode=ny_daily_window --session-time-zone=America/New_York --session-trade-start-et=18:05 --session-trade-end-et=15:45 --session-flatten-et=16:00 --session-sunday-start-et=20:00 --target-mode=david_ma_reversion --target-adr=1 --spacing-adr=0.20 --min-ma-expansion-adr=0.10 --grid-add-mode=adverse_only --david-ma-period=50 --david-rsi-period=50 --david-rsi-overbought=60 --david-rsi-oversold=40 --stoch-k-period=100 --stoch-d-period=3 --stoch-slowing=100 --stoch-overbought=60 --stoch-oversold=40 --summary-only --artifact-dir=docs/research/gates/gate90/artifacts/gate90c-full-window-adr10_ma50_s20-exp010-rsi506040-stoch100-3-100-6040 --report-path=docs/research/gates/gate90/GATE90C_FULL_WINDOW_ADR10_MA50_S20_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md
```

## Ranking Metrics

Primary:

- net profit USD
- close-event PF
- weekly equity PF
- close-event win %
- max equity drawdown USD
- net / max equity drawdown
- worst rolling 4-week, 8-week, and 13-week equity delta
- entries opened
- max open positions
- max add depth
- target close net USD
- session flatten close net USD
- total commission USD
- total swap USD
- max fill age days

Secondary attribution:

- pair/side damage for finalists
- session-flatten damage by pair/side for finalists
- terminal inventory should remain zero under `ny_daily_window`

## Execution Plan

1. Run the 150-command summary-only matrix from the CSV.
2. Build one aggregate scorecard from all `activation-summary.rows.*` and
   `weekly-activation-truth.rows.*`.
3. Shortlist by a balanced view of net, event PF, weekly PF, max open, spacing,
   and session-flatten loss.
4. Rerun only the finalist subset without `--summary-only` for full close-event
   and pair/side attribution.

## Caveat

Gate 90B OOS session-window runs removed terminal inventory, but swap and max
fill age were still nonzero under the daily window. Gate 90C can be launched
under current semantics, but the session-flatten lifecycle behavior must be
explained before treating the resulting shape as live-ready.

# Sweep vs Hold Parity Notes

Date: 2026-02-27

## Objective

Run an apples-to-apples comparison between:

- `entry_mode=sweep`
- `entry_mode=week_open_hold` (Sunday/week-open style)

while keeping the same:

- bias system / variants
- stop management (`stepped_no_hard_sl`)
- risk and portfolio caps
- no overlap per pair
- no transaction costs

## First Parity Slice (5 pairs)

Pairs:

- `EURUSD`
- `GBPUSD`
- `USDJPY`
- `XAUUSD`
- `BTCUSD`

Environment:

- `KATARAKTI_EXIT_MODE=stepped_no_hard_sl`
- `KATARAKTI_MAX_ENTRIES_PER_PAIR_PER_WEEK=1`
- `KATARAKTI_PAIR_FILTER=EURUSD,GBPUSD,USDJPY,XAUUSD,BTCUSD`

Reports:

- Sweep: `reports/katarakti-phase1-backtest-latest-entrycmp5_sweep.json`
- Hold: `reports/katarakti-phase1-backtest-latest-entrycmp5_hold.json`

Headline (`universal_v1__skip__sweep010`):

- Sweep: `+1.5488%`, `4` trades, `50.00%` win rate
- Hold: `+4.3588%`, `6` trades, `66.67%` win rate

Pair-level PnL (`hold - sweep`, same variant):

- `EURUSD`: `+$796.52`
- `GBPUSD`: `+$0.00`
- `USDJPY`: `+$0.00`
- `XAUUSD`: `+$0.00`
- `BTCUSD`: `+$2013.44`

## Notes

- This is a small-sample sanity check only (5 pairs, 5 weeks).
- Next step is to run the same parity setup on a larger pair set and compare per-pair distributions, not only totals.

## Full Universe Parity (36 pairs, updated engine)

Date: 2026-02-27

Scope:

- Same 5-week window (`2026-01-19` to `2026-02-16`)
- Same risk engine / position sizing / portfolio caps
- Same exit engine
- `neutral=skip`
- costs disabled

Results, default fixed/hard-stop mode (from `reports/katarakti-phase1-backtest-latest.md`):

- Sweep baseline (`universal_v1__skip__sweep010`): `+8.60%`, `1.22%` max DD, `40.00%` WR, `30` trades
- Hold baseline (`hold_portfolio__universal_v1__skip`): `+10.62%`, `2.04%` max DD, `51.16%` WR, `43` trades

Results, active no-hard-stop ATR mode (from `reports/katarakti-phase1-backtest-latest-ab_parity_nohard_atr.md`):

- Sweep baseline (`universal_v1__skip__sweep010`): `+14.07%`, `0.38%` max DD, `36.67%` WR, `30` trades
- Hold baseline (`hold_portfolio__universal_v1__skip`): `+12.61%`, `0.23%` max DD, `48.84%` WR, `43` trades

Interpretation:

- Fixed/hard-stop mode favored hold on return.
- No-hard ATR mode favored sweep on return.
- Previous confusion came from comparing sweep portfolio PnL vs snapshot-summed baseline returns; both are now reported separately.

## Bitget Cross-Check (same 5-week window)

Source: `docs/bots/bitget-v2-backtest-results.md`

- Sweep/handshake strategy C: `+112.54%`, `87.50%` WR, `6.19%` max DD
- New weekly hold strategy L: `+28.97%`, `60.00%` WR, `0.00%` max DD

Interpretation:

- In Bitget v2, sweep/handshake timing still materially outperformed weekly bias hold on return in this sample.

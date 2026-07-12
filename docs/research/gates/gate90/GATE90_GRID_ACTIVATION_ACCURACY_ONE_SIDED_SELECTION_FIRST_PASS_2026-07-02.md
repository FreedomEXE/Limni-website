# Gate 90 Grid Activation Accuracy One-Sided Selection - First Pass

Generated: `2026-07-02`

## Verdict

`PASS_GATE90_FIRST_PASS_DAVID_MA_STOCH_ONE_YEAR_DIAGNOSTIC_NO_PROMOTION`

## Scope

This pass added warehouse-only one-sided activation research on top of the Gate
89 continuous truth simulator mechanics.

The activation gate controls only whether a missing side cycle may start. It
does not flatten existing cycles, retune target/spacing, change swap/commission,
change terminal liquidation, change MT5 code, or create a double-sided
in-between policy.

Signal settings:

- David MA: `LWMA 35`, close price, RSI filter on, `RSI 21`, `80/20`.
- Stochastic: `100,3,21`, Low/High, Simple, main line only, `80/20`.
- Signal reads use closed warehouse bars.

## Implementation Receipts

- Script: `engine/scripts/verification/build-gate90-grid-activation-accuracy-one-sided-selection.ts`
- Package command: `npm run engine:gate90:grid-activation-accuracy-one-sided-selection`
- Warehouse helper: `readTradeLegPathWarehouseWeekRows()` in `engine/src/research/tradeLegPathWarehouse.ts`

The first all-weeks/all-pairs bulk-cache attempt exceeded Node heap because it
held too many decompressed pair-week paths at once. The final implementation
streams one week at a time with a single week-batch warehouse read, avoiding the
memory wall.

## One-Year All-Pair Sample

Window: `2020-01-06T00:00:00.000Z..2020-12-28T00:00:00.000Z`

Pairs: `28`

Bar path: `ohlc_high_low`

| activation_rule_id | net_profit_usd | max_equity_drawdown_usd | max_open_positions | terminal_positions | swap_usd | commission_usd | entries_opened | target_resets |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| raw_both | -30707.57 | -57722.03 | 2169 | 2127 | -14748.94 | -2659.08 | 44318 | 8152 |
| david_contra | 5092.49 | -20124.57 | 1236 | 970 | -8463.89 | -1774.32 | 29572 | 5525 |
| stoch_contra | 2547.46 | -24229.05 | 1575 | 1460 | -12430.09 | -2307.96 | 38466 | 7095 |
| david_stoch_confirm | 466.95 | -21214.34 | 1023 | 947 | -5779.41 | -1537.56 | 25626 | 4814 |

## Read

David contra is the strongest first-pass candidate. In the 2020 all-pair
sample, it flipped raw-both from a large loss to a profit while cutting drawdown,
max open positions, terminal positions, swap drag, and commissions.

Stochastic contra also helps, but it is weaker than David contra on this sample:
less net, higher drawdown, higher max open inventory, and higher terminal
inventory.

David plus stochastic confirmation is the strictest containment variant. It has
the lowest max open positions and lowest swap drag in the sample, but it gives
up too much harvest versus David contra. It is useful as a risk-containment
reference, not the current leader.

## Artifacts

- `docs/research/gates/gate90/GATE90_ONE_YEAR_2020_RAW_BOTH_ALL_PAIRS_2026-07-02.md`
- `docs/research/gates/gate90/GATE90_ONE_YEAR_2020_DAVID_CONTRA_ALL_PAIRS_2026-07-02.md`
- `docs/research/gates/gate90/GATE90_ONE_YEAR_2020_STOCH_CONTRA_ALL_PAIRS_2026-07-02.md`
- `docs/research/gates/gate90/GATE90_ONE_YEAR_2020_DAVID_STOCH_CONFIRM_ALL_PAIRS_2026-07-02.md`
- `docs/research/gates/gate90/GATE90_SMOKE_DAVID_CONTRA_EURUSD_2W_2026-07-02.md`

## Next Research Step

Run David contra across wider years, but first add a summary-only mode so broad
ranking runs do not have to emit full close-event ledgers every time. Then test:

- `david_contra` across the full Gate 89 range.
- `david_with` as polarity control.
- `david_stoch_release` as a timing refinement.
- MTF David variants after the single-timeframe warehouse rule is stable.

## Stop Line

Gate 90 remains warehouse/research only. No MT5 lifecycle optimization, no
target/spacing optimization, no pair-specific swap ingestion, no margin stopout
simulator, no app/live integration, no promotion/live-readiness, and no
double-sided in-between policy from this first pass.

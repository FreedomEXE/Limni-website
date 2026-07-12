# Gate 34 Dealer Weekly Hold - 2024 Result

Date: 2026-06-14

Gate: Gate 34 weekly-hold-engine-research

## Decision

2024 is a Dealer-only Weekly Hold failure year.

Correction after ADR audit:

- The first 2024 result below was generated before daily FX ADR bars were filled,
  so it used default FX ADR for every 2024 pair-week. That made the normalized
  figures stale.
- Corrected 2024 receipt after materializing daily ADR bars from canonical 1H:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-52w-20260614-182222.md`
- Corrected 2024 fixed-band receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260614-182928.md`
- Corrected audit:
  `docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_2026_AUDIT_2026-06-14.md`
- Corrected read: week-close raw `-123.59%`, ADR `-169.48%`, weekly ADR PF
  `0.49`, ADR DD `181.46%`; all broad fixed-band rows still fail. The least
  bad broad row is `TP 1.0x / SL 1.5x` at raw `-55.08%`, ADR `-71.25%`, ADR DD
  `93.43%`.

This materially changes the read from the 2025+2026 baseline: fixed bands helped
2025 and 2026, but 2024 shows that Dealer direction alone is not robust enough
for final strategy promotion.

Do not solve this by optimizing TP/SL harder. The next improvement path is
source qualification, regime filtering, or comparing other source signals
against Dealer.

## Window And Coverage

- Displayed test weeks: `2024-01-09` through `2024-12-31`.
- Excluded displayed week: `2024-01-02`, because the `2024-01-01` New Year
  holiday had no exact FX open bar across all 28 pairs.
- Tradable weeks tested: 52.
- Pairs: 28 FX pairs.
- Pair-week returns: 1,456 `canonical` and 1,456 `execution` rows.
- COT source coverage: 53 report dates from `2023-12-26` through `2024-12-24`.
- Hourly bars backfilled: 176,063 raw and canonical FX 1H bars.

Receipts:

- Week-close baseline:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-52w-20260614-145803.md`
- Broad fixed-band sweep:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260614-150632.md`
- Focused tight-stop sweep:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260614-151458.md`

## 2024 Broad Grid

Note: the table in this section is the first-pass default-ADR result. Use the
corrected audit links above for current decision-making.

| Variant | ADR | Raw | Weekly W/L/F | Weekly ADR PF | Trade ADR PF | Trade Exp ADR | Sharpe-Style | ADR DD | ADR Giveback |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Week Close | -205.99% | -123.59% | 21/31/0 | 0.47 | 0.80 | -0.1415% | -1.92 | 211.62% | 245.56% |
| Market TP 1.0x / SL 1.5x | -60.94% | -36.56% | 20/32/0 | 0.61 | 0.89 | -0.0421% | -1.40 | 80.63% | 89.54% |
| Market TP 1.0x / SL 2.0x | -80.39% | -48.23% | 17/35/0 | 0.56 | 0.86 | -0.0554% | -1.68 | 97.74% | 111.42% |
| Market TP 1.2x / SL 2.45x | -128.42% | -77.05% | 18/34/0 | 0.47 | 0.81 | -0.0883% | -2.21 | 144.84% | 151.80% |
| Market TP 1.6x / SL 2.45x | -142.31% | -85.39% | 18/34/0 | 0.48 | 0.82 | -0.0977% | -2.02 | 147.70% | 184.97% |

Every broad fixed-band candidate failed in 2024.

## Tight-Stop Check

Note: this tight-stop table is first-pass/default-ADR history. Rerun tight stops
after the daily ADR fill before using these rows for current decisions.

The tight-stop check was run because 2025 drawdown was concerning and we wanted
to test whether SL smaller than TP could improve the edge.

| Variant | 2024 ADR | 2024 Weekly PF | 2024 Trade PF | 2024 ADR DD | 2025 ADR | 2025 Weekly PF | Read |
|---|---:|---:|---:|---:|---:|---:|---|
| Market TP 1.0x / SL 0.5x | +3.83% | 1.07 | 1.02 | 25.57% | -7.23% | 0.84 | Tiny 2024 positive, fails 2025 |
| Market TP 2.0x / SL 1.0x | +9.04% | 1.07 | 1.02 | 41.58% | -34.34% | 0.69 | Best 2024 tight row, fails badly in 2025 |
| Market TP 2.0x / SL 0.5x | +0.93% | 1.01 | 1.00 | 28.23% | -8.65% | 0.87 | Essentially flat, fails 2025 |

Tight stops are not a robust improvement. They only reduce 2024 damage in a few
rows and then fail in 2025.

## Cross-Year Implication

Adding 2024 nearly erases the 2025+2026 fixed-band gains:

| Variant | 2024 ADR | 2025+2026 ADR | Rough 2024+2026 ADR |
|---|---:|---:|---:|
| Week Close | -205.99% | +55.32% | -150.67% |
| Market TP 1.0x / SL 2.0x | -80.39% | +102.05% | +21.67% |
| Market TP 1.2x / SL 2.45x | -128.42% | +130.42% | +2.00% |
| Market TP 1.6x / SL 2.45x | -142.31% | +149.10% | +6.78% |

These rough totals are return sums only; they do not represent stitched path DD.
The direction is clear enough: 2024 is not a tolerable hidden cost.

## Read

- Week-close Dealer fails 2024 outright.
- Broad fixed-band exits improve the catastrophic week-close result but still
  fail across every candidate.
- Smaller SL variants are not a durable fix. They can reduce 2024 damage, but
  the few small positives have weak PF, high DD relative to profit, and fail in
  2025.
- The problem is not just exit design. 2024 looks like a Dealer direction/source
  regime failure.
- Final TP/SL promotion is blocked until Dealer can be qualified, filtered, or
  beaten by another source over 2024-2026.

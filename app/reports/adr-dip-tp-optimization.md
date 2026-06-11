# ADR Dip-Entry TP Optimization

Generated: 2026-03-24T07:01:34.165Z

## What We're Building And Why

We're testing the intraday execution layer on top of the Tiered V3 weekly directional system. The weekly system already works when entered at week open and held to week close. This research asks a narrower question: once a valid weekly signal pulls back by 1 ADR and fills a better entry, what profit target works best from that improved price?

This is Test 2 in the ADR dip-entry research program. The goal is to compare fixed ADR take-profit distances against the control case of holding the filled dip-entry trade to week close, while keeping the fill logic identical across all variants.

## Test Design

- Universe: all Tiered V3 directional signals before gate filtering, across FX, indices, commodities, and crypto.
- Mode split: GATED = PASS/NO_DATA, NON-GATED = SKIP/REDUCE, COMBINED = both together.
- Entry: 1.0x ADR dip from week open, using the same 10-day ADR logic as the baseline script.
- Exit variants: hold to week close, TP at 0.25 ADR, 0.50 ADR, 0.75 ADR, and 1.00 ADR.
- TP scan: daily bars from the fill day onward, inclusive of the fill day.
- No stop loss. If TP is not hit, the trade holds to the weekly close.
- One entry per pair per week, with no re-entry after fill or TP.

## Universe Summary

| Metric | Value |
| --- | --- |
| Signals processed | 211 |
| GATED signals | 104 |
| NON-GATED signals | 107 |
| Combined eligible ADR trades | 184 |
| Combined filled ADR trades | 79 |

| Gate Decision | Signals |
| --- | --- |
| PASS | 92 |
| NO_DATA | 12 |
| REDUCE | 16 |
| SKIP | 91 |

## Combined

| Variant | Trades | Avg Return | Total Return | Win Rate | Fill Rate |
| --- | --- | --- | --- | --- | --- |
| Baseline Hold | 79 | +1.21% | +95.81% | 73.42% | 42.93% |
| TP 0.25 ADR | 79 | +0.31% | +24.12% | 94.94% | 42.93% |
| TP 0.50 ADR | 79 | +0.54% | +43.03% | 92.41% | 42.93% |
| TP 0.75 ADR | 79 | +0.68% | +53.34% | 84.81% | 42.93% |
| TP 1.00 ADR | 79 | +0.88% | +69.45% | 81.01% | 42.93% |

### Per-Week Breakdown

| Week | Eligible | Filled | Fill Rate | Hold Tot | TP0.25 Tot | TP0.50 Tot | TP0.75 Tot | TP1.00 Tot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jan 19 | 0 | 0 | — | — | — | — | — | — |
| Jan 26 | 27 | 7 | 25.93% | +38.95% | +2.79% | +5.58% | +7.80% | +10.02% |
| Feb 02 | 25 | 10 | 40.00% | +4.77% | +2.95% | +5.90% | +7.62% | +10.29% |
| Feb 09 | 21 | 1 | 4.76% | +0.08% | +0.42% | +0.84% | +1.26% | +1.68% |
| Feb 16 | 21 | 3 | 14.29% | +0.10% | +0.48% | +0.96% | +0.28% | +0.10% |
| Feb 23 | 19 | 8 | 42.11% | +15.79% | +3.53% | +7.07% | +10.60% | +14.13% |
| Mar 02 | 24 | 18 | 75.00% | +12.85% | +2.22% | +7.36% | +12.50% | +17.64% |
| Mar 09 | 22 | 15 | 68.18% | -0.50% | +6.26% | +5.12% | -1.69% | -1.08% |
| Mar 16 | 25 | 17 | 68.00% | +23.77% | +5.47% | +10.21% | +14.96% | +16.67% |

## GATED (PASS / NO_DATA)

| Variant | Trades | Avg Return | Total Return | Win Rate | Fill Rate |
| --- | --- | --- | --- | --- | --- |
| Baseline Hold | 42 | +1.56% | +65.61% | 73.81% | 45.65% |
| TP 0.25 ADR | 42 | +0.28% | +11.84% | 95.24% | 45.65% |
| TP 0.50 ADR | 42 | +0.58% | +24.54% | 92.86% | 45.65% |
| TP 0.75 ADR | 42 | +0.83% | +34.89% | 85.71% | 45.65% |
| TP 1.00 ADR | 42 | +1.04% | +43.48% | 80.95% | 45.65% |

### Per-Week Breakdown

| Week | Eligible | Filled | Fill Rate | Hold Tot | TP0.25 Tot | TP0.50 Tot | TP0.75 Tot | TP1.00 Tot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jan 19 | 0 | 0 | — | — | — | — | — | — |
| Jan 26 | 14 | 5 | 35.71% | +37.45% | +2.44% | +4.87% | +6.75% | +9.06% |
| Feb 02 | 16 | 8 | 50.00% | +4.06% | +2.53% | +5.06% | +6.36% | +8.62% |
| Feb 09 | 13 | 1 | 7.69% | +0.08% | +0.42% | +0.84% | +1.26% | +1.68% |
| Feb 16 | 13 | 2 | 15.38% | +0.11% | +0.35% | +0.70% | +0.29% | +0.11% |
| Feb 23 | 10 | 6 | 60.00% | +15.77% | +2.93% | +5.85% | +8.78% | +11.70% |
| Mar 02 | 8 | 7 | 87.50% | +0.73% | -0.36% | +0.86% | +2.09% | +3.31% |
| Mar 09 | 8 | 6 | 75.00% | +5.90% | +1.97% | +3.93% | +5.71% | +5.40% |
| Mar 16 | 10 | 7 | 70.00% | +1.50% | +1.58% | +2.43% | +3.65% | +3.61% |

## NON-GATED (SKIP / REDUCE)

| Variant | Trades | Avg Return | Total Return | Win Rate | Fill Rate |
| --- | --- | --- | --- | --- | --- |
| Baseline Hold | 37 | +0.82% | +30.21% | 72.97% | 40.22% |
| TP 0.25 ADR | 37 | +0.33% | +12.28% | 94.59% | 40.22% |
| TP 0.50 ADR | 37 | +0.50% | +18.48% | 91.89% | 40.22% |
| TP 0.75 ADR | 37 | +0.50% | +18.45% | 83.78% | 40.22% |
| TP 1.00 ADR | 37 | +0.70% | +25.98% | 81.08% | 40.22% |

### Per-Week Breakdown

| Week | Eligible | Filled | Fill Rate | Hold Tot | TP0.25 Tot | TP0.50 Tot | TP0.75 Tot | TP1.00 Tot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jan 19 | 0 | 0 | — | — | — | — | — | — |
| Jan 26 | 13 | 2 | 15.38% | +1.50% | +0.35% | +0.70% | +1.06% | +0.97% |
| Feb 02 | 9 | 2 | 22.22% | +0.71% | +0.42% | +0.84% | +1.26% | +1.68% |
| Feb 09 | 8 | 0 | 0.00% | — | — | — | — | — |
| Feb 16 | 8 | 1 | 12.50% | -0.01% | +0.13% | +0.26% | -0.01% | -0.01% |
| Feb 23 | 9 | 2 | 22.22% | +0.02% | +0.61% | +1.22% | +1.82% | +2.43% |
| Mar 02 | 16 | 11 | 68.75% | +12.12% | +2.58% | +6.49% | +10.41% | +14.33% |
| Mar 09 | 14 | 9 | 64.29% | -6.40% | +4.30% | +1.18% | -7.40% | -6.48% |
| Mar 16 | 15 | 10 | 66.67% | +22.27% | +3.89% | +7.78% | +11.31% | +13.06% |

## Notes

- Returns are reported only for filled ADR dip entries. Unfilled signals affect fill rate but do not contribute return.
- TP-hit trades book the fixed ADR-distance return defined by the target multiplier.
- Daily bars cannot resolve intraday path beyond level touch. Same-day fill and TP touch are counted as TP hits by design.


# ADR Dip Re-Entries

Generated: 2026-03-24T07:53:50.575Z

## What We're Building And Why

Test 2 showed that tight fixed targets, especially TP 0.25 ADR, produced a very high win rate but capped total return because the engine allowed only one fill per pair per week. This test asks the next question: if the same pair revisits the 1x ADR dip after TP is hit, can repeated fills compound that high-probability edge enough to close the gap versus hold-to-close?

This version upgrades execution from daily bars to H1 bars, keeps the 1x ADR dip-entry anchor from the weekly system, and adds session-gated fill variants to see whether restricting entries to the pair's primary session improves trade quality.

## Test Design

- Universe: all Tiered V3 directional signals before gate filtering, across FX, indices, commodities, and crypto.
- Mode split: GATED = PASS/NO_DATA, NON-GATED = SKIP/REDUCE, COMBINED = both together.
- Entry level: fixed 1.0x ADR dip from the open of the first H1 bar in the canonical week window.
- Execution bars: OANDA H1 candles for the full canonical week window.
- Re-entry model: after TP, the state machine returns to waiting for another touch of the same dip-entry level.
- Session gating applies only to fills. TP and final hold-to-close exits can occur at any hour.
- One fill and one TP can occur on the same H1 bar, but no second re-entry is allowed until the next bar.

## Universe Summary

| Metric | Value |
| --- | --- |
| Signals processed | 211 |
| GATED signals | 104 |
| NON-GATED signals | 107 |
| Eligible pair-weeks | 184 |
| Skipped pair-weeks | 27 |

| Gate Decision | Signals |
| --- | --- |
| PASS | 92 |
| NO_DATA | 12 |
| REDUCE | 16 |
| SKIP | 91 |

| Skip Reason | Signals |
| --- | --- |
| insufficient_adr | 27 |

## Combined

| Variant | Total Fills | Avg Fills/Pair/Week | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate |
| --- | --- | --- | --- | --- | --- | --- |
| A: TP 0.25 + Re-entry | 261 | 1.42 | +62.30% | +0.24% | 91.95% | 89.27% |
| B: TP 0.50 + Re-entry | 144 | 0.78 | +57.89% | +0.40% | 85.42% | 77.78% |
| C: TP 0.25 + Re-entry + Session | 195 | 1.06 | +49.67% | +0.25% | 90.77% | 89.23% |
| D: TP 0.50 + Re-entry + Session | 114 | 0.62 | +45.46% | +0.40% | 83.33% | 77.19% |

### A: TP 0.25 + Re-entry

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 27 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 27 | 9 | 28 | 19 | +8.25% |
| Feb 02 | 25 | 12 | 25 | 13 | +2.34% |
| Feb 09 | 21 | 1 | 2 | 1 | +0.57% |
| Feb 16 | 21 | 3 | 6 | 3 | +0.62% |
| Feb 23 | 19 | 5 | 11 | 6 | +6.30% |
| Mar 02 | 24 | 18 | 97 | 79 | +24.87% |
| Mar 09 | 22 | 15 | 50 | 35 | +8.94% |
| Mar 16 | 25 | 18 | 42 | 24 | +10.40% |

### B: TP 0.50 + Re-entry

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 27 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 27 | 9 | 17 | 8 | +9.04% |
| Feb 02 | 25 | 12 | 17 | 5 | +3.78% |
| Feb 09 | 21 | 1 | 1 | 0 | +0.14% |
| Feb 16 | 21 | 3 | 4 | 1 | +0.55% |
| Feb 23 | 19 | 5 | 6 | 1 | +6.94% |
| Mar 02 | 24 | 18 | 46 | 28 | +23.77% |
| Mar 09 | 22 | 15 | 24 | 9 | -1.09% |
| Mar 16 | 25 | 18 | 29 | 11 | +14.75% |

### C: TP 0.25 + Re-entry + Session

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 27 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 27 | 8 | 24 | 16 | +7.69% |
| Feb 02 | 25 | 11 | 19 | 8 | +3.87% |
| Feb 09 | 21 | 1 | 1 | 0 | +0.43% |
| Feb 16 | 21 | 3 | 4 | 1 | +0.55% |
| Feb 23 | 19 | 4 | 10 | 6 | +5.89% |
| Mar 02 | 24 | 17 | 70 | 53 | +19.59% |
| Mar 09 | 22 | 13 | 31 | 18 | +3.45% |
| Mar 16 | 25 | 17 | 36 | 19 | +8.20% |

### D: TP 0.50 + Re-entry + Session

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 27 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 27 | 8 | 15 | 7 | +8.64% |
| Feb 02 | 25 | 11 | 12 | 1 | +4.97% |
| Feb 09 | 21 | 1 | 1 | 0 | +0.14% |
| Feb 16 | 21 | 3 | 4 | 1 | +0.55% |
| Feb 23 | 19 | 4 | 5 | 1 | +6.12% |
| Mar 02 | 24 | 17 | 37 | 20 | +19.93% |
| Mar 09 | 22 | 13 | 16 | 3 | -5.68% |
| Mar 16 | 25 | 17 | 24 | 7 | +10.78% |

## GATED (PASS / NO_DATA)

| Variant | Total Fills | Avg Fills/Pair/Week | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate |
| --- | --- | --- | --- | --- | --- | --- |
| A: TP 0.25 + Re-entry | 117 | 1.27 | +27.53% | +0.24% | 90.60% | 86.32% |
| B: TP 0.50 + Re-entry | 65 | 0.71 | +29.58% | +0.46% | 83.08% | 72.31% |
| C: TP 0.25 + Re-entry + Session | 81 | 0.88 | +19.54% | +0.24% | 88.89% | 86.42% |
| D: TP 0.50 + Re-entry + Session | 48 | 0.52 | +21.08% | +0.44% | 79.17% | 68.75% |

### A: TP 0.25 + Re-entry

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 12 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 14 | 4 | 7 | 3 | +3.98% |
| Feb 02 | 16 | 10 | 20 | 10 | +1.31% |
| Feb 09 | 13 | 1 | 2 | 1 | +0.57% |
| Feb 16 | 13 | 2 | 4 | 2 | +0.44% |
| Feb 23 | 10 | 4 | 10 | 6 | +6.87% |
| Mar 02 | 8 | 7 | 36 | 29 | +4.68% |
| Mar 09 | 8 | 6 | 19 | 13 | +5.92% |
| Mar 16 | 10 | 8 | 19 | 11 | +3.75% |

### B: TP 0.50 + Re-entry

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 12 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 14 | 4 | 4 | 0 | +3.85% |
| Feb 02 | 16 | 10 | 14 | 4 | +2.66% |
| Feb 09 | 13 | 1 | 1 | 0 | +0.14% |
| Feb 16 | 13 | 2 | 2 | 0 | +0.23% |
| Feb 23 | 10 | 4 | 5 | 1 | +7.52% |
| Mar 02 | 8 | 7 | 15 | 8 | +2.73% |
| Mar 09 | 8 | 6 | 10 | 4 | +6.39% |
| Mar 16 | 10 | 8 | 14 | 6 | +6.05% |

### C: TP 0.25 + Re-entry + Session

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 12 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 14 | 4 | 7 | 3 | +3.98% |
| Feb 02 | 16 | 9 | 15 | 6 | +3.01% |
| Feb 09 | 13 | 1 | 1 | 0 | +0.43% |
| Feb 16 | 13 | 2 | 2 | 0 | +0.38% |
| Feb 23 | 10 | 3 | 9 | 6 | +6.46% |
| Mar 02 | 8 | 7 | 24 | 17 | +2.08% |
| Mar 09 | 8 | 5 | 9 | 4 | +1.50% |
| Mar 16 | 10 | 7 | 14 | 7 | +1.71% |

### D: TP 0.50 + Re-entry + Session

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 12 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 14 | 4 | 4 | 0 | +3.85% |
| Feb 02 | 16 | 9 | 10 | 1 | +4.18% |
| Feb 09 | 13 | 1 | 1 | 0 | +0.14% |
| Feb 16 | 13 | 2 | 2 | 0 | +0.23% |
| Feb 23 | 10 | 3 | 4 | 1 | +6.69% |
| Mar 02 | 8 | 7 | 12 | 5 | +1.40% |
| Mar 09 | 8 | 5 | 5 | 0 | +2.19% |
| Mar 16 | 10 | 7 | 10 | 3 | +2.40% |

## NON-GATED (SKIP / REDUCE)

| Variant | Total Fills | Avg Fills/Pair/Week | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate |
| --- | --- | --- | --- | --- | --- | --- |
| A: TP 0.25 + Re-entry | 144 | 1.57 | +34.77% | +0.24% | 93.06% | 91.67% |
| B: TP 0.50 + Re-entry | 79 | 0.86 | +28.31% | +0.36% | 87.34% | 82.28% |
| C: TP 0.25 + Re-entry + Session | 114 | 1.24 | +30.13% | +0.26% | 92.11% | 91.23% |
| D: TP 0.50 + Re-entry + Session | 66 | 0.72 | +24.38% | +0.37% | 86.36% | 83.33% |

### A: TP 0.25 + Re-entry

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 15 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 13 | 5 | 21 | 16 | +4.27% |
| Feb 02 | 9 | 2 | 5 | 3 | +1.03% |
| Feb 09 | 8 | 0 | 0 | 0 | 0.00% |
| Feb 16 | 8 | 1 | 2 | 1 | +0.18% |
| Feb 23 | 9 | 1 | 1 | 0 | -0.57% |
| Mar 02 | 16 | 11 | 61 | 50 | +20.20% |
| Mar 09 | 14 | 9 | 31 | 22 | +3.02% |
| Mar 16 | 15 | 10 | 23 | 13 | +6.65% |

### B: TP 0.50 + Re-entry

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 15 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 13 | 5 | 13 | 8 | +5.18% |
| Feb 02 | 9 | 2 | 3 | 1 | +1.12% |
| Feb 09 | 8 | 0 | 0 | 0 | 0.00% |
| Feb 16 | 8 | 1 | 2 | 1 | +0.32% |
| Feb 23 | 9 | 1 | 1 | 0 | -0.57% |
| Mar 02 | 16 | 11 | 31 | 20 | +21.03% |
| Mar 09 | 14 | 9 | 14 | 5 | -7.48% |
| Mar 16 | 15 | 10 | 15 | 5 | +8.70% |

### C: TP 0.25 + Re-entry + Session

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 15 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 13 | 4 | 17 | 13 | +3.71% |
| Feb 02 | 9 | 2 | 4 | 2 | +0.87% |
| Feb 09 | 8 | 0 | 0 | 0 | 0.00% |
| Feb 16 | 8 | 1 | 2 | 1 | +0.18% |
| Feb 23 | 9 | 1 | 1 | 0 | -0.57% |
| Mar 02 | 16 | 10 | 46 | 36 | +17.52% |
| Mar 09 | 14 | 8 | 22 | 14 | +1.95% |
| Mar 16 | 15 | 10 | 22 | 12 | +6.49% |

### D: TP 0.50 + Re-entry + Session

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 15 | 0 | 0 | 0 | 0.00% |
| Jan 26 | 13 | 4 | 11 | 7 | +4.79% |
| Feb 02 | 9 | 2 | 2 | 0 | +0.79% |
| Feb 09 | 8 | 0 | 0 | 0 | 0.00% |
| Feb 16 | 8 | 1 | 2 | 1 | +0.32% |
| Feb 23 | 9 | 1 | 1 | 0 | -0.57% |
| Mar 02 | 16 | 10 | 25 | 15 | +18.53% |
| Mar 09 | 14 | 8 | 11 | 3 | -7.87% |
| Mar 16 | 15 | 10 | 14 | 4 | +8.38% |

## Comparison Vs Test 2 Baselines

| Metric | Value |
| --- | --- |
| Test 2 TP 0.25 single-fill trades | 79 |
| Test 2 TP 0.25 single-fill total return | +24.12% |
| Test 2 TP 0.25 single-fill win rate | 94.94% |
| Test 3 Variant A fills | 261 |
| Test 3 Variant A total return | +62.30% |
| Test 3 Variant A win rate | 91.95% |
| Delta vs Test 2 TP 0.25 | +38.18% |
| Test 2 Baseline Hold total return | +95.81% |
| Test 2 Baseline Hold win rate | 73.42% |
| Variant A minus Test 2 Hold | -33.51% |

## Notes

- Avg fills per pair/week uses eligible pair-weeks as the denominator.
- Session gating only affects whether a new fill can occur. Once in a trade, TP and final week-close exits are always allowed.
- H1 candles still hide intrabar order. Same-bar fill and TP are counted, but multiple re-entry cycles inside one candle are intentionally not modeled.


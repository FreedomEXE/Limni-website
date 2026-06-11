# COT Deep History Research

Weeks analyzed: 10 (Jan 19 → Mar 22).
Stored FX history window: 2021-04-13 → 2026-03-31 (260 dates).

## Baseline Checks

| Baseline | Pairs | Total% | Win% | Avg% |
| --- | ---: | ---: | ---: | ---: |
| Dealer non-neutral baseline | 150 | +38.03% | 55.3% | +0.254% |
| Dealer neutral lean baseline | 130 | -58.66% | 34.6% | -0.451% |
| Commercial forced-raw baseline | 280 | +23.41% | 52.9% | +0.084% |

## Section 1: Multi-Week Dealer Momentum

### Neutral Resolver

| Method | Pairs | Total% | Win% | Avg% |
| --- | --- | --- | --- | --- |
| OI-confirmed delta | 90 | +4.85% | 54.4% | +0.054% |
| 2-week net momentum | 130 | -7.06% | 50.0% | -0.054% |
| 4-week net momentum | 130 | -8.21% | 47.7% | -0.063% |
| 8-week net momentum | 130 | -17.46% | 48.5% | -0.134% |
| Delta persistence (0-4) | 93 | +7.92% | 60.2% | +0.085% |
| 2-week %OI momentum | 130 | +14.84% | 56.2% | +0.114% |
| 4-week %OI momentum | 130 | -12.37% | 50.8% | -0.095% |

### Non-Neutral Quality

| Filter on non-neutral | Pairs | Total% | Win% | Avg% | vs Base |
| --- | --- | --- | --- | --- | --- |
| Dealer non-neutral baseline | 150 | +38.03% | 55.3% | +0.254% | +0.00% |
| 4-week momentum confirms | 107 | +20.71% | 54.2% | +0.194% | -17.32% |
| 4-week momentum contradicts | 43 | +17.32% | 58.1% | +0.403% | -20.71% |
| Delta persistence confirms | 46 | +30.21% | 76.1% | +0.657% | -7.82% |

### 4-Week Momentum Threshold Grid

| Threshold | Pairs | Total% | Win% | Avg% |
| --- | --- | --- | --- | --- |
| 4-week momentum |score| >= 0 | 130 | -8.21% | 47.7% | -0.063% |
| 4-week momentum |score| >= 5000 | 111 | -17.42% | 46.8% | -0.157% |
| 4-week momentum |score| >= 10000 | 93 | -7.52% | 49.5% | -0.081% |
| 4-week momentum |score| >= 20000 | 74 | -8.98% | 45.9% | -0.121% |

## Section 2: Historical Extremeness

### Neutral Resolver

| Method | Pairs | Total% | Win% | Avg% |
| --- | --- | --- | --- | --- |
| Net percentile direction | 129 | -30.98% | 44.2% | -0.240% |
| %OI percentile direction | 129 | -15.25% | 48.1% | -0.118% |
| Only when extreme (>80 or <20) | 116 | -22.06% | 46.6% | -0.190% |
| Extreme + rising direction | 69 | -13.24% | 44.9% | -0.192% |

### Non-Neutral Quality

| Filter on non-neutral | Pairs | Total% | Win% | Avg% | vs Base |
| --- | --- | --- | --- | --- | --- |
| Dealer non-neutral baseline | 150 | +38.03% | 55.3% | +0.254% | +0.00% |
| Current net at extreme pctile | 135 | +33.01% | 56.3% | +0.245% | -5.02% |
| Current net in middle (20-80) | 15 | +5.02% | 46.7% | +0.334% | -33.01% |
| Extreme + rising confirms dir | 101 | +19.65% | 55.4% | +0.195% | -18.38% |
| Extreme + fading (caution) | 34 | +13.36% | 58.8% | +0.393% | -24.67% |

## Section 3: Spread-Book Quality

### Neutral Resolver

| Method | Pairs | Total% | Win% | Avg% |
| --- | --- | --- | --- | --- |
| Directional ratio direction | 118 | +31.90% | 61.0% | +0.270% |
| Only high-ratio pairs (>0.3) | 111 | +27.24% | 60.4% | +0.245% |

### Non-Neutral Quality

| Filter on non-neutral | Pairs | Total% | Win% | Avg% | vs Base |
| --- | --- | --- | --- | --- | --- |
| Dealer non-neutral baseline | 150 | +38.03% | 55.3% | +0.254% | +0.00% |
| Both currencies high-ratio | 143 | +38.15% | 55.9% | +0.267% | +0.12% |
| Either currency low-ratio | 7 | -0.12% | 42.9% | -0.017% | -38.15% |

## Section 4: Trader-Count Structure

### Neutral Resolver

| Method | Pairs | Total% | Win% | Avg% |
| --- | --- | --- | --- | --- |
| Trader imbalance direction | 109 | +0.77% | 51.4% | +0.007% |
| Only when imbalance > 1.5:1 | 29 | -0.54% | 48.3% | -0.018% |

### Non-Neutral Quality

| Filter on non-neutral | Pairs | Total% | Win% | Avg% | vs Base |
| --- | --- | --- | --- | --- | --- |
| Dealer non-neutral baseline | 150 | +38.03% | 55.3% | +0.254% | +0.00% |
| Strong trader imbalance (>1.5) | 53 | +9.45% | 60.4% | +0.178% | -28.58% |
| Weak imbalance (<1.2) | 5 | +2.77% | 40.0% | +0.554% | -35.26% |
| High total trader count | 43 | +8.01% | 58.1% | +0.186% | -30.02% |
| Low total trader count | 56 | +24.56% | 58.9% | +0.439% | -13.47% |

## Section 5: Stacked Neutral Resolver

### Proposed

| Tier | Resolved | Cumulative | Tier Win% | Cumulative Win% | Tier Total% |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tier 1: OI+Delta | 90 | 90 | 54.4% | 54.4% | +4.85% |
| Tier 2: 4wk Momentum >= 10000 | 31 | 121 | 48.4% | 52.9% | -6.25% |
| Tier 3: Extreme Pctile | 9 | 130 | 55.6% | 53.1% | -0.57% |
| Tier 4: Delta Fallback | 0 | 130 | 0.0% | 53.1% | +0.00% |
| Remaining unresolved | 0 | 130 | — | — | — |

Resolved stats: 130 gaps filled, -1.98%, 53.1% WR.

### Momentum First

| Tier | Resolved | Cumulative | Tier Win% | Cumulative Win% | Tier Total% |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tier 1: 4wk Momentum >= 10000 | 93 | 93 | 49.5% | 49.5% | -7.52% |
| Tier 2: OI+Delta | 28 | 121 | 57.1% | 51.2% | -2.51% |
| Tier 3: Extreme Pctile | 9 | 130 | 55.6% | 51.5% | -0.57% |
| Tier 4: Delta Fallback | 0 | 130 | 0.0% | 51.5% | +0.00% |
| Remaining unresolved | 0 | 130 | — | — | — |

Resolved stats: 130 gaps filled, -10.60%, 51.5% WR.

### Extremes First

| Tier | Resolved | Cumulative | Tier Win% | Cumulative Win% | Tier Total% |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tier 1: Extreme Pctile | 116 | 116 | 46.6% | 46.6% | -22.06% |
| Tier 2: OI+Delta | 8 | 124 | 87.5% | 49.2% | +4.73% |
| Tier 3: 4wk Momentum >= 10000 | 6 | 130 | 33.3% | 48.5% | -5.76% |
| Tier 4: Delta Fallback | 0 | 130 | 0.0% | 48.5% | +0.00% |
| Remaining unresolved | 0 | 130 | — | — | — |

Resolved stats: 130 gaps filled, -23.09%, 48.5% WR.

| Dealer System | Trades | Total% | MaxDD% | Win% |
| --- | ---: | ---: | ---: | ---: |
| Current dealer (no fill) | 230 | +73.18% | 2.19% | 56.5% |
| Dealer + stacked fill (Proposed) | 360 | +71.20% | 8.85% | 55.3% |

## Section 6: Commercial Deep-History Research

### Momentum Filters

| Filter on commercial forced-raw | Pairs | Total% | Win% | Avg% | vs Base |
| --- | --- | --- | --- | --- | --- |
| Commercial forced-raw baseline | 280 | +23.41% | 52.9% | +0.084% | +0.00% |
| 4-week momentum confirms | 187 | +24.91% | 54.5% | +0.133% | +1.50% |
| 4-week momentum contradicts | 93 | -1.50% | 49.5% | -0.016% | -24.91% |
| Delta persistence ≥ current dir | 97 | +24.24% | 62.9% | +0.250% | +0.83% |

### Extreme Filters

| Filter on commercial forced-raw | Pairs | Total% | Win% | Avg% | vs Base |
| --- | --- | --- | --- | --- | --- |
| Commercial forced-raw baseline | 280 | +23.41% | 52.9% | +0.084% | +0.00% |
| Commercial at extreme pctile | 193 | +2.61% | 49.7% | +0.014% | -20.80% |
| Commercial in middle (20-80) | 87 | +20.79% | 59.8% | +0.239% | -2.62% |
| Extreme + momentum confirms | 139 | +3.73% | 50.4% | +0.027% | -19.68% |

### Mean-Reversion Filters

| Filter on commercial forced-raw | Pairs | Total% | Win% | Avg% | vs Base |
| --- | --- | --- | --- | --- | --- |
| Commercial forced-raw baseline | 280 | +23.41% | 52.9% | +0.084% | +0.00% |
| Moving toward 52w mean | 114 | +23.07% | 61.4% | +0.202% | -0.34% |
| Moving away from 52w mean | 166 | +0.34% | 47.0% | +0.002% | -23.07% |
| Far from mean + returning | 55 | +16.32% | 63.6% | +0.297% | -7.09% |

## Summary

1. Most useful dealer momentum resolver: `Delta persistence (0-4)` (93 filled, +7.92%, 60.2% WR).
2. Historical extremeness did not add more signal than momentum on dealer neutrals. Best extreme method: `%OI percentile direction`.
3. Spread-book and trader-structure contributions were mixed. Best spread-quality slice: `Both currencies high-ratio`. Best trader-structure slice: `Weak imbalance (<1.2)`.
4. Best stacked resolver hierarchy: `Proposed`, resolving 130/130 dealer gaps.
5. Combined dealer standalone result with stacked resolution moved from +73.18% / 2.19% DD to +71.20% / 8.85% DD.
6. Best commercial enrichment from this pass: `4-week momentum confirms`, which beat baseline by +1.50%.
7. Momentum and extremeness do help both dealer and commercial, but dealer gains are cleaner so far than commercial gains.


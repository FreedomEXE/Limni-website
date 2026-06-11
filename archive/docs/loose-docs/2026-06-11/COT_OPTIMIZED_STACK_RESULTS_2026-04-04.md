# COT Optimized Stack Research

Weeks analyzed: 10 (Jan 19 → Mar 22).
Stored FX history window: 2021-04-13 → 2026-03-31 (260 dates).

## Step 0: Baseline Reproduction

| Baseline | Pairs | Total% | MaxDD% | Win% |
| --- | ---: | ---: | ---: | ---: |
| Dealer non-neutral | 150 | +38.03% | — | 55.3% |
| Dealer neutral lean | 130 | -58.66% | — | 34.6% |
| Commercial forced-raw | 280 | +23.41% | — | 52.9% |
| Dealer standalone (no fill) | 230 | +73.18% | 2.19% | 56.5% |

## Step 1: Dealer Method Confirmation

### Neutral Resolver Confirmation

| Method | Pairs | Total% | Win% | Avg% |
| --- | --- | --- | --- | --- |
| Spread directional ratio | 118 | +31.90% | 61.0% | +0.270% |
| Delta persistence (>=3 of 4) | 103 | -4.40% | 56.3% | -0.043% |
| OI-confirmed delta | 90 | +4.85% | 54.4% | +0.054% |

## Step 2: Dealer Optimized Stack Waterfall

| Tier | Resolved | Cumulative | Tier Win% | Cum Win% | Tier Total% |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tier 1: Spread Ratio | 118 | 118 | 61.0% | 61.0% | +31.90% |
| Tier 2: Delta Persistence | 9 | 127 | 44.4% | 59.8% | -12.39% |
| Tier 3: OI-Confirm | 2 | 129 | 0.0% | 58.9% | -1.45% |
| Remaining unresolved | 1 | 129 | — | — | — |

Resolved neutral stats: 129 fills, +18.06%, 58.9% WR.

## Step 3: Dealer Combined Standalone Result

| Dealer System | Trades | Total% | MaxDD% | Win% |
| --- | ---: | ---: | ---: | ---: |
| Current dealer (no fill) | 230 | +73.18% | 2.19% | 56.5% |
| Dealer + spread ratio only | 348 | +105.08% | 0.00% | 58.0% |
| Dealer + optimized stack | 359 | +91.24% | 0.00% | 57.4% |

## Step 4: Dealer Non-Neutral Impact Check

### Filter on non-neutral

| Filter | Pairs | Total% | Win% | Avg% | vs Base |
| --- | --- | --- | --- | --- | --- |
| Dealer non-neutral | 150 | +38.03% | 55.3% | +0.254% | +0.00% |
| Spread ratio confirms direction | 59 | +26.03% | 64.4% | +0.441% | -12.00% |
| Spread ratio contradicts | 90 | +11.08% | 48.9% | +0.123% | -26.95% |
| Delta persist confirms | 52 | +29.61% | 73.1% | +0.569% | -8.42% |
| Delta persist contradicts | 56 | +15.35% | 48.2% | +0.274% | -22.68% |

## Step 5: Commercial Quality Filters

### Filter on commercial forced-raw

| Filter | Pairs | Total% | Win% | Avg% | vs Base |
| --- | --- | --- | --- | --- | --- |
| Commercial forced-raw | 280 | +23.41% | 52.9% | +0.084% | +0.00% |
| Delta persistence confirms | 95 | +11.62% | 58.9% | +0.122% | -11.79% |
| Moving toward 52w mean | 89 | +3.86% | 56.2% | +0.043% | -19.55% |
| Either filter confirms | 150 | +13.71% | 57.3% | +0.091% | -9.70% |
| Both filters confirm | 34 | +1.76% | 58.8% | +0.052% | -21.65% |
| Neither filter confirms | 130 | +9.69% | 47.7% | +0.075% | -13.72% |

## Step 6: Commercial High/Low Confidence Split

| Commercial Tier | Trades | Total% | MaxDD% | Win% |
| --- | ---: | ---: | ---: | ---: |
| All commercial (baseline) | 280 | +23.41% | 29.04% | 52.9% |
| High-confidence subset | 150 | +13.71% | 4.36% | 57.3% |
| Low-confidence subset | 130 | +9.69% | 16.32% | 47.7% |

## Phase 2 Gate

- Dealer bar: PASS (needs >= +60%, <= 10% DD, >= 54% WR; got +91.24%, 0.00% DD, 57.4% WR).
- Commercial bar: PASS (needs high-confidence WR >= 57%; got 57.3%).

Both bars passed. Phase 2 canonicalization is allowed.


# Selector Weighted Tiebreak Research

Weeks analyzed: 10 (Mar 22 -> Jan 19).
Baseline: canonical selector strength_tiebreak.
All returns ADR-normalized.

## Conflict Scenario Distribution

Total conflict pair-weeks: 144 / 360

| Scenario | Count | % of Conflicts | Baseline Return | Notes |
| --- | ---: | ---: | ---: | --- |
| St_sent_C_sent | 80 | 55.6% | +18.16% | St sent C sent |
| St_sent_C_dealer | 8 | 5.6% | -0.59% | St sent C dealer |
| St_sent_C_neutral | 0 | 0.0% | +0.00% | St sent C neutral |
| St_dealer_C_sent | 51 | 35.4% | -1.16% | St dealer C sent |
| St_dealer_C_dealer | 5 | 3.5% | -1.31% | St dealer C dealer |
| St_dealer_C_neutral | 0 | 0.0% | +0.00% | St dealer C neutral |
| St_neutral_C_sent | 0 | 0.0% | +0.00% | St neutral C sent |
| St_neutral_C_dealer | 0 | 0.0% | +0.00% | St neutral C dealer |
| St_neutral_C_neutral | 0 | 0.0% | +0.00% | St neutral C neutral |

## Scenario Impact: St_sent_C_sent

Baseline: +18.16% across 80 conflict pair-weeks.

| Variant | Flips to Dealer | Baseline Return | Variant Return | Delta |
| --- | ---: | ---: | ---: | ---: |
| Clean equal (St=1 C=1) | 0 | +18.16% | +13.36% | -4.79% |
| Weighted W1 (St=1.5 C=0.75) | 0 | +18.16% | +13.36% | -4.79% |
| Weighted W2 (St=2.0 C=0.75) | 0 | +18.16% | +13.36% | -4.79% |
| Weighted W3 (St=2.0 C=0.5) | 0 | +18.16% | +13.36% | -4.79% |
| Weighted W4 (St=1.5 C=0.5) | 0 | +18.16% | +13.36% | -4.79% |
| Strength-first fallback | 0 | +18.16% | +13.36% | -4.79% |
| Dealer-bias W1 | 0 | +18.16% | +13.36% | -4.79% |
| Commercial gate W1 | 0 | +18.16% | +13.36% | -4.79% |

## Scenario Impact: St_sent_C_dealer

Baseline: -0.59% across 8 conflict pair-weeks.

| Variant | Flips to Dealer | Baseline Return | Variant Return | Delta |
| --- | ---: | ---: | ---: | ---: |
| Clean equal (St=1 C=1) | 0 | -0.59% | -3.25% | -2.66% |
| Weighted W1 (St=1.5 C=0.75) | 0 | -0.59% | -3.25% | -2.66% |
| Weighted W2 (St=2.0 C=0.75) | 0 | -0.59% | -3.25% | -2.66% |
| Weighted W3 (St=2.0 C=0.5) | 0 | -0.59% | -3.25% | -2.66% |
| Weighted W4 (St=1.5 C=0.5) | 0 | -0.59% | -3.25% | -2.66% |
| Strength-first fallback | 0 | -0.59% | -3.25% | -2.66% |
| Dealer-bias W1 | 0 | -0.59% | -3.25% | -2.66% |
| Commercial gate W1 | 0 | -0.59% | -3.25% | -2.66% |

## Scenario Impact: St_dealer_C_sent

Baseline: -1.16% across 51 conflict pair-weeks.

| Variant | Flips to Dealer | Baseline Return | Variant Return | Delta |
| --- | ---: | ---: | ---: | ---: |
| Clean equal (St=1 C=1) | 0 | -1.16% | +2.81% | +3.98% |
| Weighted W1 (St=1.5 C=0.75) | 1 | -1.16% | -2.81% | -1.65% |
| Weighted W2 (St=2.0 C=0.75) | 1 | -1.16% | -2.81% | -1.65% |
| Weighted W3 (St=2.0 C=0.5) | 1 | -1.16% | -2.81% | -1.65% |
| Weighted W4 (St=1.5 C=0.5) | 1 | -1.16% | -2.81% | -1.65% |
| Strength-first fallback | 1 | -1.16% | -2.81% | -1.65% |
| Dealer-bias W1 | 1 | -1.16% | -2.81% | -1.65% |
| Commercial gate W1 | 1 | -1.16% | -2.81% | -1.65% |

## Master Comparison

| Variant | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Changed Decisions | Changed Return |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline strength_tiebreak | 360 | +91.96% | 4.01% | 54.2% | 1 | 36.0 | 0 | +0.00% |
| Clean equal (St=1 C=1) | 360 | +88.49% | 1.91% | 58.9% | 2 | 36.0 | 75 | -3.47% |
| Weighted W1 (St=1.5 C=0.75) | 360 | +82.86% | 4.54% | 55.3% | 2 | 36.0 | 26 | -9.10% |
| Weighted W2 (St=2.0 C=0.75) | 360 | +82.86% | 4.54% | 55.3% | 2 | 36.0 | 26 | -9.10% |
| Weighted W3 (St=2.0 C=0.5) | 360 | +82.86% | 4.54% | 55.3% | 2 | 36.0 | 26 | -9.10% |
| Weighted W4 (St=1.5 C=0.5) | 360 | +82.86% | 4.54% | 55.3% | 2 | 36.0 | 26 | -9.10% |
| Strength-first fallback | 360 | +82.86% | 4.54% | 55.3% | 2 | 36.0 | 26 | -9.10% |
| Dealer-bias W1 | 360 | +82.86% | 4.54% | 55.3% | 2 | 36.0 | 26 | -9.10% |
| Commercial gate W1 | 360 | +82.86% | 4.54% | 55.3% | 2 | 36.0 | 26 | -9.10% |

## Asset Breakdown

### Baseline strength_tiebreak

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +42.09% | 52.5% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Clean equal (St=1 C=1)

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +36.16% | 57.9% |
| crypto | 20 | +18.80% | 80.0% |
| indices | 30 | +0.74% | 56.7% |
| commodities | 30 | +32.79% | 56.7% |

### Weighted W1 (St=1.5 C=0.75)

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +32.96% | 53.6% |
| crypto | 20 | +17.20% | 65.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Weighted W2 (St=2.0 C=0.75)

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +32.96% | 53.6% |
| crypto | 20 | +17.20% | 65.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Weighted W3 (St=2.0 C=0.5)

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +32.96% | 53.6% |
| crypto | 20 | +17.20% | 65.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Weighted W4 (St=1.5 C=0.5)

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +32.96% | 53.6% |
| crypto | 20 | +17.20% | 65.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Strength-first fallback

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +32.96% | 53.6% |
| crypto | 20 | +17.20% | 65.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Dealer-bias W1

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +32.96% | 53.6% |
| crypto | 20 | +17.20% | 65.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Commercial gate W1

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +32.96% | 53.6% |
| crypto | 20 | +17.20% | 65.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

## Decision Changes: clean_equal

| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |
| --- | --- | --- | --- | --- | ---: |
| 2026-01-26 | CADCHF | LONG | SHORT | St_dealer_C_sent | -0.54% |
| 2026-01-26 | CHFJPY | SHORT | LONG | St_dealer_C_sent | +0.57% |
| 2026-01-26 | EURCHF | LONG | SHORT | St_dealer_C_sent | +2.13% |
| 2026-01-26 | GBPCHF | LONG | SHORT | St_dealer_C_sent | +0.64% |
| 2026-01-26 | USDCHF | LONG | SHORT | St_dealer_C_sent | +0.69% |
| 2026-01-26 | XAUUSD | LONG | SHORT | St_dealer_C_sent | +1.87% |
| 2026-02-02 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.57% |
| 2026-02-02 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.11% |
| 2026-02-02 | USDCHF | LONG | SHORT | St_dealer_C_sent | -0.69% |
| 2026-02-02 | XAGUSD | LONG | SHORT | St_dealer_C_sent | +0.55% |
| 2026-02-09 | CHFJPY | SHORT | LONG | St_dealer_C_sent | -4.43% |
| 2026-02-09 | ETHUSD | LONG | SHORT | St_dealer_C_sent | +1.05% |
| 2026-02-09 | EURCAD | SHORT | LONG | St_sent_C_dealer | +0.20% |
| 2026-02-09 | EURCHF | LONG | SHORT | St_dealer_C_sent | +2.81% |
| 2026-02-09 | GBPCAD | SHORT | LONG | St_dealer_C_sent | +0.02% |
| 2026-02-09 | GBPCHF | LONG | SHORT | St_dealer_C_sent | +1.88% |
| 2026-02-09 | GBPJPY | SHORT | LONG | St_dealer_C_sent | -5.98% |
| 2026-02-09 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.69% |
| 2026-02-09 | USDCHF | LONG | SHORT | St_sent_C_sent | +1.91% |
| 2026-02-09 | USDJPY | SHORT | LONG | St_dealer_C_sent | -6.56% |
| 2026-02-09 | XAUUSD | LONG | SHORT | St_dealer_C_sent | -0.41% |
| 2026-02-16 | ETHUSD | LONG | SHORT | St_dealer_C_sent | +0.12% |
| 2026-02-16 | EURCAD | SHORT | LONG | St_sent_C_dealer | -1.40% |
| 2026-02-16 | GBPCAD | SHORT | LONG | St_sent_C_sent | -2.86% |
| 2026-02-16 | NZDCHF | LONG | SHORT | St_dealer_C_sent | -0.12% |
| 2026-02-16 | NZDUSD | SHORT | LONG | St_sent_C_sent | -1.98% |
| 2026-02-16 | USDCHF | LONG | SHORT | St_sent_C_sent | -2.56% |
| 2026-02-16 | XAGUSD | LONG | SHORT | St_dealer_C_sent | -3.59% |
| 2026-02-23 | CADCHF | LONG | SHORT | St_sent_C_sent | +1.73% |
| 2026-02-23 | CHFJPY | SHORT | LONG | St_sent_C_sent | +3.78% |
| 2026-02-23 | ETHUSD | LONG | SHORT | St_dealer_C_sent | +0.42% |
| 2026-02-23 | EURUSD | LONG | SHORT | St_dealer_C_sent | -0.76% |
| 2026-02-23 | GBPNZD | LONG | SHORT | St_sent_C_dealer | +1.24% |
| 2026-02-23 | NDXUSD | LONG | SHORT | St_dealer_C_sent | +0.36% |
| 2026-02-23 | NZDCAD | SHORT | LONG | St_sent_C_sent | +0.28% |
| 2026-02-23 | NZDCHF | LONG | SHORT | St_dealer_C_sent | +1.05% |
| 2026-02-23 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.26% |
| 2026-02-23 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.85% |
| 2026-02-23 | USDCHF | LONG | SHORT | St_sent_C_sent | +2.11% |
| 2026-02-23 | USDJPY | SHORT | LONG | St_dealer_C_sent | +1.65% |
| 2026-02-23 | XAGUSD | LONG | SHORT | St_dealer_C_sent | -3.03% |
| 2026-03-02 | AUDCAD | SHORT | LONG | St_sent_C_dealer | -2.70% |
| 2026-03-02 | AUDCHF | LONG | SHORT | St_dealer_C_sent | -1.92% |
| 2026-03-02 | CADCHF | LONG | SHORT | St_dealer_C_sent | -6.41% |
| 2026-03-02 | ETHUSD | LONG | SHORT | St_sent_C_sent | +0.03% |
| 2026-03-02 | EURCHF | LONG | SHORT | St_dealer_C_sent | +0.93% |
| 2026-03-02 | GBPUSD | SHORT | LONG | St_dealer_C_sent | +0.04% |
| 2026-03-02 | NZDCAD | SHORT | LONG | St_sent_C_sent | -5.17% |
| 2026-03-02 | NZDCHF | LONG | SHORT | St_dealer_C_sent | -0.52% |
| 2026-03-02 | USDCHF | LONG | SHORT | St_dealer_C_sent | -3.05% |
| 2026-03-02 | USDJPY | SHORT | LONG | St_sent_C_sent | +2.74% |
| 2026-03-02 | XAGUSD | LONG | SHORT | St_dealer_C_sent | +3.54% |
| 2026-03-02 | XAUUSD | LONG | SHORT | St_dealer_C_sent | +3.23% |
| 2026-03-08 | CADCHF | LONG | SHORT | St_sent_C_sent | -1.93% |
| 2026-03-08 | EURGBP | LONG | SHORT | St_dealer_C_sent | +1.30% |
| 2026-03-08 | EURUSD | LONG | SHORT | St_dealer_C_sent | +3.19% |
| 2026-03-08 | GBPJPY | SHORT | LONG | St_sent_C_sent | +0.39% |
| 2026-03-08 | GBPUSD | SHORT | LONG | St_sent_C_sent | -2.07% |
| 2026-03-08 | NIKKEIUSD | LONG | SHORT | St_dealer_C_sent | -0.19% |
| 2026-03-08 | USDCHF | LONG | SHORT | St_sent_C_sent | -3.61% |
| 2026-03-15 | AUDCAD | SHORT | LONG | St_dealer_C_sent | +0.67% |
| 2026-03-15 | CADCHF | LONG | SHORT | St_dealer_C_sent | +0.83% |
| 2026-03-15 | CHFJPY | SHORT | LONG | St_dealer_C_sent | +0.08% |
| 2026-03-15 | EURCHF | LONG | SHORT | St_sent_C_sent | -4.07% |
| 2026-03-15 | USDCHF | LONG | SHORT | St_dealer_C_sent | +0.64% |
| 2026-03-22 | AUDCAD | LONG | SHORT | St_dealer_C_sent | +0.87% |
| 2026-03-22 | AUDJPY | LONG | SHORT | St_dealer_C_sent | +2.17% |
| 2026-03-22 | AUDUSD | LONG | SHORT | St_dealer_C_sent | +2.60% |
| 2026-03-22 | EURGBP | LONG | SHORT | St_dealer_C_sent | -0.81% |
| 2026-03-22 | GBPAUD | SHORT | LONG | St_dealer_C_sent | +3.42% |
| 2026-03-22 | GBPCHF | SHORT | LONG | St_dealer_C_sent | +2.52% |
| 2026-03-22 | GBPNZD | SHORT | LONG | St_dealer_C_sent | +2.65% |
| 2026-03-22 | NIKKEIUSD | LONG | SHORT | St_dealer_C_sent | -0.59% |
| 2026-03-22 | XAGUSD | LONG | SHORT | St_dealer_C_sent | -0.72% |
| 2026-03-22 | XAUUSD | LONG | SHORT | St_dealer_C_sent | -0.17% |

## Decision Changes: weighted_W1

| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |
| --- | --- | --- | --- | --- | ---: |
| 2026-02-02 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.57% |
| 2026-02-02 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.11% |
| 2026-02-09 | CADCHF | SHORT | LONG | St_dealer_C_sent | -1.65% |
| 2026-02-09 | EURCAD | SHORT | LONG | St_sent_C_dealer | +0.20% |
| 2026-02-09 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.69% |
| 2026-02-09 | USDCHF | LONG | SHORT | St_sent_C_sent | +1.91% |
| 2026-02-16 | EURCAD | SHORT | LONG | St_sent_C_dealer | -1.40% |
| 2026-02-16 | GBPCAD | SHORT | LONG | St_sent_C_sent | -2.86% |
| 2026-02-16 | NZDUSD | SHORT | LONG | St_sent_C_sent | -1.98% |
| 2026-02-16 | USDCHF | LONG | SHORT | St_sent_C_sent | -2.56% |
| 2026-02-23 | CADCHF | LONG | SHORT | St_sent_C_sent | +1.73% |
| 2026-02-23 | CHFJPY | SHORT | LONG | St_sent_C_sent | +3.78% |
| 2026-02-23 | GBPNZD | LONG | SHORT | St_sent_C_dealer | +1.24% |
| 2026-02-23 | NZDCAD | SHORT | LONG | St_sent_C_sent | +0.28% |
| 2026-02-23 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.26% |
| 2026-02-23 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.85% |
| 2026-02-23 | USDCHF | LONG | SHORT | St_sent_C_sent | +2.11% |
| 2026-03-02 | AUDCAD | SHORT | LONG | St_sent_C_dealer | -2.70% |
| 2026-03-02 | ETHUSD | LONG | SHORT | St_sent_C_sent | +0.03% |
| 2026-03-02 | NZDCAD | SHORT | LONG | St_sent_C_sent | -5.17% |
| 2026-03-02 | USDJPY | SHORT | LONG | St_sent_C_sent | +2.74% |
| 2026-03-08 | CADCHF | LONG | SHORT | St_sent_C_sent | -1.93% |
| 2026-03-08 | GBPJPY | SHORT | LONG | St_sent_C_sent | +0.39% |
| 2026-03-08 | GBPUSD | SHORT | LONG | St_sent_C_sent | -2.07% |
| 2026-03-08 | USDCHF | LONG | SHORT | St_sent_C_sent | -3.61% |
| 2026-03-15 | EURCHF | LONG | SHORT | St_sent_C_sent | -4.07% |

## Decision Changes: weighted_W2

| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |
| --- | --- | --- | --- | --- | ---: |
| 2026-02-02 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.57% |
| 2026-02-02 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.11% |
| 2026-02-09 | CADCHF | SHORT | LONG | St_dealer_C_sent | -1.65% |
| 2026-02-09 | EURCAD | SHORT | LONG | St_sent_C_dealer | +0.20% |
| 2026-02-09 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.69% |
| 2026-02-09 | USDCHF | LONG | SHORT | St_sent_C_sent | +1.91% |
| 2026-02-16 | EURCAD | SHORT | LONG | St_sent_C_dealer | -1.40% |
| 2026-02-16 | GBPCAD | SHORT | LONG | St_sent_C_sent | -2.86% |
| 2026-02-16 | NZDUSD | SHORT | LONG | St_sent_C_sent | -1.98% |
| 2026-02-16 | USDCHF | LONG | SHORT | St_sent_C_sent | -2.56% |
| 2026-02-23 | CADCHF | LONG | SHORT | St_sent_C_sent | +1.73% |
| 2026-02-23 | CHFJPY | SHORT | LONG | St_sent_C_sent | +3.78% |
| 2026-02-23 | GBPNZD | LONG | SHORT | St_sent_C_dealer | +1.24% |
| 2026-02-23 | NZDCAD | SHORT | LONG | St_sent_C_sent | +0.28% |
| 2026-02-23 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.26% |
| 2026-02-23 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.85% |
| 2026-02-23 | USDCHF | LONG | SHORT | St_sent_C_sent | +2.11% |
| 2026-03-02 | AUDCAD | SHORT | LONG | St_sent_C_dealer | -2.70% |
| 2026-03-02 | ETHUSD | LONG | SHORT | St_sent_C_sent | +0.03% |
| 2026-03-02 | NZDCAD | SHORT | LONG | St_sent_C_sent | -5.17% |
| 2026-03-02 | USDJPY | SHORT | LONG | St_sent_C_sent | +2.74% |
| 2026-03-08 | CADCHF | LONG | SHORT | St_sent_C_sent | -1.93% |
| 2026-03-08 | GBPJPY | SHORT | LONG | St_sent_C_sent | +0.39% |
| 2026-03-08 | GBPUSD | SHORT | LONG | St_sent_C_sent | -2.07% |
| 2026-03-08 | USDCHF | LONG | SHORT | St_sent_C_sent | -3.61% |
| 2026-03-15 | EURCHF | LONG | SHORT | St_sent_C_sent | -4.07% |

## Decision Changes: weighted_W3

| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |
| --- | --- | --- | --- | --- | ---: |
| 2026-02-02 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.57% |
| 2026-02-02 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.11% |
| 2026-02-09 | CADCHF | SHORT | LONG | St_dealer_C_sent | -1.65% |
| 2026-02-09 | EURCAD | SHORT | LONG | St_sent_C_dealer | +0.20% |
| 2026-02-09 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.69% |
| 2026-02-09 | USDCHF | LONG | SHORT | St_sent_C_sent | +1.91% |
| 2026-02-16 | EURCAD | SHORT | LONG | St_sent_C_dealer | -1.40% |
| 2026-02-16 | GBPCAD | SHORT | LONG | St_sent_C_sent | -2.86% |
| 2026-02-16 | NZDUSD | SHORT | LONG | St_sent_C_sent | -1.98% |
| 2026-02-16 | USDCHF | LONG | SHORT | St_sent_C_sent | -2.56% |
| 2026-02-23 | CADCHF | LONG | SHORT | St_sent_C_sent | +1.73% |
| 2026-02-23 | CHFJPY | SHORT | LONG | St_sent_C_sent | +3.78% |
| 2026-02-23 | GBPNZD | LONG | SHORT | St_sent_C_dealer | +1.24% |
| 2026-02-23 | NZDCAD | SHORT | LONG | St_sent_C_sent | +0.28% |
| 2026-02-23 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.26% |
| 2026-02-23 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.85% |
| 2026-02-23 | USDCHF | LONG | SHORT | St_sent_C_sent | +2.11% |
| 2026-03-02 | AUDCAD | SHORT | LONG | St_sent_C_dealer | -2.70% |
| 2026-03-02 | ETHUSD | LONG | SHORT | St_sent_C_sent | +0.03% |
| 2026-03-02 | NZDCAD | SHORT | LONG | St_sent_C_sent | -5.17% |
| 2026-03-02 | USDJPY | SHORT | LONG | St_sent_C_sent | +2.74% |
| 2026-03-08 | CADCHF | LONG | SHORT | St_sent_C_sent | -1.93% |
| 2026-03-08 | GBPJPY | SHORT | LONG | St_sent_C_sent | +0.39% |
| 2026-03-08 | GBPUSD | SHORT | LONG | St_sent_C_sent | -2.07% |
| 2026-03-08 | USDCHF | LONG | SHORT | St_sent_C_sent | -3.61% |
| 2026-03-15 | EURCHF | LONG | SHORT | St_sent_C_sent | -4.07% |

## Decision Changes: weighted_W4

| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |
| --- | --- | --- | --- | --- | ---: |
| 2026-02-02 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.57% |
| 2026-02-02 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.11% |
| 2026-02-09 | CADCHF | SHORT | LONG | St_dealer_C_sent | -1.65% |
| 2026-02-09 | EURCAD | SHORT | LONG | St_sent_C_dealer | +0.20% |
| 2026-02-09 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.69% |
| 2026-02-09 | USDCHF | LONG | SHORT | St_sent_C_sent | +1.91% |
| 2026-02-16 | EURCAD | SHORT | LONG | St_sent_C_dealer | -1.40% |
| 2026-02-16 | GBPCAD | SHORT | LONG | St_sent_C_sent | -2.86% |
| 2026-02-16 | NZDUSD | SHORT | LONG | St_sent_C_sent | -1.98% |
| 2026-02-16 | USDCHF | LONG | SHORT | St_sent_C_sent | -2.56% |
| 2026-02-23 | CADCHF | LONG | SHORT | St_sent_C_sent | +1.73% |
| 2026-02-23 | CHFJPY | SHORT | LONG | St_sent_C_sent | +3.78% |
| 2026-02-23 | GBPNZD | LONG | SHORT | St_sent_C_dealer | +1.24% |
| 2026-02-23 | NZDCAD | SHORT | LONG | St_sent_C_sent | +0.28% |
| 2026-02-23 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.26% |
| 2026-02-23 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.85% |
| 2026-02-23 | USDCHF | LONG | SHORT | St_sent_C_sent | +2.11% |
| 2026-03-02 | AUDCAD | SHORT | LONG | St_sent_C_dealer | -2.70% |
| 2026-03-02 | ETHUSD | LONG | SHORT | St_sent_C_sent | +0.03% |
| 2026-03-02 | NZDCAD | SHORT | LONG | St_sent_C_sent | -5.17% |
| 2026-03-02 | USDJPY | SHORT | LONG | St_sent_C_sent | +2.74% |
| 2026-03-08 | CADCHF | LONG | SHORT | St_sent_C_sent | -1.93% |
| 2026-03-08 | GBPJPY | SHORT | LONG | St_sent_C_sent | +0.39% |
| 2026-03-08 | GBPUSD | SHORT | LONG | St_sent_C_sent | -2.07% |
| 2026-03-08 | USDCHF | LONG | SHORT | St_sent_C_sent | -3.61% |
| 2026-03-15 | EURCHF | LONG | SHORT | St_sent_C_sent | -4.07% |

## Decision Changes: strength_first

| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |
| --- | --- | --- | --- | --- | ---: |
| 2026-02-02 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.57% |
| 2026-02-02 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.11% |
| 2026-02-09 | CADCHF | SHORT | LONG | St_dealer_C_sent | -1.65% |
| 2026-02-09 | EURCAD | SHORT | LONG | St_sent_C_dealer | +0.20% |
| 2026-02-09 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.69% |
| 2026-02-09 | USDCHF | LONG | SHORT | St_sent_C_sent | +1.91% |
| 2026-02-16 | EURCAD | SHORT | LONG | St_sent_C_dealer | -1.40% |
| 2026-02-16 | GBPCAD | SHORT | LONG | St_sent_C_sent | -2.86% |
| 2026-02-16 | NZDUSD | SHORT | LONG | St_sent_C_sent | -1.98% |
| 2026-02-16 | USDCHF | LONG | SHORT | St_sent_C_sent | -2.56% |
| 2026-02-23 | CADCHF | LONG | SHORT | St_sent_C_sent | +1.73% |
| 2026-02-23 | CHFJPY | SHORT | LONG | St_sent_C_sent | +3.78% |
| 2026-02-23 | GBPNZD | LONG | SHORT | St_sent_C_dealer | +1.24% |
| 2026-02-23 | NZDCAD | SHORT | LONG | St_sent_C_sent | +0.28% |
| 2026-02-23 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.26% |
| 2026-02-23 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.85% |
| 2026-02-23 | USDCHF | LONG | SHORT | St_sent_C_sent | +2.11% |
| 2026-03-02 | AUDCAD | SHORT | LONG | St_sent_C_dealer | -2.70% |
| 2026-03-02 | ETHUSD | LONG | SHORT | St_sent_C_sent | +0.03% |
| 2026-03-02 | NZDCAD | SHORT | LONG | St_sent_C_sent | -5.17% |
| 2026-03-02 | USDJPY | SHORT | LONG | St_sent_C_sent | +2.74% |
| 2026-03-08 | CADCHF | LONG | SHORT | St_sent_C_sent | -1.93% |
| 2026-03-08 | GBPJPY | SHORT | LONG | St_sent_C_sent | +0.39% |
| 2026-03-08 | GBPUSD | SHORT | LONG | St_sent_C_sent | -2.07% |
| 2026-03-08 | USDCHF | LONG | SHORT | St_sent_C_sent | -3.61% |
| 2026-03-15 | EURCHF | LONG | SHORT | St_sent_C_sent | -4.07% |

## Decision Changes: dealer_bias_W1

| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |
| --- | --- | --- | --- | --- | ---: |
| 2026-02-02 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.57% |
| 2026-02-02 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.11% |
| 2026-02-09 | CADCHF | SHORT | LONG | St_dealer_C_sent | -1.65% |
| 2026-02-09 | EURCAD | SHORT | LONG | St_sent_C_dealer | +0.20% |
| 2026-02-09 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.69% |
| 2026-02-09 | USDCHF | LONG | SHORT | St_sent_C_sent | +1.91% |
| 2026-02-16 | EURCAD | SHORT | LONG | St_sent_C_dealer | -1.40% |
| 2026-02-16 | GBPCAD | SHORT | LONG | St_sent_C_sent | -2.86% |
| 2026-02-16 | NZDUSD | SHORT | LONG | St_sent_C_sent | -1.98% |
| 2026-02-16 | USDCHF | LONG | SHORT | St_sent_C_sent | -2.56% |
| 2026-02-23 | CADCHF | LONG | SHORT | St_sent_C_sent | +1.73% |
| 2026-02-23 | CHFJPY | SHORT | LONG | St_sent_C_sent | +3.78% |
| 2026-02-23 | GBPNZD | LONG | SHORT | St_sent_C_dealer | +1.24% |
| 2026-02-23 | NZDCAD | SHORT | LONG | St_sent_C_sent | +0.28% |
| 2026-02-23 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.26% |
| 2026-02-23 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.85% |
| 2026-02-23 | USDCHF | LONG | SHORT | St_sent_C_sent | +2.11% |
| 2026-03-02 | AUDCAD | SHORT | LONG | St_sent_C_dealer | -2.70% |
| 2026-03-02 | ETHUSD | LONG | SHORT | St_sent_C_sent | +0.03% |
| 2026-03-02 | NZDCAD | SHORT | LONG | St_sent_C_sent | -5.17% |
| 2026-03-02 | USDJPY | SHORT | LONG | St_sent_C_sent | +2.74% |
| 2026-03-08 | CADCHF | LONG | SHORT | St_sent_C_sent | -1.93% |
| 2026-03-08 | GBPJPY | SHORT | LONG | St_sent_C_sent | +0.39% |
| 2026-03-08 | GBPUSD | SHORT | LONG | St_sent_C_sent | -2.07% |
| 2026-03-08 | USDCHF | LONG | SHORT | St_sent_C_sent | -3.61% |
| 2026-03-15 | EURCHF | LONG | SHORT | St_sent_C_sent | -4.07% |

## Decision Changes: commercial_gate_W1

| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |
| --- | --- | --- | --- | --- | ---: |
| 2026-02-02 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.57% |
| 2026-02-02 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.11% |
| 2026-02-09 | CADCHF | SHORT | LONG | St_dealer_C_sent | -1.65% |
| 2026-02-09 | EURCAD | SHORT | LONG | St_sent_C_dealer | +0.20% |
| 2026-02-09 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.69% |
| 2026-02-09 | USDCHF | LONG | SHORT | St_sent_C_sent | +1.91% |
| 2026-02-16 | EURCAD | SHORT | LONG | St_sent_C_dealer | -1.40% |
| 2026-02-16 | GBPCAD | SHORT | LONG | St_sent_C_sent | -2.86% |
| 2026-02-16 | NZDUSD | SHORT | LONG | St_sent_C_sent | -1.98% |
| 2026-02-16 | USDCHF | LONG | SHORT | St_sent_C_sent | -2.56% |
| 2026-02-23 | CADCHF | LONG | SHORT | St_sent_C_sent | +1.73% |
| 2026-02-23 | CHFJPY | SHORT | LONG | St_sent_C_sent | +3.78% |
| 2026-02-23 | GBPNZD | LONG | SHORT | St_sent_C_dealer | +1.24% |
| 2026-02-23 | NZDCAD | SHORT | LONG | St_sent_C_sent | +0.28% |
| 2026-02-23 | NZDJPY | SHORT | LONG | St_sent_C_sent | +2.26% |
| 2026-02-23 | NZDUSD | SHORT | LONG | St_sent_C_sent | +0.85% |
| 2026-02-23 | USDCHF | LONG | SHORT | St_sent_C_sent | +2.11% |
| 2026-03-02 | AUDCAD | SHORT | LONG | St_sent_C_dealer | -2.70% |
| 2026-03-02 | ETHUSD | LONG | SHORT | St_sent_C_sent | +0.03% |
| 2026-03-02 | NZDCAD | SHORT | LONG | St_sent_C_sent | -5.17% |
| 2026-03-02 | USDJPY | SHORT | LONG | St_sent_C_sent | +2.74% |
| 2026-03-08 | CADCHF | LONG | SHORT | St_sent_C_sent | -1.93% |
| 2026-03-08 | GBPJPY | SHORT | LONG | St_sent_C_sent | +0.39% |
| 2026-03-08 | GBPUSD | SHORT | LONG | St_sent_C_sent | -2.07% |
| 2026-03-08 | USDCHF | LONG | SHORT | St_sent_C_sent | -3.61% |
| 2026-03-15 | EURCHF | LONG | SHORT | St_sent_C_sent | -4.07% |


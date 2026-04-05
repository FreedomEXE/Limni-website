# Strength Window Extension Research

Weeks analyzed: 10 (Jan 19 -> Mar 22).
Universe: 36 pairs × 10 weeks = 360 possible pair-weeks.

Windows tested:
- Current: 1h, 4h, 24h (normalized, threshold=5)
- New: 1w (prior week return sign), 1m (prior 4 weeks return sum sign)
- Raw-sign: raw pair % change sign (no normalization, no threshold)

## Window Data Availability

| Window | Pairs with Data | Total Possible | Coverage |
| --- | ---: | ---: | ---: |
| 1h | 357 | 360 | 99.2% |
| 4h | 357 | 360 | 99.2% |
| 24h | 357 | 360 | 99.2% |
| 1w | 324 | 360 | 90.0% |
| 1m | 324 | 360 | 90.0% |

## Branch A: Current Baseline

### A1: Current T1

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 270 | +82.84% | 19.82% | 56.3% | 3 | 270/280 |
| indices | 16 | +0.90% | 4.54% | 56.3% | 5 | 16/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 29 | +0.01% | 11.57% | 44.8% | 4 | 29/30 |
| combined | 335 | +80.89% | 14.98% | 54.6% | 4 | 335/360 |

### A2: Current TA

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +77.68% | 20.22% | 55.7% | 2 | 280/280 |
| indices | 21 | +1.04% | 4.60% | 57.1% | 4 | 21/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 351 | +78.72% | 15.09% | 54.4% | 3 | 351/360 |

## Branch B: Hybrid

### B1: Hybrid +1w

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 256 | +86.83% | 17.59% | 57.4% | 2 | 256/280 |
| indices | 26 | +0.85% | 5.48% | 57.7% | 4 | 26/30 |
| crypto | 14 | +1.97% | 1.93% | 50.0% | 4 | 14/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 326 | +92.50% | 9.26% | 56.1% | 2 | 326/360 |

### B2: Hybrid +1m

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 260 | +91.37% | 16.81% | 58.5% | 2 | 260/280 |
| indices | 26 | +0.10% | 6.22% | 53.8% | 4 | 26/30 |
| crypto | 15 | +0.05% | 3.81% | 46.7% | 5 | 15/20 |
| commodities | 28 | +1.47% | 11.82% | 42.9% | 5 | 28/30 |
| combined | 329 | +92.99% | 11.79% | 56.2% | 2 | 329/360 |

### B3: Hybrid +1w+1m

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 268 | +92.73% | 17.83% | 58.2% | 2 | 268/280 |
| indices | 25 | -0.30% | 5.85% | 56.0% | 4 | 25/30 |
| crypto | 20 | +2.95% | 6.85% | 50.0% | 5 | 20/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 343 | +98.25% | 10.20% | 56.6% | 2 | 343/360 |

### B4: Hybrid +1w+1m+res

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +92.80% | 17.79% | 57.9% | 2 | 280/280 |
| indices | 27 | -1.44% | 6.22% | 51.9% | 4 | 27/30 |
| crypto | 20 | +2.95% | 6.85% | 50.0% | 5 | 20/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 357 | +97.16% | 10.15% | 56.0% | 2 | 357/360 |

## Branch C: Full Raw-Sign

### C1: Raw 3w

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +75.10% | 20.08% | 55.4% | 3 | 280/280 |
| indices | 15 | -0.20% | 2.01% | 46.7% | 4 | 15/30 |
| crypto | 20 | -6.92% | 13.11% | 40.0% | 6 | 20/20 |
| commodities | 30 | +15.90% | 11.30% | 53.3% | 3 | 30/30 |
| combined | 345 | +83.88% | 19.17% | 53.9% | 5 | 345/360 |

### C2: Raw 4w +1w

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 251 | +80.56% | 18.41% | 57.4% | 2 | 251/280 |
| indices | 27 | -2.84% | 5.48% | 48.1% | 6 | 27/30 |
| crypto | 15 | -5.48% | 11.67% | 46.7% | 4 | 15/20 |
| commodities | 28 | +17.28% | 9.92% | 57.1% | 3 | 28/30 |
| combined | 321 | +89.52% | 18.88% | 56.1% | 5 | 321/360 |

### C3: Raw 5w

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +89.95% | 20.48% | 58.6% | 2 | 280/280 |
| indices | 21 | -1.68% | 4.60% | 47.6% | 6 | 21/30 |
| crypto | 20 | -4.03% | 10.23% | 55.0% | 4 | 20/20 |
| commodities | 30 | +15.90% | 11.30% | 53.3% | 3 | 30/30 |
| combined | 351 | +100.14% | 19.19% | 57.3% | 4 | 351/360 |

### C4: Raw 24h+1w+1m

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +58.34% | 18.56% | 56.8% | 4 | 280/280 |
| indices | 27 | +2.71% | 3.72% | 51.9% | 3 | 27/30 |
| crypto | 20 | +11.23% | 8.17% | 65.0% | 4 | 20/20 |
| commodities | 30 | +24.23% | 3.61% | 46.7% | 5 | 30/30 |
| combined | 357 | +96.51% | 23.68% | 56.0% | 4 | 357/360 |

### C5: Raw 5w + res

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +89.95% | 20.48% | 58.6% | 2 | 280/280 |
| indices | 27 | -2.32% | 3.72% | 44.4% | 5 | 27/30 |
| crypto | 20 | -4.03% | 10.23% | 55.0% | 4 | 20/20 |
| commodities | 30 | +15.90% | 11.30% | 53.3% | 3 | 30/30 |
| combined | 357 | +99.49% | 19.19% | 56.9% | 4 | 357/360 |

## Summary

| Method | Branch | Windows | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A1: Current T1 | Baseline | 3w norm | 335 | +80.89% | 14.98% | 54.6% | 4 | 335/360 |
| A2: Current TA | Baseline | 3w norm+res | 351 | +78.72% | 15.09% | 54.4% | 3 | 351/360 |
| B1: Hybrid +1w | Hybrid | 4w | 326 | +92.50% | 9.26% | 56.1% | 2 | 326/360 |
| B2: Hybrid +1m | Hybrid | 4w | 329 | +92.99% | 11.79% | 56.2% | 2 | 329/360 |
| B3: Hybrid +1w+1m | Hybrid | 5w | 343 | +98.25% | 10.20% | 56.6% | 2 | 343/360 |
| B4: Hybrid +1w+1m+res | Hybrid | 5w+res | 357 | +97.16% | 10.15% | 56.0% | 2 | 357/360 |
| C1: Raw 3w | Full raw | 3w raw | 345 | +83.88% | 19.17% | 53.9% | 5 | 345/360 |
| C2: Raw 4w +1w | Full raw | 4w raw | 321 | +89.52% | 18.88% | 56.1% | 5 | 321/360 |
| C3: Raw 5w | Full raw | 5w raw | 351 | +100.14% | 19.19% | 57.3% | 4 | 351/360 |
| C4: Raw 24h+1w+1m | Full raw | 3w long | 357 | +96.51% | 23.68% | 56.0% | 4 | 357/360 |
| C5: Raw 5w + res | Full raw | 5w raw+res | 357 | +99.49% | 19.19% | 56.9% | 4 | 357/360 |

## Crypto Anti-Correlation Diagnostic

| Method | Opposite BTC/ETH | Same Direction | Unresolved |
| --- | ---: | ---: | ---: |
| A1: Current T1 | 10 | 0 | 0 |
| A2: Current TA | 10 | 0 | 0 |
| B1: Hybrid +1w | 5 | 0 | 5 |
| B2: Hybrid +1m | 5 | 0 | 5 |
| B3: Hybrid +1w+1m | 5 | 5 | 0 |
| B4: Hybrid +1w+1m+res | 5 | 5 | 0 |
| C1: Raw 3w | 3 | 7 | 0 |
| C2: Raw 4w +1w | 0 | 6 | 4 |
| C3: Raw 5w | 0 | 10 | 0 |
| C4: Raw 24h+1w+1m | 0 | 10 | 0 |
| C5: Raw 5w + res | 0 | 10 | 0 |

## Unresolved B4: Hybrid +1w+1m+res

Count: 3

| Week | Asset Class | Pair | 1h | 4h | 24h | 1w | 1m | Composite |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Jan 19 | indices | SPXUSD | NA | NA | NA | NA | NA | NEUTRAL |
| Jan 19 | indices | NDXUSD | NA | NA | NA | NA | NA | NEUTRAL |
| Jan 19 | indices | NIKKEIUSD | NA | NA | NA | NA | NA | NEUTRAL |

## Per-Asset-Class Rankings

### FX (best by Total%)
1. B4: Hybrid +1w+1m+res: 280, +92.80%, 17.79% DD, 57.9% WR
2. B3: Hybrid +1w+1m: 268, +92.73%, 17.83% DD, 58.2% WR
3. B2: Hybrid +1m: 260, +91.37%, 16.81% DD, 58.5% WR

### INDICES (best by Total%)
1. C4: Raw 24h+1w+1m: 27, +2.71%, 3.72% DD, 51.9% WR
2. A2: Current TA: 21, +1.04%, 4.60% DD, 57.1% WR
3. A1: Current T1: 16, +0.90%, 4.54% DD, 56.3% WR

### CRYPTO (best by Total%)
1. C4: Raw 24h+1w+1m: 20, +11.23%, 8.17% DD, 65.0% WR
2. B3: Hybrid +1w+1m: 20, +2.95%, 6.85% DD, 50.0% WR
3. B4: Hybrid +1w+1m+res: 20, +2.95%, 6.85% DD, 50.0% WR

### COMMODITIES (best by Total%)
1. C4: Raw 24h+1w+1m: 30, +24.23%, 3.61% DD, 46.7% WR
2. C2: Raw 4w +1w: 28, +17.28%, 9.92% DD, 57.1% WR
3. C1: Raw 3w: 30, +15.90%, 11.30% DD, 53.3% WR

### COMBINED (best by Total%)
1. C3: Raw 5w: 351, +100.14%, 19.19% DD, 57.3% WR
2. C5: Raw 5w + res: 357, +99.49%, 19.19% DD, 56.9% WR
3. B3: Hybrid +1w+1m: 343, +98.25%, 10.20% DD, 56.6% WR


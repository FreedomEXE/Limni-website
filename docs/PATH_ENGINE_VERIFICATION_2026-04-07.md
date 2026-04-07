# Path Engine Verification

- Resolution: `1h`
- Weeks analyzed: 10 (2026-01-19 -> 2026-03-22)
- Verified on: 2026-04-07T07:18:25.267Z

## Return Comparison

| Strategy | Weekly-Close Total% | Path-Engine Total% | Difference | Status |
| --- | ---: | ---: | ---: | --- |
| Dealer Raw | +96.51% | +96.51% | +0.00% | PASS |
| Selector Frag3 | +100.39% | +100.39% | +0.00% | PASS |
| Agreement | +98.14% | +98.14% | -0.00% | PASS |

PASS = absolute difference <= 0.50 percentage points.

## New Path Metrics

| Strategy | Total% | Peak% | Max DD% | Giveback% | Recovery% | Max Active |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Dealer Raw | +96.51% | +102.01% | 19.82% | 5.51% | 96.51% | 36 |
| Selector Frag3 | +100.39% | +102.31% | 27.07% | 1.92% | 100.94% | 36 |
| Agreement | +98.14% | +128.60% | 38.39% | 30.47% | 98.14% | 31 |

## Weekly-Close vs Path DD

| Strategy | Weekly-Close Max DD% | Path Max DD% | Delta |
| --- | ---: | ---: | ---: |
| Dealer Raw | 0.00% | 19.82% | 19.82% |
| Selector Frag3 | -4.01% | 27.07% | 31.08% |
| Agreement | -17.42% | 38.39% | 55.81% |

## Data Coverage

| Strategy | Weeks | Total Legs | Legs With H1 Bars | Missing Bar Symbols |
| --- | ---: | ---: | ---: | --- |
| Dealer Raw | 10 | 360 | 360 | — |
| Selector Frag3 | 10 | 345 | 345 | — |
| Agreement | 10 | 268 | 268 | — |

## Per-Week Path Detail (Dealer Raw)

| Week | Weekly-Close% | Path-Engine% | Peak% | Max DD% | H1 Bars | Active Legs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-03-22 | +1.92% | +1.92% | +1.95% | 11.39% | 4386 | 36 |
| 2026-03-15 | +3.35% | +3.35% | +9.31% | 16.88% | 4386 | 36 |
| 2026-03-08 | +2.68% | +2.68% | +13.45% | 10.78% | 4386 | 36 |
| 2026-03-02 | +11.62% | +11.62% | +17.47% | 17.43% | 4420 | 36 |
| 2026-02-23 | +2.55% | +2.55% | +6.01% | 11.40% | 4386 | 36 |
| 2026-02-16 | +18.39% | +18.39% | +18.57% | 3.67% | 4368 | 36 |
| 2026-02-09 | +1.93% | +1.93% | +18.33% | 17.28% | 4386 | 36 |
| 2026-02-02 | +9.82% | +9.82% | +11.73% | 5.16% | 4386 | 36 |
| 2026-01-26 | +7.74% | +7.74% | +14.70% | 16.57% | 4386 | 36 |
| 2026-01-19 | +36.51% | +36.51% | +51.56% | 18.70% | 4368 | 36 |


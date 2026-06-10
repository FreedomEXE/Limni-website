# ADR Grid Weekly Anchor A/B

Date: 2026-06-02

## Purpose

Compare the current production ADR Grid anchor against canonical market-week anchor variants.

Baseline:
- Legacy execution-anchor ADR Grid. This was the current app behavior before adopting the canonical weekly anchor.
- Grid levels anchored to execution open.
- Fills gated by the execution window.
- No weekly-open centerline level.

Candidates:
- Weekly market anchor: all grid levels anchored to canonical market weekly open.
- Weekly anchor + center: weekly market anchor plus a tradable weekly-open centerline level.
- Execution anchor + weekly center: current execution-anchored grid plus a standalone tradable weekly-open centerline level.

Centerline rules:
- Centerline fills are gated by the execution window.
- Centerline uses the same 0.20 ADR target as other ADR Grid fills.
- Centerline rearms after close like other levels.
- Centerline fills count against Pair Fill Cap.

Command:

```bash
npx tsx scripts/adr-grid-weekly-anchor-ab.ts
```

Weeks:
- 19 realized weeks.
- 2026-01-19T00:00:00.000Z through 2026-05-24T23:00:00.000Z.

## Tandem

### Pair Fill Cap ON

| Variant | Return | Path DD | Return/DD | Trades | TP | Reset | Week Close |
|---|---:|---:|---:|---:|---:|---:|---:|
| Legacy execution anchor | +632.67% | 6.26% | 101.10 | 27,529 | 22,224 | 4,235 | 1,070 |
| Weekly market anchor | +877.42% | 5.82% | 150.77 | 32,710 | 27,229 | 4,454 | 1,027 |
| Weekly anchor + center | +881.86% | 7.45% | 118.37 | 33,883 | 28,183 | 4,686 | 1,014 |
| Execution anchor + weekly center | +633.35% | 8.02% | 78.98 | 28,749 | 23,193 | 4,473 | 1,083 |

Delta vs current app:
- Weekly market anchor: +244.75% return, -0.44 DD points, +5,181 trades.
- Weekly anchor + center: +249.19% return, +1.19 DD points, +6,354 trades.
- Execution anchor + weekly center: +0.67% return, +1.76 DD points, +1,220 trades.

### No Pair Fill Cap

| Variant | Return | Path DD | Return/DD | Trades | TP | Reset | Week Close |
|---|---:|---:|---:|---:|---:|---:|---:|
| Legacy execution anchor | +694.73% | 25.12% | 27.66 | 39,626 | 30,727 | 6,465 | 2,434 |
| Weekly market anchor | +942.20% | 24.68% | 38.18 | 44,996 | 35,917 | 6,761 | 2,318 |
| Weekly anchor + center | +968.43% | 25.26% | 38.34 | 48,932 | 39,079 | 7,315 | 2,538 |
| Execution anchor + weekly center | +715.89% | 25.79% | 27.75 | 43,668 | 33,910 | 7,075 | 2,683 |

Delta vs current app:
- Weekly market anchor: +247.47% return, -0.44 DD points, +5,370 trades.
- Weekly anchor + center: +273.70% return, +0.14 DD points, +9,306 trades.
- Execution anchor + weekly center: +21.17% return, +0.68 DD points, +4,042 trades.

## Tiered

### Pair Fill Cap ON

| Variant | Return | Path DD | Return/DD | Trades | TP | Reset | Week Close |
|---|---:|---:|---:|---:|---:|---:|---:|
| Legacy execution anchor | +104.77% | 2.33% | 45.00 | 3,667 | 2,998 | 559 | 110 |
| Weekly market anchor | +154.68% | 2.16% | 71.45 | 4,738 | 4,041 | 592 | 105 |
| Weekly anchor + center | +154.46% | 2.57% | 60.04 | 4,857 | 4,133 | 624 | 100 |
| Execution anchor + weekly center | +103.23% | 2.80% | 36.85 | 3,763 | 3,066 | 589 | 108 |

Delta vs current app:
- Weekly market anchor: +49.90% return, -0.16 DD points, +1,071 trades.
- Weekly anchor + center: +49.68% return, +0.24 DD points, +1,190 trades.
- Execution anchor + weekly center: -1.54% return, +0.47 DD points, +96 trades.

### No Pair Fill Cap

| Variant | Return | Path DD | Return/DD | Trades | TP | Reset | Week Close |
|---|---:|---:|---:|---:|---:|---:|---:|
| Legacy execution anchor | +128.42% | 5.47% | 23.48 | 5,036 | 3,992 | 819 | 225 |
| Weekly market anchor | +172.63% | 5.24% | 32.97 | 6,088 | 5,010 | 865 | 213 |
| Weekly anchor + center | +176.34% | 5.69% | 31.00 | 6,527 | 5,363 | 934 | 230 |
| Execution anchor + weekly center | +131.92% | 5.97% | 22.12 | 5,486 | 4,350 | 892 | 244 |

Delta vs current app:
- Weekly market anchor: +44.21% return, -0.23 DD points, +1,052 trades.
- Weekly anchor + center: +47.92% return, +0.22 DD points, +1,491 trades.
- Execution anchor + weekly center: +3.51% return, +0.50 DD points, +450 trades.

## Read

Selected canon: [ADR Grid Canonical Weekly Anchor](../trading/ADR_GRID_CANONICAL_WEEKLY_ANCHOR.md)

Release verification:
- After the app patch, `Current app` matches `Weekly market anchor` exactly in the A/B harness.
- Tandem Pair Fill Cap ON: +877.42%, 5.82% path DD, 32,710 trades.
- Tandem No Pair Fill Cap: +942.20%, 24.68% path DD, 44,996 trades.
- Tiered Pair Fill Cap ON: +154.68%, 2.16% path DD, 4,738 trades.
- Tiered No Pair Fill Cap: +172.63%, 5.24% path DD, 6,088 trades.

The centerline test separates two ideas:
- Using the canonical weekly open as the grid anchor.
- Making the weekly-open level itself executable.

The anchor change is still the main result. Weekly market anchoring materially improved Tandem and Tiered with and without Pair Fill Cap, while slightly reducing path drawdown.

The weekly-open centerline level is not a clean win:
- Added to the weekly-anchored grid, it sometimes adds return but also adds drawdown and more churn.
- Added as a standalone level to the current execution-anchored grid, it has weak return impact and consistently raises drawdown in this sample.

Recommendation from this run:
- Treat canonical weekly market anchor as the professional/default grid map candidate.
- Do not bundle the tradable centerline into that migration.
- If centerline is pursued, version it as a separate exposure rule and test it across more market windows.

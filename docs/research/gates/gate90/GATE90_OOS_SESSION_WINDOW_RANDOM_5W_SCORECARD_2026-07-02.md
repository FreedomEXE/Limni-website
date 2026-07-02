# Gate 90B Random OOS Session-Window Scorecard

Generated: 2026-07-02

## Scope

- Purpose: random out-of-sample validation of the Gate 90 ADR-event signal clock under the fixed NY daily session-window execution surface.
- Execution surface: M1/OHLC execution tape, ADR-event signal clock, David MA reversion TP, spacing 0.20 ADR, min MA expansion 0.10 ADR, adverse-only adds, RSI50 60/40, Stoch 100/3/100 60/40 as state filter.
- Session controls: trade 18:05-15:45 America/New_York, flatten 16:00, Sunday start 20:00.
- Rules: raw_both, david_contra, candidate_b, stoch_contra, david_stoch_confirm.
- Cells: ADR 0.025/MA25, ADR 0.05/MA25, ADR 0.075/MA25, ADR 0.10/MA50.
- Receipt check: 16 run summaries selected exactly 5 weeks each.

## Window Receipts

| Window | Requested guard | Selected range |
| --- | --- | --- |
| OOS1 | 2025-12-28..2026-01-31 max 5 | 2025-12-29T00:00:00.000Z..2026-01-26T00:00:00.000Z |
| OOS2 | 2023-11-12..2023-12-16 max 5 | 2023-11-13T00:00:00.000Z..2023-12-11T00:00:00.000Z |
| OOS3 | 2024-06-30..2024-08-03 max 5 | 2024-06-30T23:00:00.000Z..2024-07-28T23:00:00.000Z |
| OOS4 | 2022-01-09..2022-02-12 max 5 | 2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z |

## Aggregate Verdict

- OOS remained profitable across the full random sample for the main cells, but the smaller bricks still carry high event count and fee sensitivity.
- Raw both stayed the strongest gross benchmark and remains a risk benchmark, not a promotion candidate.
- David contra stayed viable across all four ADR-event cells; ADR 0.10 / MA50 is cleaner operationally but lower net than the smallest brick.
- Candidate B did better than expected in this random OOS sample, especially from ADR 0.05 upward; do not promote it from this sample alone, but move it from low-faith idea to controlled overlay follow-up.
- Session controls removed terminal inventory in these runs, but did not eliminate swap or multi-day max fill age. That needs a lifecycle audit before treating daily flatten as solved.

## David Contra By Cell

| Cell | Net | Avg Return | Event PF | Weekly PF | Win Windows | Min Window | Worst Week | Net/Worst Week | Max Open | Entries | Swap | Max Age |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ADR 0.025 / MA25 | $6,502.27 | 16.26% | 2.308 | 79.617 | 4/4 | $916.50 | -$82.71 | 78.62 | 80 | 31566 | -$101.61 | 3.07 |
| ADR 0.05 / MA25 | $4,655.75 | 11.64% | 1.730 | 8.939 | 4/4 | $781.66 | -$383.32 | 12.15 | 84 | 24015 | -$129.45 | 3.08 |
| ADR 0.075 / MA25 | $3,038.49 | 7.60% | 1.376 | 3.885 | 4/4 | $486.44 | -$628.02 | 4.84 | 93 | 20155 | -$150.26 | 3.08 |
| ADR 0.10 / MA50 | $1,702.32 | 4.26% | 1.187 | 2.317 | 4/4 | $317.32 | -$744.44 | 2.29 | 113 | 14375 | -$173.69 | 3.08 |

## Top Aggregate Rows

| Rank | Cell | Rule | Net | Avg Return | Event PF | Weekly PF | Win Windows | Min Window | Max Open | Entries | Swap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ADR 0.025 / MA25 | raw_both | $12,187.28 | 30.47% | 2.475 | inf | 4/4 | $2,227.17 | 105 | 56343 | -$164.22 |
| 2 | ADR 0.05 / MA25 | raw_both | $9,572.42 | 23.93% | 1.850 | 72.706 | 4/4 | $1,523.73 | 116 | 45584 | -$217.90 |
| 3 | ADR 0.075 / MA25 | raw_both | $8,157.07 | 20.39% | 1.629 | 12.280 | 4/4 | $1,129.87 | 128 | 38579 | -$252.46 |
| 4 | ADR 0.025 / MA25 | david_contra | $6,502.27 | 16.26% | 2.308 | 79.617 | 4/4 | $916.50 | 80 | 31566 | -$101.61 |
| 5 | ADR 0.025 / MA25 | candidate_b | $6,355.83 | 15.89% | 2.980 | inf | 4/4 | $1,112.74 | 41 | 27512 | -$54.30 |
| 6 | ADR 0.10 / MA50 | raw_both | $6,015.94 | 15.04% | 1.417 | 7.564 | 4/4 | $858.60 | 153 | 26801 | -$313.33 |
| 7 | ADR 0.05 / MA25 | candidate_b | $5,885.10 | 14.71% | 2.405 | 45.244 | 4/4 | $848.68 | 67 | 22366 | -$79.75 |
| 8 | ADR 0.075 / MA25 | candidate_b | $5,651.57 | 14.13% | 2.190 | 35.814 | 4/4 | $680.59 | 73 | 18792 | -$92.72 |
| 9 | ADR 0.025 / MA25 | stoch_contra | $4,792.44 | 11.98% | 2.351 | 24.198 | 4/4 | $518.66 | 73 | 23020 | -$70.06 |
| 10 | ADR 0.10 / MA50 | candidate_b | $4,767.23 | 11.92% | 1.879 | 17.680 | 4/4 | $521.48 | 84 | 12943 | -$121.00 |
| 11 | ADR 0.05 / MA25 | david_contra | $4,655.75 | 11.64% | 1.730 | 8.939 | 4/4 | $781.66 | 84 | 24015 | -$129.45 |
| 12 | ADR 0.025 / MA25 | david_stoch_confirm | $4,205.81 | 10.51% | 2.364 | 16.400 | 4/4 | $432.67 | 70 | 20256 | -$64.34 |

## Full Aggregate Table

| Cell | Rule | Net | Avg Return | Event PF | Weekly PF | Event Win | Win Windows | Min Window | Worst Week | Net/Worst Week | Max Eq DD | Net/Eq DD | Max Open | Entries | Terminal | Swap | Flatten Net |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ADR 0.025 / MA25 | raw_both | $12,187.28 | 30.47% | 2.475 | inf | 84.08% | 4/4 | $2,227.17 | $217.77 | inf | $0.00 | inf | 105 | 56343 | 0 | -$164.22 | -$7,616.15 |
| ADR 0.025 / MA25 | david_contra | $6,502.27 | 16.26% | 2.308 | 79.617 | 83.62% | 4/4 | $916.50 | -$82.71 | 78.62 | $82.71 | 78.62 | 80 | 31566 | 0 | -$101.61 | -$4,536.07 |
| ADR 0.025 / MA25 | candidate_b | $6,355.83 | 15.89% | 2.980 | inf | 84.11% | 4/4 | $1,112.74 | $75.57 | inf | $0.00 | inf | 41 | 27512 | 0 | -$54.30 | -$2,877.01 |
| ADR 0.025 / MA25 | stoch_contra | $4,792.44 | 11.98% | 2.351 | 24.198 | 83.89% | 4/4 | $518.66 | -$168.33 | 28.47 | $168.33 | 28.47 | 73 | 23020 | 0 | -$70.06 | -$3,212.18 |
| ADR 0.025 / MA25 | david_stoch_confirm | $4,205.81 | 10.51% | 2.364 | 16.400 | 83.80% | 4/4 | $432.67 | -$178.93 | 23.51 | $178.93 | 23.51 | 70 | 20256 | 0 | -$64.34 | -$2,769.53 |
| ADR 0.05 / MA25 | raw_both | $9,572.42 | 23.93% | 1.850 | 72.706 | 88.16% | 4/4 | $1,523.73 | -$133.50 | 71.71 | $133.50 | 71.70 | 116 | 45584 | 0 | -$217.90 | -$10,566.84 |
| ADR 0.05 / MA25 | david_contra | $4,655.75 | 11.64% | 1.730 | 8.939 | 88.32% | 4/4 | $781.66 | -$383.32 | 12.15 | $383.32 | 12.15 | 84 | 24015 | 0 | -$129.45 | -$6,034.34 |
| ADR 0.05 / MA25 | candidate_b | $5,885.10 | 14.71% | 2.405 | 45.244 | 88.68% | 4/4 | $848.68 | -$133.01 | 44.24 | $133.01 | 44.25 | 67 | 22366 | 0 | -$79.75 | -$3,828.37 |
| ADR 0.05 / MA25 | stoch_contra | $3,719.42 | 9.30% | 1.872 | 11.796 | 88.29% | 4/4 | $715.28 | -$329.42 | 11.29 | $329.42 | 11.29 | 69 | 17527 | 0 | -$90.91 | -$4,041.44 |
| ADR 0.05 / MA25 | david_stoch_confirm | $3,028.64 | 7.57% | 1.824 | 9.691 | 88.26% | 4/4 | $540.22 | -$348.49 | 8.69 | $348.49 | 8.69 | 68 | 14570 | 0 | -$81.33 | -$3,488.53 |
| ADR 0.075 / MA25 | raw_both | $8,157.07 | 20.39% | 1.629 | 12.280 | 89.36% | 4/4 | $1,129.87 | -$420.59 | 19.39 | $420.59 | 19.39 | 128 | 38579 | 0 | -$252.46 | -$12,179.78 |
| ADR 0.075 / MA25 | david_contra | $3,038.49 | 7.60% | 1.376 | 3.885 | 88.89% | 4/4 | $486.44 | -$628.02 | 4.84 | $785.34 | 3.87 | 93 | 20155 | 0 | -$150.26 | -$7,553.54 |
| ADR 0.075 / MA25 | candidate_b | $5,651.57 | 14.13% | 2.190 | 35.814 | 89.72% | 4/4 | $680.59 | -$143.99 | 39.25 | $143.99 | 39.25 | 73 | 18792 | 0 | -$92.72 | -$4,294.93 |
| ADR 0.075 / MA25 | stoch_contra | $2,082.64 | 5.21% | 1.389 | 5.185 | 89.40% | 4/4 | $68.15 | -$410.46 | 5.07 | $497.67 | 4.19 | 84 | 13582 | 0 | -$98.03 | -$4,980.89 |
| ADR 0.075 / MA25 | david_stoch_confirm | $1,288.48 | 3.22% | 1.276 | 3.201 | 89.03% | 3/4 | -$170.72 | -$445.94 | 2.89 | $573.30 | 2.25 | 84 | 10911 | 0 | -$83.23 | -$4,317.10 |
| ADR 0.10 / MA50 | raw_both | $6,015.94 | 15.04% | 1.417 | 7.564 | 87.60% | 4/4 | $858.60 | -$548.11 | 10.98 | $648.05 | 9.28 | 153 | 26801 | 0 | -$313.33 | -$13,432.59 |
| ADR 0.10 / MA50 | david_contra | $1,702.32 | 4.26% | 1.187 | 2.317 | 86.68% | 4/4 | $317.32 | -$744.44 | 2.29 | $968.76 | 1.76 | 113 | 14375 | 0 | -$173.69 | -$8,395.69 |
| ADR 0.10 / MA50 | candidate_b | $4,767.23 | 11.92% | 1.879 | 17.680 | 87.75% | 4/4 | $521.48 | -$171.93 | 27.73 | $241.42 | 19.75 | 84 | 12943 | 0 | -$121.00 | -$4,833.71 |
| ADR 0.10 / MA50 | stoch_contra | $945.09 | 2.36% | 1.148 | 2.341 | 86.40% | 3/4 | -$121.71 | -$441.19 | 2.14 | $600.46 | 1.57 | 93 | 9245 | 0 | -$129.12 | -$5,856.09 |
| ADR 0.10 / MA50 | david_stoch_confirm | $858.34 | 2.15% | 1.166 | 2.268 | 86.47% | 3/4 | -$215.81 | -$438.18 | 1.96 | $677.06 | 1.27 | 87 | 7406 | 0 | -$98.05 | -$4,697.74 |

## David Contra Window Detail

| Window | Range | Cell | Net | Return | Event PF | Weekly PF | Event Win | Worst Week | Max Eq DD | Max Open | Entries | Swap | Flatten Net | Max Age |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OOS1 | 2025-12-29T00:00:00.000Z..2026-01-26T00:00:00.000Z | ADR 0.025 / MA25 | $1,350.02 | 13.50% | 2.108 | inf | 83.57% | $199.42 | $0.00 | 35 | 8228 | -$20.17 | -$1,039.54 | 3.02 |
| OOS1 | 2025-12-29T00:00:00.000Z..2026-01-26T00:00:00.000Z | ADR 0.05 / MA25 | $1,017.13 | 10.17% | 1.663 | inf | 88.53% | $149.33 | $0.00 | 37 | 6314 | -$27.02 | -$1,376.45 | 2.59 |
| OOS1 | 2025-12-29T00:00:00.000Z..2026-01-26T00:00:00.000Z | ADR 0.075 / MA25 | $868.58 | 8.69% | 1.478 | inf | 90.15% | $76.80 | $0.00 | 54 | 5286 | -$29.31 | -$1,531.18 | 3.04 |
| OOS1 | 2025-12-29T00:00:00.000Z..2026-01-26T00:00:00.000Z | ADR 0.10 / MA50 | $427.19 | 4.27% | 1.195 | 4.776 | 87.37% | -$113.13 | $113.13 | 67 | 3694 | -$31.40 | -$1,814.08 | 3.08 |
| OOS2 | 2023-11-13T00:00:00.000Z..2023-12-11T00:00:00.000Z | ADR 0.025 / MA25 | $916.50 | 9.16% | 1.551 | 12.081 | 82.90% | -$82.71 | $82.71 | 80 | 7401 | -$33.36 | -$1,586.08 | 2.94 |
| OOS2 | 2023-11-13T00:00:00.000Z..2023-12-11T00:00:00.000Z | ADR 0.05 / MA25 | $781.66 | 7.82% | 1.436 | 4.894 | 88.40% | -$123.52 | $123.52 | 78 | 5583 | -$39.29 | -$1,732.72 | 3.04 |
| OOS2 | 2023-11-13T00:00:00.000Z..2023-12-11T00:00:00.000Z | ADR 0.075 / MA25 | $486.44 | 4.86% | 1.238 | 3.124 | 88.56% | -$229.01 | $229.01 | 90 | 4692 | -$40.22 | -$1,991.43 | 3.08 |
| OOS2 | 2023-11-13T00:00:00.000Z..2023-12-11T00:00:00.000Z | ADR 0.10 / MA50 | $628.09 | 6.28% | 1.330 | 35.986 | 86.35% | -$17.95 | $17.95 | 96 | 3371 | -$51.85 | -$1,823.46 | 3.08 |
| OOS3 | 2024-06-30T23:00:00.000Z..2024-07-28T23:00:00.000Z | ADR 0.025 / MA25 | $2,884.12 | 28.84% | 3.847 | inf | 84.02% | $71.85 | $0.00 | 65 | 8781 | -$21.40 | -$934.17 | 2.70 |
| OOS3 | 2024-06-30T23:00:00.000Z..2024-07-28T23:00:00.000Z | ADR 0.05 / MA25 | $1,784.04 | 17.84% | 1.962 | 5.654 | 87.26% | -$383.32 | $383.32 | 84 | 6820 | -$31.01 | -$1,793.07 | 2.54 |
| OOS3 | 2024-06-30T23:00:00.000Z..2024-07-28T23:00:00.000Z | ADR 0.075 / MA25 | $902.61 | 9.03% | 1.325 | 2.149 | 87.98% | -$628.02 | $785.34 | 93 | 5835 | -$44.39 | -$2,666.93 | 2.70 |
| OOS3 | 2024-06-30T23:00:00.000Z..2024-07-28T23:00:00.000Z | ADR 0.10 / MA50 | $317.32 | 3.17% | 1.095 | 1.328 | 86.25% | -$744.44 | $968.76 | 113 | 4384 | -$48.40 | -$3,192.16 | 3.08 |
| OOS4 | 2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z | ADR 0.025 / MA25 | $1,351.63 | 13.52% | 2.254 | inf | 83.91% | $87.45 | $0.00 | 47 | 7156 | -$26.68 | -$976.28 | 3.07 |
| OOS4 | 2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z | ADR 0.05 / MA25 | $1,072.92 | 10.73% | 1.895 | 455.992 | 89.23% | -$2.36 | $2.36 | 64 | 5298 | -$32.13 | -$1,132.10 | 3.08 |
| OOS4 | 2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z | ADR 0.075 / MA25 | $780.86 | 7.81% | 1.545 | 21.010 | 88.77% | -$39.02 | $39.02 | 76 | 4342 | -$36.34 | -$1,364.00 | 3.08 |
| OOS4 | 2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z | ADR 0.10 / MA50 | $329.72 | 3.30% | 1.198 | 2.714 | 86.74% | -$180.03 | $180.03 | 83 | 2926 | -$42.04 | -$1,565.99 | 3.08 |

## Raw Both Benchmark Window Detail

| Window | Cell | Net | Event PF | Weekly PF | Max Open | Entries | Swap | Flatten Net | Max Age |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OOS1 | ADR 0.025 / MA25 | $2,412.75 | 2.155 | inf | 53 | 14968 | -$38.86 | -$1,846.59 | 3.04 |
| OOS1 | ADR 0.05 / MA25 | $2,145.49 | 1.809 | inf | 72 | 12135 | -$48.84 | -$2,324.15 | 3.07 |
| OOS1 | ADR 0.075 / MA25 | $2,129.97 | 1.740 | inf | 85 | 10243 | -$54.86 | -$2,462.13 | 3.04 |
| OOS1 | ADR 0.10 / MA50 | $1,687.92 | 1.517 | inf | 83 | 7073 | -$64.79 | -$2,763.74 | 3.08 |
| OOS2 | ADR 0.025 / MA25 | $2,227.17 | 1.883 | inf | 105 | 13173 | -$49.55 | -$2,390.95 | 2.94 |
| OOS2 | ADR 0.05 / MA25 | $1,523.73 | 1.469 | inf | 102 | 10630 | -$61.23 | -$3,139.16 | 3.08 |
| OOS2 | ADR 0.075 / MA25 | $1,129.87 | 1.297 | 4.734 | 109 | 9063 | -$67.35 | -$3,711.80 | 3.08 |
| OOS2 | ADR 0.10 / MA50 | $1,151.81 | 1.307 | inf | 122 | 6364 | -$85.51 | -$3,619.68 | 3.08 |
| OOS3 | ADR 0.025 / MA25 | $4,962.26 | 3.645 | inf | 86 | 15523 | -$35.74 | -$1,748.13 | 2.93 |
| OOS3 | ADR 0.05 / MA25 | $4,096.37 | 2.436 | 31.685 | 116 | 12595 | -$52.01 | -$2,706.36 | 2.98 |
| OOS3 | ADR 0.075 / MA25 | $3,396.08 | 1.966 | 9.075 | 128 | 10713 | -$63.69 | -$3,353.43 | 2.97 |
| OOS3 | ADR 0.10 / MA50 | $2,317.61 | 1.557 | 4.576 | 153 | 7470 | -$70.60 | -$3,976.48 | 3.08 |
| OOS4 | ADR 0.025 / MA25 | $2,585.10 | 2.457 | inf | 57 | 12679 | -$40.07 | -$1,630.48 | 3.07 |
| OOS4 | ADR 0.05 / MA25 | $1,806.83 | 1.721 | inf | 102 | 10224 | -$55.82 | -$2,397.17 | 3.08 |
| OOS4 | ADR 0.075 / MA25 | $1,501.15 | 1.543 | inf | 109 | 8560 | -$66.56 | -$2,652.42 | 3.08 |
| OOS4 | ADR 0.10 / MA50 | $858.60 | 1.265 | 4.198 | 129 | 5894 | -$92.43 | -$3,072.69 | 3.08 |

## Artifacts

- Detail CSV: `docs/research/gates/gate90/artifacts/oos-session-window-random-5w-scorecard.csv`
- Detail JSON: `docs/research/gates/gate90/artifacts/oos-session-window-random-5w-scorecard.json`
- Aggregate CSV: `docs/research/gates/gate90/artifacts/oos-session-window-random-5w-aggregate-scorecard.csv`
- Aggregate JSON: `docs/research/gates/gate90/artifacts/oos-session-window-random-5w-aggregate-scorecard.json`
- Per-cell reports and runner receipts are under `docs/research/gates/gate90/` and `docs/research/gates/gate90/artifacts/oos-session-window-5w-*`.

## Next Gate Recommendation

1. Audit session-flatten lifecycle semantics before assuming swap/slippage exposure is bounded to intraday only.
2. If lifecycle audit passes, run a red-news blackout boundary test on ADR 0.10 / MA50 and ADR 0.025 / MA25 only.
3. Keep Candidate B/COT out of primary direction selection until the execution/session boundary is proven, then test Candidate B as a controlled pair/direction risk overlay against David contra and raw both.

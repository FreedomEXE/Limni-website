# Gate 90 Session Window Full Scorecard

Generated: `2026-07-02`

## Verdict

`PASS_GATE90_SESSION_WINDOW_FULL_SCORECARD_RESEARCH_ONLY_NO_PROMOTION`

## Scope

- Warehouse-only Gate 90 session-window rerun with close events enabled.
- Window: New York `18:05` reopen, `15:45` new-start/add cutoff, `16:00` daily flatten, Sunday start `20:00`.
- Cells: ADR `0.025/0.05/0.075` with MA25, and ADR `0.10` with MA50.
- Rules: `raw_both`, `david_contra`, `candidate_b`, `stoch_contra`, `david_stoch_confirm`.
- Event PF is close-event net PF: gross positive close-event net divided by absolute gross negative close-event net, after modeled commission and swap.
- Weekly PF is the existing weekly mark-to-market equity profit factor from weekly equity deltas.
- No spread/slippage penalty was added. Inside this clean window, the remaining live-calendar concern is red-news blackout risk.

## Read

Best net row remains `ADR0.025_MA25 / raw_both` at `+1234.83`, event PF `1.7838`, weekly PF `31.7642`, max equity DD `-40.14`, and net/equity-DD `30.7631`.

Best `david_contra` row is `ADR0.025_MA25` at `+667.18`, event PF `1.7505`, weekly PF `125.7262`, max equity DD `-5.35`, and net/equity-DD `124.7065`.

Best event PF row is `ADR0.025_MA25 / stoch_contra` at event PF `1.882`, net `+497.8`, max open `42`.

The important distinction: weekly PF can look very high when most weekly equity marks climb smoothly, but event PF shows the actual closure quality once daily flatten losses are realized. For execution gating, event PF is the stricter stat.

## Core Scorecard

| Cell | Rule | Net | Return % | Event PF | Weekly PF | Max Eq DD | Max Eq DD % | Net/Eq DD | Win % | Entries | Max Open |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ADR0.025_MA25 | raw_both | 1234.83 | 12.35 | 1.7838 | 31.7642 | -40.14 | 0.4 | 30.7631 | 80.83 | 9283 | 80 |
| ADR0.05_MA25 | raw_both | 827.02 | 8.27 | 1.4074 | 8.2601 | -113.91 | 1.14 | 7.2603 | 85.2 | 7690 | 105 |
| ADR0.025_MA25 | david_contra | 667.18 | 6.67 | 1.7505 | 125.7262 | -5.35 | 0.05 | 124.7065 | 80.06 | 5314 | 56 |
| ADR0.05_MA25 | david_contra | 552.1 | 5.52 | 1.5462 | 10.4965 | -58.14 | 0.58 | 9.496 | 85.9 | 4025 | 73 |
| ADR0.10_MA50 | david_contra | 540.88 | 5.41 | 1.5342 | 28.635 | -19.57 | 0.2 | 27.6382 | 85.01 | 2317 | 93 |
| ADR0.025_MA25 | candidate_b | 522.58 | 5.23 | 1.642 | 42.9055 | -12.47 | 0.12 | 41.907 | 80.16 | 4632 | 47 |
| ADR0.075_MA25 | david_contra | 512.71 | 5.13 | 1.5164 | 6.8066 | -88.3 | 0.88 | 5.8065 | 86.26 | 3396 | 89 |
| ADR0.075_MA25 | raw_both | 508.28 | 5.08 | 1.2146 | 3.2614 | -224.77 | 2.25 | 2.2613 | 85.78 | 6543 | 114 |
| ADR0.025_MA25 | stoch_contra | 497.8 | 4.98 | 1.882 | 17.4819 | -30.2 | 0.3 | 16.4834 | 80.3 | 3835 | 42 |
| ADR0.025_MA25 | david_stoch_confirm | 401.32 | 4.01 | 1.7738 | 11.9731 | -36.57 | 0.37 | 10.974 | 79.79 | 3355 | 39 |
| ADR0.05_MA25 | candidate_b | 323.5 | 3.24 | 1.2968 | 5.5848 | -54.16 | 0.54 | 5.973 | 84.63 | 3860 | 59 |
| ADR0.10_MA50 | raw_both | 182.37 | 1.82 | 1.072 | 2.0114 | -180.32 | 1.8 | 1.0114 | 82.45 | 4581 | 124 |
| ADR0.075_MA25 | candidate_b | 150.12 | 1.5 | 1.1171 | 2.2835 | -116.97 | 1.17 | 1.2834 | 83.81 | 3282 | 69 |
| ADR0.05_MA25 | stoch_contra | 133.05 | 1.33 | 1.1683 | 2.0173 | -130.79 | 1.31 | 1.0173 | 83.89 | 2658 | 74 |
| ADR0.075_MA25 | stoch_contra | 126.25 | 1.26 | 1.1739 | 1.8894 | -89.18 | 0.89 | 1.4157 | 84.5 | 2110 | 70 |
| ADR0.05_MA25 | david_stoch_confirm | 119.46 | 1.19 | 1.1868 | 1.8927 | -133.83 | 1.34 | 0.8926 | 84.18 | 2153 | 66 |
| ADR0.075_MA25 | david_stoch_confirm | 105.59 | 1.06 | 1.1813 | 1.7657 | -78.01 | 0.78 | 1.3535 | 84.7 | 1676 | 67 |
| ADR0.10_MA50 | david_stoch_confirm | 60.69 | 0.61 | 1.1223 | 1.8385 | -72.26 | 0.72 | 0.8399 | 85.02 | 928 | 75 |
| ADR0.10_MA50 | stoch_contra | 5.58 | 0.06 | 1.0078 | 1.0308 | -126.86 | 1.27 | 0.044 | 83.49 | 1264 | 93 |
| ADR0.10_MA50 | candidate_b | -16.61 | -0.17 | 0.9877 | 0.9011 | -147.85 | 1.48 | -0.1123 | 80.55 | 2322 | 68 |

## Event Quality

| Cell | Rule | Events | Wins | Losses | Gross Profit | Gross Loss | Avg Win | Avg Loss | Payoff | Targets | Flattens |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ADR0.025_MA25 | raw_both | 7163 | 5790 | 1373 | 2810.24 | 1575.41 | 0.49 | 1.15 | 0.423 | 6773 | 390 |
| ADR0.05_MA25 | raw_both | 5353 | 4561 | 792 | 2857.12 | 2030.1 | 0.63 | 2.56 | 0.2444 | 4834 | 519 |
| ADR0.025_MA25 | david_contra | 4038 | 3233 | 805 | 1556.15 | 888.97 | 0.48 | 1.1 | 0.4359 | 3833 | 205 |
| ADR0.05_MA25 | david_contra | 2788 | 2395 | 393 | 1562.86 | 1010.76 | 0.65 | 2.57 | 0.2537 | 2513 | 275 |
| ADR0.10_MA50 | david_contra | 1388 | 1180 | 208 | 1553.45 | 1012.57 | 1.32 | 4.87 | 0.2704 | 1090 | 298 |
| ADR0.025_MA25 | candidate_b | 3579 | 2869 | 710 | 1336.59 | 814.01 | 0.47 | 1.15 | 0.4063 | 3373 | 206 |
| ADR0.075_MA25 | david_contra | 2206 | 1903 | 303 | 1505.6 | 992.89 | 0.79 | 3.28 | 0.2414 | 1908 | 298 |
| ADR0.075_MA25 | raw_both | 4199 | 3602 | 597 | 2876.91 | 2368.63 | 0.8 | 3.97 | 0.2013 | 3639 | 560 |
| ADR0.025_MA25 | stoch_contra | 2893 | 2323 | 570 | 1062.16 | 564.37 | 0.46 | 0.99 | 0.4618 | 2756 | 137 |
| ADR0.025_MA25 | david_stoch_confirm | 2509 | 2002 | 507 | 919.99 | 518.67 | 0.46 | 1.02 | 0.4492 | 2383 | 126 |
| ADR0.05_MA25 | candidate_b | 2681 | 2269 | 412 | 1413.49 | 1089.99 | 0.62 | 2.65 | 0.2355 | 2392 | 289 |
| ADR0.10_MA50 | raw_both | 2672 | 2203 | 469 | 2716.57 | 2534.19 | 1.23 | 5.4 | 0.2282 | 2078 | 594 |
| ADR0.075_MA25 | candidate_b | 2112 | 1770 | 342 | 1431.66 | 1281.54 | 0.81 | 3.75 | 0.2159 | 1786 | 326 |
| ADR0.05_MA25 | stoch_contra | 1856 | 1557 | 299 | 923.55 | 790.49 | 0.59 | 2.64 | 0.2244 | 1652 | 204 |
| ADR0.075_MA25 | stoch_contra | 1387 | 1172 | 215 | 852.38 | 726.13 | 0.73 | 3.38 | 0.2153 | 1179 | 208 |
| ADR0.05_MA25 | david_stoch_confirm | 1492 | 1256 | 236 | 758.82 | 639.36 | 0.6 | 2.71 | 0.223 | 1327 | 165 |
| ADR0.075_MA25 | david_stoch_confirm | 1085 | 919 | 166 | 687.89 | 582.3 | 0.75 | 3.51 | 0.2134 | 924 | 161 |
| ADR0.10_MA50 | david_stoch_confirm | 554 | 471 | 83 | 557.04 | 496.35 | 1.18 | 5.98 | 0.1978 | 439 | 115 |
| ADR0.10_MA50 | stoch_contra | 745 | 622 | 123 | 724.33 | 718.75 | 1.16 | 5.84 | 0.1993 | 584 | 161 |
| ADR0.10_MA50 | candidate_b | 1357 | 1093 | 264 | 1331.57 | 1348.18 | 1.22 | 5.11 | 0.2386 | 1027 | 330 |

## Flatten And Exposure

| Cell | Rule | Flat Positions | Flat Net | Flat Price PnL | Flat Gross Profit | Flat Gross Loss | Commission | Swap | Max Add | Position Days | Terminal |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ADR0.025_MA25 | raw_both | 999 | -1477.32 | -1395.09 | 35.74 | 1513.05 | -556.98 | -33.97 | 11 | 1100.87 | 0 |
| ADR0.05_MA25 | raw_both | 1352 | -1943.87 | -1830.57 | 51.36 | 1995.23 | -461.4 | -48.04 | 11 | 1470.71 | 0 |
| ADR0.025_MA25 | david_contra | 526 | -816.83 | -770.07 | 34.65 | 851.49 | -318.84 | -21.3 | 11 | 652.87 | 0 |
| ADR0.05_MA25 | david_contra | 697 | -967.75 | -905.3 | 26.43 | 994.19 | -241.5 | -27.84 | 11 | 782.07 | 0 |
| ADR0.10_MA50 | david_contra | 873 | -886.54 | -804.93 | 126.03 | 1012.57 | -139.02 | -35.89 | 10 | 982.39 | 0 |
| ADR0.025_MA25 | candidate_b | 522 | -765.08 | -723.32 | 18.23 | 783.31 | -277.92 | -16.59 | 9 | 515.62 | 0 |
| ADR0.075_MA25 | david_contra | 796 | -944.45 | -875.57 | 40.39 | 984.84 | -203.76 | -29.33 | 10 | 867.35 | 0 |
| ADR0.075_MA25 | raw_both | 1581 | -2278.86 | -2144.58 | 72.67 | 2351.53 | -392.58 | -56.36 | 17 | 1653.8 | 0 |
| ADR0.025_MA25 | stoch_contra | 364 | -514.45 | -480.52 | 22.29 | 536.74 | -230.1 | -17.34 | 8 | 480.21 | 0 |
| ADR0.025_MA25 | david_stoch_confirm | 332 | -474.24 | -443.54 | 20.85 | 495.09 | -201.3 | -15.03 | 8 | 433.06 | 0 |
| ADR0.05_MA25 | candidate_b | 725 | -1044.87 | -985.77 | 28.3 | 1073.16 | -231.6 | -23.75 | 9 | 722.08 | 0 |
| ADR0.10_MA50 | raw_both | 1825 | -2382.61 | -2222.25 | 150.34 | 2532.95 | -274.86 | -64.64 | 16 | 1839.79 | 0 |
| ADR0.075_MA25 | candidate_b | 884 | -1229.35 | -1156.99 | 41.91 | 1271.26 | -196.92 | -27.83 | 9 | 833.12 | 0 |
| ADR0.05_MA25 | stoch_contra | 527 | -763.86 | -715.81 | 14.38 | 778.24 | -159.48 | -21.09 | 11 | 623.63 | 0 |
| ADR0.075_MA25 | stoch_contra | 549 | -704.42 | -657.5 | 16.84 | 721.26 | -126.6 | -17.83 | 10 | 616.17 | 0 |
| ADR0.05_MA25 | david_stoch_confirm | 430 | -619.58 | -578.6 | 10.29 | 629.87 | -129.18 | -18.76 | 11 | 504.01 | 0 |
| ADR0.075_MA25 | david_stoch_confirm | 449 | -567.5 | -528.84 | 10.9 | 578.4 | -100.56 | -14.92 | 10 | 518.96 | 0 |
| ADR0.10_MA50 | david_stoch_confirm | 360 | -464.3 | -428.33 | 32.06 | 496.35 | -55.68 | -15.86 | 9 | 447.5 | 0 |
| ADR0.10_MA50 | stoch_contra | 502 | -686.41 | -640.12 | 32.33 | 718.75 | -75.84 | -18.17 | 9 | 575.13 | 0 |
| ADR0.10_MA50 | candidate_b | 994 | -1273.12 | -1189.6 | 74.16 | 1347.28 | -139.32 | -30.66 | 9 | 926.92 | 0 |

## Opinion

The daily window is still the right direction. The strongest live-shaped read is not simply highest net; it is net plus event PF plus low max-open pressure. On that basis, `ADR0.025 MA25 david_contra`, `ADR0.05 MA25 david_contra`, and `ADR0.10 MA50 david_contra` are the rows to keep watching. `ADR0.025 MA25 raw_both` is still the best benchmark, but it is not directionally disciplined.

I agree with the window reducing normal spread/slippage concern. The next external risk is scheduled red-news volatility, not ordinary rollover spread. That should become a calendar blackout control later, but not before this scorecard is locked.

## Artifacts

- Scorecard CSV: `docs/research/gates/gate90/artifacts/session-window-fullstats-5w-ohlc-s020-exp010-rsi50-stoch6040-scorecard.csv`
- Scorecard JSON: `docs/research/gates/gate90/artifacts/session-window-fullstats-5w-ohlc-s020-exp010-rsi50-stoch6040-scorecard.json`
- Full-stat run artifacts: `docs/research/gates/gate90/artifacts/session-window-fullstats-5w-ohlc-*`

## Stop Line

Gate 90 remains research-only. Do not promote, open MT5/live work, or redesign broad COT/Candidate B regimes from this scorecard.

# Gate 54H CLP Tie-Break Comparison

Generated: 2026-06-24T03:04:39.226Z

## Result

- Status: PASS_CLP_TIE_BREAK_COMPARISON_READY_FOR_REVIEW
- Gate: Gate 54H: clp-tie-break-comparison
- Matrix dataset: 479624d1-f6a2-4928-82f1-981137762bdc / cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
- Source mutation by this script: false
- No final system selection: true
- Winner by tie-only weekly hold ADR: raw_underlying_cot_spread
- Winner by tie-only ADR Grid ADR: carry_previous_clp_side

## Policy

This proof compares only CLP tie-break handling for pair-weeks where base and quote CLP TEI are equal. Normal non-tied CLP decisions are unchanged.

Policy A carries the previous non-tied CLP side for that pair. Policy B uses the raw underlying COT spread behind CLP: normalized non-commercial net lean minus normalized commercial net lean minus normalized dealer net lean, with the same lower-exhaustion polarity used by CLP. If normalized components are unavailable, it falls back to the unnormalized raw composite spread.

The COT report selection policy is inherited from Gate 54G: exact report date when available, holiday-adjusted report date when needed, and no-lookahead carry-forward through known source-ambiguous lapse windows.

## CLP Lifecycle

- Stored FX COT report dates: 546
- Stored COT date range: 2016-01-05 -> 2026-06-16
- Lookback reports: 156
- First lifecycle report date: 2018-12-24
- Missing metric windows: 0

## Tie Coverage

- Expected weeks: 388
- Baseline selected rows: 10793
- Baseline partial weeks: 60
- Tie rows: 71
- Tie weeks: 60
- Carry previous resolved tie rows: 71
- Raw COT spread resolved tie rows: 71
- Policy agreement rows: 34
- Policy disagreement rows: 37
- Missing lifecycle pair rows: 0

## Full-System Context

| Policy | Rows | Full weeks | Partial weeks | Weekly Hold ADR | Weekly Hold DD | Weekly Hold PF | ADR Grid ADR | ADR Grid DD | ADR Grid PF |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Baseline CLP, ties skipped | 10793 | 328 | 60 | 347.0824 | -149.0153 | 1.1887 | 1137.9197 | -372.4695 | 1.2523 |
| Carry previous CLP side | 10864 | 388 | 0 | 339.4126 | -151.9313 | 1.1844 | 1176.452 | -358.9404 | 1.2604 |
| Raw underlying COT spread | 10864 | 388 | 0 | 348.063 | -146.7049 | 1.1889 | 1157.5101 | -358.2687 | 1.2558 |

## Tie-Only Contribution

| Policy | Tie rows | Tie weeks | Weekly Hold ADR | Weekly Hold missing price rows | ADR Grid ADR | ADR Grid missing rows | ADR Grid fills |
|---|---:|---:|---:|---:|---:|---:|---:|
| Carry previous CLP side | 71 | 60 | -7.6696 | 0 | 38.5323 | 2 | 659 |
| Raw underlying COT spread | 71 | 60 | 0.981 | 0 | 19.5902 | 2 | 712 |

## Partial Weeks Before Tie Fill

| Week | Selected COT date | Baseline decisions | Ties | Carry decisions | Raw spread decisions |
|---|---|---:|---:|---:|---:|
| 2019-01-21 | 2019-01-15 | 27 | 1 | 28 | 28 |
| 2019-04-07 | 2019-04-02 | 26 | 2 | 28 | 28 |
| 2019-04-14 | 2019-04-09 | 27 | 1 | 28 | 28 |
| 2019-06-09 | 2019-06-04 | 27 | 1 | 28 | 28 |
| 2019-08-18 | 2019-08-13 | 27 | 1 | 28 | 28 |
| 2019-09-01 | 2019-08-27 | 27 | 1 | 28 | 28 |
| 2020-03-02 | 2020-02-25 | 27 | 1 | 28 | 28 |
| 2020-05-24 | 2020-05-19 | 27 | 1 | 28 | 28 |
| 2020-07-19 | 2020-07-14 | 27 | 1 | 28 | 28 |
| 2020-08-09 | 2020-08-04 | 27 | 1 | 28 | 28 |
| 2020-08-16 | 2020-08-11 | 27 | 1 | 28 | 28 |
| 2020-09-06 | 2020-09-01 | 26 | 2 | 28 | 28 |
| 2020-11-09 | 2020-11-03 | 27 | 1 | 28 | 28 |
| 2021-01-04 | 2020-12-29 | 27 | 1 | 28 | 28 |
| 2021-01-18 | 2021-01-12 | 26 | 2 | 28 | 28 |
| 2021-01-25 | 2021-01-19 | 27 | 1 | 28 | 28 |
| 2021-02-01 | 2021-01-26 | 26 | 2 | 28 | 28 |
| 2021-05-09 | 2021-05-04 | 27 | 1 | 28 | 28 |
| 2021-10-10 | 2021-10-05 | 27 | 1 | 28 | 28 |
| 2021-12-06 | 2021-11-30 | 27 | 1 | 28 | 28 |
| 2022-01-31 | 2022-01-25 | 26 | 2 | 28 | 28 |
| 2022-02-14 | 2022-02-08 | 27 | 1 | 28 | 28 |
| 2022-03-13 | 2022-03-08 | 26 | 2 | 28 | 28 |
| 2022-04-24 | 2022-04-19 | 27 | 1 | 28 | 28 |
| 2022-05-15 | 2022-05-10 | 27 | 1 | 28 | 28 |
| 2022-06-19 | 2022-06-14 | 27 | 1 | 28 | 28 |
| 2022-06-26 | 2022-06-21 | 27 | 1 | 28 | 28 |
| 2022-11-28 | 2022-11-22 | 27 | 1 | 28 | 28 |
| 2022-12-05 | 2022-11-29 | 27 | 1 | 28 | 28 |
| 2022-12-12 | 2022-12-06 | 25 | 3 | 28 | 28 |
| 2022-12-19 | 2022-12-13 | 27 | 1 | 28 | 28 |
| 2022-12-26 | 2022-12-20 | 27 | 1 | 28 | 28 |
| 2023-01-02 | 2022-12-27 | 27 | 1 | 28 | 28 |
| 2023-02-06 | 2023-01-31 | 27 | 1 | 28 | 28 |
| 2023-03-06 | 2023-02-28 | 27 | 1 | 28 | 28 |
| 2023-03-26 | 2023-03-21 | 26 | 2 | 28 | 28 |
| 2023-06-25 | 2023-06-20 | 27 | 1 | 28 | 28 |
| 2023-09-24 | 2023-09-19 | 27 | 1 | 28 | 28 |
| 2023-10-22 | 2023-10-17 | 27 | 1 | 28 | 28 |
| 2023-11-13 | 2023-11-07 | 27 | 1 | 28 | 28 |
| 2024-01-15 | 2024-01-09 | 27 | 1 | 28 | 28 |
| 2024-03-31 | 2024-03-26 | 27 | 1 | 28 | 28 |
| 2024-04-21 | 2024-04-16 | 27 | 1 | 28 | 28 |
| 2024-04-28 | 2024-04-23 | 26 | 2 | 28 | 28 |
| 2024-06-16 | 2024-06-11 | 27 | 1 | 28 | 28 |
| 2024-07-14 | 2024-07-09 | 27 | 1 | 28 | 28 |
| 2024-08-11 | 2024-08-06 | 27 | 1 | 28 | 28 |
| 2024-09-15 | 2024-09-10 | 27 | 1 | 28 | 28 |
| 2024-10-06 | 2024-10-01 | 27 | 1 | 28 | 28 |
| 2024-10-27 | 2024-10-22 | 27 | 1 | 28 | 28 |
| 2024-12-16 | 2024-12-10 | 27 | 1 | 28 | 28 |
| 2024-12-23 | 2024-12-17 | 27 | 1 | 28 | 28 |
| 2025-01-27 | 2025-01-21 | 27 | 1 | 28 | 28 |
| 2025-04-06 | 2025-04-01 | 27 | 1 | 28 | 28 |
| 2025-04-20 | 2025-04-15 | 27 | 1 | 28 | 28 |
| 2025-07-27 | 2025-07-22 | 27 | 1 | 28 | 28 |
| 2026-02-09 | 2026-02-03 | 26 | 2 | 28 | 28 |
| 2026-02-23 | 2026-02-17 | 27 | 1 | 28 | 28 |
| 2026-03-22 | 2026-03-17 | 27 | 1 | 28 | 28 |
| 2026-05-17 | 2026-05-12 | 27 | 1 | 28 | 28 |

## Tie Cases

| Week | Pair | Report date | Carry previous | Raw COT spread | Agree | Raw normalized spread | Raw composite spread |
|---|---|---|---|---|---|---:|---:|
| 2019-01-21 | GBPAUD | 2019-01-15 | SHORT | SHORT | true | 0.0538196 | -11973 |
| 2019-04-07 | GBPUSD | 2019-04-02 | SHORT | LONG | false | -0.14338304 | -45281 |
| 2019-04-07 | CADCHF | 2019-04-02 | SHORT | SHORT | true | 0.4871264 | -28699 |
| 2019-04-14 | GBPUSD | 2019-04-09 | SHORT | LONG | false | -0.47755121 | -47210 |
| 2019-06-09 | EURAUD | 2019-06-04 | LONG | LONG | true | -0.68681496 | -147688 |
| 2019-08-18 | CADCHF | 2019-08-13 | SHORT | SHORT | true | 0.02698351 | -4033 |
| 2019-09-01 | GBPNZD | 2019-08-27 | LONG | LONG | true | -0.03405853 | -31917 |
| 2020-03-02 | CADJPY | 2020-02-25 | LONG | LONG | true | -0.38396525 | 38939 |
| 2020-05-24 | AUDNZD | 2020-05-19 | SHORT | LONG | false | -0.08778989 | -30983 |
| 2020-07-19 | EURAUD | 2020-07-14 | SHORT | SHORT | true | 0.23249241 | -57712 |
| 2020-08-09 | EURCHF | 2020-08-04 | SHORT | SHORT | true | 0.10630446 | -31303 |
| 2020-08-16 | EURCHF | 2020-08-11 | SHORT | LONG | false | -0.12426546 | -20141 |
| 2020-09-06 | EURCHF | 2020-09-01 | SHORT | SHORT | true | 0.10385499 | -8227 |
| 2020-09-06 | NZDJPY | 2020-09-01 | SHORT | SHORT | true | 0.47406859 | 23261 |
| 2020-11-09 | USDCAD | 2020-11-03 | LONG | SHORT | false | 0.45213042 | 64022 |
| 2021-01-04 | NZDCHF | 2020-12-29 | SHORT | SHORT | true | 0.01934287 | 5301 |
| 2021-01-18 | EURGBP | 2021-01-12 | SHORT | LONG | false | -0.04249621 | -94563 |
| 2021-01-18 | CHFJPY | 2021-01-12 | LONG | SHORT | false | 0.10166006 | 32426 |
| 2021-01-25 | EURGBP | 2021-01-19 | SHORT | LONG | false | -0.04286693 | -93345 |
| 2021-02-01 | EURAUD | 2021-01-26 | LONG | SHORT | false | 0.62139381 | -45965 |
| 2021-02-01 | GBPCAD | 2021-01-26 | SHORT | SHORT | true | 0.43850334 | 38740 |
| 2021-05-09 | AUDCAD | 2021-05-04 | SHORT | LONG | false | -0.27740937 | -6890 |
| 2021-10-10 | EURGBP | 2021-10-05 | LONG | LONG | true | -0.94280717 | -280235 |
| 2021-12-06 | GBPCHF | 2021-11-30 | LONG | SHORT | false | 0.58283369 | 20601 |
| 2022-01-31 | USDCAD | 2022-01-25 | SHORT | SHORT | true | 0.80554358 | 26871 |
| 2022-01-31 | EURNZD | 2022-01-25 | SHORT | LONG | false | -0.98203587 | -194676 |
| 2022-02-14 | EURNZD | 2022-02-08 | SHORT | LONG | false | -0.98570603 | -206485 |
| 2022-03-13 | USDCAD | 2022-03-08 | LONG | SHORT | false | 0.49624214 | 24329 |
| 2022-03-13 | CHFJPY | 2022-03-08 | SHORT | SHORT | true | 0.03307852 | 36262 |
| 2022-04-24 | EURAUD | 2022-04-19 | LONG | LONG | true | -0.23736472 | -121234 |
| 2022-05-15 | CHFJPY | 2022-05-10 | SHORT | LONG | false | -0.05088661 | 65392 |
| 2022-06-19 | AUDCHF | 2022-06-14 | SHORT | SHORT | true | 0.090245 | -42826 |
| 2022-06-26 | NZDJPY | 2022-06-21 | SHORT | SHORT | true | 0.24502331 | 21483 |
| 2022-11-28 | AUDCAD | 2022-11-22 | LONG | LONG | true | -0.04659951 | -21877 |
| 2022-12-05 | AUDCAD | 2022-11-29 | LONG | SHORT | false | 0.04779225 | -18943 |
| 2022-12-12 | CADJPY | 2022-12-06 | SHORT | SHORT | true | 0.19038664 | 30484 |
| 2022-12-12 | CADCHF | 2022-12-06 | SHORT | SHORT | true | 0.43628493 | -17857 |
| 2022-12-12 | CHFJPY | 2022-12-06 | LONG | LONG | true | -0.24589829 | 48341 |
| 2022-12-19 | USDJPY | 2022-12-13 | SHORT | SHORT | true | 0.54274367 | 67517 |
| 2022-12-26 | GBPCHF | 2022-12-20 | LONG | LONG | true | -0.27943361 | -6153 |
| 2023-01-02 | AUDCHF | 2022-12-27 | SHORT | LONG | false | -0.34770755 | -53442 |
| 2023-02-06 | GBPCHF | 2023-01-31 | LONG | SHORT | false | 0.0316128 | -13545 |
| 2023-03-06 | USDJPY | 2023-02-28 | LONG | SHORT | false | 0.28754699 | 98739 |
| 2023-03-26 | AUDUSD | 2023-03-21 | LONG | LONG | true | -0.01735924 | -59715 |
| 2023-03-26 | GBPCHF | 2023-03-21 | SHORT | LONG | false | -0.07624683 | -4789 |
| 2023-06-25 | AUDCAD | 2023-06-20 | SHORT | LONG | false | -0.13024812 | -44165 |
| 2023-09-24 | AUDNZD | 2023-09-19 | SHORT | LONG | false | -0.11954396 | -67270 |
| 2023-10-22 | CADCHF | 2023-10-17 | LONG | LONG | true | -0.17681337 | -17631 |
| 2023-11-13 | NZDCHF | 2023-11-07 | SHORT | SHORT | true | 0.14000285 | 12416 |
| 2024-01-15 | EURCAD | 2024-01-09 | SHORT | LONG | false | -0.38755505 | -166464 |
| 2024-03-31 | AUDUSD | 2024-03-26 | LONG | SHORT | false | 0.59095157 | -85717 |
| 2024-04-21 | CADCHF | 2024-04-16 | SHORT | SHORT | true | 0.22307041 | -18705 |
| 2024-04-28 | NZDUSD | 2024-04-23 | SHORT | SHORT | true | 0.54782942 | -6756 |
| 2024-04-28 | CHFJPY | 2024-04-23 | SHORT | SHORT | true | 0.00156953 | 150424 |
| 2024-06-16 | CADCHF | 2024-06-11 | LONG | SHORT | false | 0.01383704 | -85683 |
| 2024-07-14 | CHFJPY | 2024-07-09 | SHORT | LONG | false | -0.12569962 | 133151 |
| 2024-08-11 | GBPAUD | 2024-08-06 | LONG | SHORT | false | 0.29898781 | 152703 |
| 2024-09-15 | NZDUSD | 2024-09-10 | SHORT | SHORT | true | 0.09387612 | -16938 |
| 2024-10-06 | CADCHF | 2024-10-01 | LONG | LONG | true | -0.08704884 | -23259 |
| 2024-10-27 | EURUSD | 2024-10-22 | SHORT | LONG | false | -1.90442308 | -253472 |
| 2024-12-16 | EURNZD | 2024-12-10 | SHORT | LONG | false | -0.64511702 | -249205 |
| 2024-12-23 | EURNZD | 2024-12-17 | SHORT | LONG | false | -0.78221174 | -225218 |
| 2025-01-27 | AUDCAD | 2025-01-21 | LONG | SHORT | false | 0.09328719 | 22458 |
| 2025-04-06 | CADCHF | 2025-04-01 | LONG | SHORT | false | 0.0242556 | -81211 |
| 2025-04-20 | GBPCAD | 2025-04-15 | SHORT | SHORT | true | 0.31755401 | 65144 |
| 2025-07-27 | NZDCHF | 2025-07-22 | SHORT | SHORT | true | 0.18798982 | 11151 |
| 2026-02-09 | AUDCAD | 2026-02-03 | SHORT | LONG | false | -0.09979472 | 5788 |
| 2026-02-09 | NZDCHF | 2026-02-03 | LONG | SHORT | false | 0.17917038 | 881 |
| 2026-02-23 | AUDCAD | 2026-02-17 | SHORT | LONG | false | -0.08127536 | 3305 |
| 2026-03-22 | NZDJPY | 2026-03-17 | LONG | SHORT | false | 0.10033631 | 96810 |
| 2026-05-17 | NZDCHF | 2026-05-12 | LONG | SHORT | false | 0.27938558 | 2893 |

## Decision Boundary

Gate 54H compares CLP tie-break policies only. It does not authorize final Signal Model selection, broad optimization, BPR/RRP retests, execution/risk-overlay changes, MT5/live work, production, or promotion claims.

## Files

- JSON: app\reports\data-verification\macro-regime\gate54h-clp-tie-break-comparison-20260624T030439Z.json
- Markdown: app\reports\data-verification\macro-regime\gate54h-clp-tie-break-comparison-20260624T030439Z.md
- Docs copy: docs/research/GATE54H_CLP_TIE_BREAK_COMPARISON_2026-06-23.md

Receipt hash: `8E2FCBB05C62948FECD6F518446518611574C5B54C76EC766CDD37366B63DE37`

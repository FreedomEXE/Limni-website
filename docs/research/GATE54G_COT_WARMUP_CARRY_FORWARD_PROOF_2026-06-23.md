# Gate 54G COT Warmup Carry-Forward Proof

Generated: 2026-06-24T02:45:12.706Z

## Result

- Status: PASS_COT_WARMUP_CARRY_FORWARD_READY_FOR_REVIEW
- Gate: Gate 54G: cot-warmup-carry-forward
- Matrix dataset: 479624d1-f6a2-4928-82f1-981137762bdc / cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
- Source mutation by this script: false
- No final system selection: true

## Policy

CLP uses a 156-report COT lifecycle lookback. For each trade week, the selector uses the latest COT report proven available by that week's expected COT report date. If the exact report is missing, it carries forward the prior available report. Known source-ambiguous 2025 lapse/catch-up rows are not allowed to enter earlier weeks by report date alone.

Late reports can enter future lifecycle windows only after their availability is proven; they are not retroactively used for weeks that would have traded before publication.

## CLP Lifecycle

- Stored FX COT report dates: 546
- Stored COT date range: 2016-01-05 -> 2026-06-16
- Lookback reports: 156
- First lifecycle report date: 2018-12-24
- Missing metric windows: 0

## Carry-Forward Coverage

- Expected weeks: 388
- Selected rows: 10793
- Full 28/28 weeks: 328
- Partial weeks: 60
- No-signal weeks: 0
- Tie rows: 71
- Missing lifecycle pair rows: 0

### Week Classification

| Classification | Weeks |
|---|---:|
| `exact_report_date_available` | 372 |
| `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 13 |
| `holiday_adjusted_report_date_available` | 3 |

### Simple Weekly Hold Context

- Total ADR: 347.0824
- Max DD ADR: -149.0153
- R/DD: 2.3292
- Profit factor ADR: 1.1887
- Missing price rows: 308

### Non-Exact COT Weeks

| Week | Expected COT date | Selected COT date | Age days | Classification | Decisions | Ties | Missing lifecycle pairs |
|---|---|---|---:|---|---:|---:|---:|
| 2019-01-07 | 2019-01-01 | 2018-12-31 | 1 | `holiday_adjusted_report_date_available` | 28 | 0 | 0 |
| 2020-12-28 | 2020-12-22 | 2020-12-21 | 1 | `holiday_adjusted_report_date_available` | 28 | 0 | 0 |
| 2023-07-09 | 2023-07-04 | 2023-07-03 | 1 | `holiday_adjusted_report_date_available` | 28 | 0 | 0 |
| 2025-10-05 | 2025-09-30 | 2025-09-23 | 7 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-10-12 | 2025-10-07 | 2025-09-23 | 14 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-10-19 | 2025-10-14 | 2025-09-23 | 21 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-10-26 | 2025-10-21 | 2025-09-23 | 28 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-11-03 | 2025-10-28 | 2025-09-23 | 35 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-11-10 | 2025-11-04 | 2025-09-23 | 42 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-11-17 | 2025-11-11 | 2025-09-23 | 49 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-11-24 | 2025-11-18 | 2025-09-23 | 56 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-12-01 | 2025-11-25 | 2025-09-23 | 63 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-12-08 | 2025-12-02 | 2025-09-23 | 70 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-12-15 | 2025-12-09 | 2025-09-23 | 77 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-12-22 | 2025-12-16 | 2025-09-23 | 84 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |
| 2025-12-29 | 2025-12-23 | 2025-09-23 | 91 | `carry_forward_2025_lapse_source_ambiguous_no_lookahead` | 28 | 0 | 0 |

## Decision Boundary

Gate 54G proves COT warmup and no-lookahead carry-forward mechanics only. It does not authorize final Signal Model selection, optimization, BPR/RRP retests, execution/risk-overlay changes, MT5/live work, production, or promotion claims.

## Files

- JSON: app\reports\data-verification\macro-regime\gate54g-cot-warmup-carry-forward-20260624T024512Z.json
- Markdown: app\reports\data-verification\macro-regime\gate54g-cot-warmup-carry-forward-20260624T024512Z.md
- Docs copy: docs/research/GATE54G_COT_WARMUP_CARRY_FORWARD_PROOF_2026-06-23.md

Receipt hash: `559855706524CE23EB6B55814FE24015857CC00DFBDB689CF286C9402C276058`

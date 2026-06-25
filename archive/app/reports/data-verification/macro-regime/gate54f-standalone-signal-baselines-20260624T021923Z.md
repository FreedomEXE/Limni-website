# Gate 54F Standalone Signal Baselines And Source Availability

Generated: 2026-06-24T02:19:23.713Z

## Result

- Status: PASS_BASELINE_CONTEXT_READY_FOR_REVIEW
- Gate: Gate 54F: standalone-signal-baselines
- Matrix dataset: 479624d1-f6a2-4928-82f1-981137762bdc / cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
- No source rebuild/refetch: true
- No optimization/system selection: true

## Interpretation

This receipt keeps the existing ADR Grid score and adds a separate one-entry weekly-hold context number. The weekly-hold context uses the execution weekly window and one selected side per pair, not the ADR Grid fill ledger.

CLP is evaluated here as a pure diagnostic lifecycle rule: fade the currency with the higher TEI crowding/exhaustion score. This is a baseline source/evaluation proof, not final system selection.

## Metrics

| Signal | Rows | Full weeks | ADR Grid ADR | ADR Grid DD | ADR Grid R/DD | Weekly Hold ADR | Weekly Hold DD | Weekly Hold R/DD | Missing hold rows |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| cot_lifecycle_polarity_v0_noncomm_primary | 5974 | 176 | 1108.2065 | -262.5496 | 4.2209 | 124.8468 | -149.0153 | 0.8378 | 0 |
| strength_friday_snapshot_selected | 10292 | 359 | 1223.2949 | -519.9618 | 2.3527 | -144.3625 | -286.0028 | -0.5048 | 0 |

## Source Availability

- Expected calendar weeks from matrix span: 388
- Weeks present in Gate 44 matrix: 372
- Weeks absent from matrix: 16
- COT full-week unavailable/pending weeks in matrix: 3
- Future no-COT fallback candidate weeks with Friday Strength 28/28: 0

### COT Availability Classes

| Classification | Weeks |
|---|---:|
| `tradable_normal_publication_or_matrix_available` | 369 |
| `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` | 13 |
| `not_traded_internal_matrix_gap_source_available` | 3 |
| `not_traded_internal_cot_holiday_join_gap_source_available` | 2 |
| `not_traded_cftc_unavailable_early_2019_shutdown_lapse` | 1 |

### COT Source Timing Basis

| Classification | Weeks |
|---|---:|
| `stored_exact_report_date` | 372 |
| `2025_lapse_catch_up_source_ambiguous` | 13 |
| `stored_holiday_adjusted_report_date` | 2 |
| `not_proven_available` | 1 |

### CLP Availability Classes

| Classification | Weeks |
|---|---:|
| `available_28_28` | 176 |
| `clp_warmup_or_lifecycle_unavailable` | 154 |
| `partial_clp_lifecycle_available` | 39 |
| `cot_unavailable` | 19 |

### Friday Strength Availability Classes

| Classification | Weeks |
|---|---:|
| `available_28_28` | 359 |
| `not_in_matrix` | 16 |
| `partial_internal_friday_strength_gap` | 12 |
| `not_traded_internal_friday_strength_gap` | 1 |

### COT Problem Weeks In Matrix

| Week | Derived COT date | Stored COT date | COT rows | Friday Strength rows | Classification | Future no-COT fallback candidate |
|---|---|---|---:|---:|---|---|
| 2019-01-07 | 2019-01-01 | - | 0 | 0 | `not_traded_cftc_unavailable_early_2019_shutdown_lapse` | no |
| 2020-12-28 | 2020-12-22 | 2020-12-21 | 0 | 28 | `not_traded_internal_cot_holiday_join_gap_source_available` | no |
| 2023-07-09 | 2023-07-04 | 2023-07-03 | 0 | 28 | `not_traded_internal_cot_holiday_join_gap_source_available` | no |

### Matrix-Absent Weeks

| Week | Derived COT date | Stored COT date | COT source timing | Classification |
|---|---|---|---|---|
| 2024-01-01 | 2023-12-26 | 2023-12-26 | `stored_exact_report_date` | `not_traded_internal_matrix_gap_source_available` |
| 2024-12-23 | 2024-12-17 | 2024-12-17 | `stored_exact_report_date` | `not_traded_internal_matrix_gap_source_available` |
| 2024-12-30 | 2024-12-24 | 2024-12-24 | `stored_exact_report_date` | `not_traded_internal_matrix_gap_source_available` |
| 2025-10-05 | 2025-09-30 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-10-12 | 2025-10-07 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-10-19 | 2025-10-14 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-10-26 | 2025-10-21 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-03 | 2025-10-28 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-10 | 2025-11-04 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-17 | 2025-11-11 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-24 | 2025-11-18 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-01 | 2025-11-25 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-08 | 2025-12-02 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-15 | 2025-12-09 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-22 | 2025-12-16 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-29 | 2025-12-23 | - | `2025_lapse_catch_up_source_ambiguous` | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |

## CLP Lifecycle

- Lookback reports: 156
- First lifecycle report date: 2021-12-28
- Lifecycle state rows: 1872
- Warmup rows excluded: 4312
- True missing lifecycle rows: 0
- COT unavailable rows: 84
- Tie rows: 46

## Decision Boundary

Gate 54F is ready for outside review of the raw baseline numbers. It does not authorize final Signal Model selection, optimization, regime fallback tests, BPR/RRP retests, or live/MT5 work.

## Files

- JSON: app\reports\data-verification\macro-regime\gate54f-standalone-signal-baselines-20260624T021923Z.json
- Markdown: app\reports\data-verification\macro-regime\gate54f-standalone-signal-baselines-20260624T021923Z.md
- Docs copy: docs/research/GATE54F_STANDALONE_SIGNAL_BASELINES_AND_SOURCE_AVAILABILITY_2026-06-23.md

Receipt hash: `DD2CA30CBD1ADEFD884417926373091FDBE837C649B1B0AA86DAFDCA969E6730`

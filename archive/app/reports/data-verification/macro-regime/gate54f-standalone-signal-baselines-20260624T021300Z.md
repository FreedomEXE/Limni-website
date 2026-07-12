# Gate 54F Standalone Signal Baselines And Source Availability

Generated: 2026-06-24T02:13:00.665Z

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
- Future no-COT fallback candidate weeks with Friday Strength 28/28: 2

### COT Availability Classes

| Classification | Weeks |
|---|---:|
| `tradable_normal_publication_or_matrix_available` | 369 |
| `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` | 13 |
| `not_in_matrix_unclassified` | 3 |
| `not_traded_cftc_unavailable_early_2019_shutdown_lapse` | 1 |
| `publication_timing_pending_2020_holiday_delay_not_auto_blocked` | 1 |
| `not_traded_internal_cot_matrix_gap` | 1 |

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

| Week | COT report date | COT rows | Friday Strength rows | Classification | Future no-COT fallback candidate |
|---|---|---:|---:|---|---|
| 2019-01-07 | 2019-01-01 | 0 | 0 | `not_traded_cftc_unavailable_early_2019_shutdown_lapse` | no |
| 2020-12-28 | 2020-12-22 | 0 | 28 | `publication_timing_pending_2020_holiday_delay_not_auto_blocked` | yes |
| 2023-07-09 | 2023-07-04 | 0 | 28 | `not_traded_internal_cot_matrix_gap` | yes |

### Matrix-Absent Shutdown Weeks

| Week | COT report date | Classification |
|---|---|---|
| 2024-01-01 | 2023-12-26 | `not_in_matrix_unclassified` |
| 2024-12-23 | 2024-12-17 | `not_in_matrix_unclassified` |
| 2024-12-30 | 2024-12-24 | `not_in_matrix_unclassified` |
| 2025-10-05 | 2025-09-30 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-10-12 | 2025-10-07 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-10-19 | 2025-10-14 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-10-26 | 2025-10-21 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-03 | 2025-10-28 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-10 | 2025-11-04 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-17 | 2025-11-11 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-24 | 2025-11-18 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-01 | 2025-11-25 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-08 | 2025-12-02 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-15 | 2025-12-09 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-22 | 2025-12-16 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-29 | 2025-12-23 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |

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

- JSON: app\reports\data-verification\macro-regime\gate54f-standalone-signal-baselines-20260624T021300Z.json
- Markdown: app\reports\data-verification\macro-regime\gate54f-standalone-signal-baselines-20260624T021300Z.md
- Docs copy: docs/research/GATE54F_STANDALONE_SIGNAL_BASELINES_AND_SOURCE_AVAILABILITY_2026-06-23.md

Receipt hash: `177370232A9F1CD4903C49A266ECD95C7AE845DB1515658BD7A073AC7F083E31`

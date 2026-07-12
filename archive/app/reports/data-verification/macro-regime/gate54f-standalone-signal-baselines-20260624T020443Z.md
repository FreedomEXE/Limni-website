# Gate 54F Standalone Signal Baselines And Source Availability

Generated: 2026-06-24T02:04:43.027Z

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

- Expected calendar weeks from matrix span: 387
- Weeks present in Gate 44 matrix: 372
- Weeks absent from matrix: 263
- COT full-week unavailable/pending weeks in matrix: 2
- Future no-COT fallback candidate weeks with Friday Strength 28/28: 1

### COT Availability Classes

| Classification | Weeks |
|---|---:|
| `not_in_matrix_unclassified` | 250 |
| `tradable_normal_publication_or_matrix_available` | 122 |
| `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` | 13 |
| `not_traded_cftc_unavailable_early_2019_shutdown_lapse` | 1 |
| `publication_timing_pending_2020_holiday_delay_not_auto_blocked` | 1 |

### CLP Availability Classes

| Classification | Weeks |
|---|---:|
| `cot_unavailable` | 265 |
| `available_28_28` | 54 |
| `clp_warmup_or_lifecycle_unavailable` | 52 |
| `partial_clp_lifecycle_available` | 16 |

### Friday Strength Availability Classes

| Classification | Weeks |
|---|---:|
| `not_in_matrix` | 263 |
| `available_28_28` | 116 |
| `partial_internal_friday_strength_gap` | 7 |
| `not_traded_internal_friday_strength_gap` | 1 |

### COT Problem Weeks In Matrix

| Week | COT report date | COT rows | Friday Strength rows | Classification | Future no-COT fallback candidate |
|---|---|---:|---:|---|---|
| 2019-01-07 | 2019-01-01 | 0 | 0 | `not_traded_cftc_unavailable_early_2019_shutdown_lapse` | no |
| 2020-12-28 | 2020-12-22 | 0 | 28 | `publication_timing_pending_2020_holiday_delay_not_auto_blocked` | yes |

### Matrix-Absent Shutdown Weeks

| Week | COT report date | Classification |
|---|---|---|
| 2019-03-11 | 2019-03-05 | `not_in_matrix_unclassified` |
| 2019-03-18 | 2019-03-12 | `not_in_matrix_unclassified` |
| 2019-03-25 | 2019-03-19 | `not_in_matrix_unclassified` |
| 2019-04-01 | 2019-03-26 | `not_in_matrix_unclassified` |
| 2019-04-08 | 2019-04-02 | `not_in_matrix_unclassified` |
| 2019-04-15 | 2019-04-09 | `not_in_matrix_unclassified` |
| 2019-04-22 | 2019-04-16 | `not_in_matrix_unclassified` |
| 2019-04-29 | 2019-04-23 | `not_in_matrix_unclassified` |
| 2019-05-06 | 2019-04-30 | `not_in_matrix_unclassified` |
| 2019-05-13 | 2019-05-07 | `not_in_matrix_unclassified` |
| 2019-05-20 | 2019-05-14 | `not_in_matrix_unclassified` |
| 2019-05-27 | 2019-05-21 | `not_in_matrix_unclassified` |
| 2019-06-03 | 2019-05-28 | `not_in_matrix_unclassified` |
| 2019-06-10 | 2019-06-04 | `not_in_matrix_unclassified` |
| 2019-06-17 | 2019-06-11 | `not_in_matrix_unclassified` |
| 2019-06-24 | 2019-06-18 | `not_in_matrix_unclassified` |
| 2019-07-01 | 2019-06-25 | `not_in_matrix_unclassified` |
| 2019-07-08 | 2019-07-02 | `not_in_matrix_unclassified` |
| 2019-07-15 | 2019-07-09 | `not_in_matrix_unclassified` |
| 2019-07-22 | 2019-07-16 | `not_in_matrix_unclassified` |
| 2019-07-29 | 2019-07-23 | `not_in_matrix_unclassified` |
| 2019-08-05 | 2019-07-30 | `not_in_matrix_unclassified` |
| 2019-08-12 | 2019-08-06 | `not_in_matrix_unclassified` |
| 2019-08-19 | 2019-08-13 | `not_in_matrix_unclassified` |
| 2019-08-26 | 2019-08-20 | `not_in_matrix_unclassified` |
| 2019-09-02 | 2019-08-27 | `not_in_matrix_unclassified` |
| 2019-09-09 | 2019-09-03 | `not_in_matrix_unclassified` |
| 2019-09-16 | 2019-09-10 | `not_in_matrix_unclassified` |
| 2019-09-23 | 2019-09-17 | `not_in_matrix_unclassified` |
| 2019-09-30 | 2019-09-24 | `not_in_matrix_unclassified` |
| 2019-10-07 | 2019-10-01 | `not_in_matrix_unclassified` |
| 2019-10-14 | 2019-10-08 | `not_in_matrix_unclassified` |
| 2019-10-21 | 2019-10-15 | `not_in_matrix_unclassified` |
| 2019-10-28 | 2019-10-22 | `not_in_matrix_unclassified` |
| 2020-03-09 | 2020-03-03 | `not_in_matrix_unclassified` |
| 2020-03-16 | 2020-03-10 | `not_in_matrix_unclassified` |
| 2020-03-23 | 2020-03-17 | `not_in_matrix_unclassified` |
| 2020-03-30 | 2020-03-24 | `not_in_matrix_unclassified` |
| 2020-04-06 | 2020-03-31 | `not_in_matrix_unclassified` |
| 2020-04-13 | 2020-04-07 | `not_in_matrix_unclassified` |
| 2020-04-20 | 2020-04-14 | `not_in_matrix_unclassified` |
| 2020-04-27 | 2020-04-21 | `not_in_matrix_unclassified` |
| 2020-05-04 | 2020-04-28 | `not_in_matrix_unclassified` |
| 2020-05-11 | 2020-05-05 | `not_in_matrix_unclassified` |
| 2020-05-18 | 2020-05-12 | `not_in_matrix_unclassified` |
| 2020-05-25 | 2020-05-19 | `not_in_matrix_unclassified` |
| 2020-06-01 | 2020-05-26 | `not_in_matrix_unclassified` |
| 2020-06-08 | 2020-06-02 | `not_in_matrix_unclassified` |
| 2020-06-15 | 2020-06-09 | `not_in_matrix_unclassified` |
| 2020-06-22 | 2020-06-16 | `not_in_matrix_unclassified` |
| 2020-06-29 | 2020-06-23 | `not_in_matrix_unclassified` |
| 2020-07-06 | 2020-06-30 | `not_in_matrix_unclassified` |
| 2020-07-13 | 2020-07-07 | `not_in_matrix_unclassified` |
| 2020-07-20 | 2020-07-14 | `not_in_matrix_unclassified` |
| 2020-07-27 | 2020-07-21 | `not_in_matrix_unclassified` |
| 2020-08-03 | 2020-07-28 | `not_in_matrix_unclassified` |
| 2020-08-10 | 2020-08-04 | `not_in_matrix_unclassified` |
| 2020-08-17 | 2020-08-11 | `not_in_matrix_unclassified` |
| 2020-08-24 | 2020-08-18 | `not_in_matrix_unclassified` |
| 2020-08-31 | 2020-08-25 | `not_in_matrix_unclassified` |
| 2020-09-07 | 2020-09-01 | `not_in_matrix_unclassified` |
| 2020-09-14 | 2020-09-08 | `not_in_matrix_unclassified` |
| 2020-09-21 | 2020-09-15 | `not_in_matrix_unclassified` |
| 2020-09-28 | 2020-09-22 | `not_in_matrix_unclassified` |
| 2020-10-05 | 2020-09-29 | `not_in_matrix_unclassified` |
| 2020-10-12 | 2020-10-06 | `not_in_matrix_unclassified` |
| 2020-10-19 | 2020-10-13 | `not_in_matrix_unclassified` |
| 2020-10-26 | 2020-10-20 | `not_in_matrix_unclassified` |
| 2021-03-15 | 2021-03-09 | `not_in_matrix_unclassified` |
| 2021-03-22 | 2021-03-16 | `not_in_matrix_unclassified` |
| 2021-03-29 | 2021-03-23 | `not_in_matrix_unclassified` |
| 2021-04-05 | 2021-03-30 | `not_in_matrix_unclassified` |
| 2021-04-12 | 2021-04-06 | `not_in_matrix_unclassified` |
| 2021-04-19 | 2021-04-13 | `not_in_matrix_unclassified` |
| 2021-04-26 | 2021-04-20 | `not_in_matrix_unclassified` |
| 2021-05-03 | 2021-04-27 | `not_in_matrix_unclassified` |
| 2021-05-10 | 2021-05-04 | `not_in_matrix_unclassified` |
| 2021-05-17 | 2021-05-11 | `not_in_matrix_unclassified` |
| 2021-05-24 | 2021-05-18 | `not_in_matrix_unclassified` |
| 2021-05-31 | 2021-05-25 | `not_in_matrix_unclassified` |
| 2021-06-07 | 2021-06-01 | `not_in_matrix_unclassified` |
| 2021-06-14 | 2021-06-08 | `not_in_matrix_unclassified` |
| 2021-06-21 | 2021-06-15 | `not_in_matrix_unclassified` |
| 2021-06-28 | 2021-06-22 | `not_in_matrix_unclassified` |
| 2021-07-05 | 2021-06-29 | `not_in_matrix_unclassified` |
| 2021-07-12 | 2021-07-06 | `not_in_matrix_unclassified` |
| 2021-07-19 | 2021-07-13 | `not_in_matrix_unclassified` |
| 2021-07-26 | 2021-07-20 | `not_in_matrix_unclassified` |
| 2021-08-02 | 2021-07-27 | `not_in_matrix_unclassified` |
| 2021-08-09 | 2021-08-03 | `not_in_matrix_unclassified` |
| 2021-08-16 | 2021-08-10 | `not_in_matrix_unclassified` |
| 2021-08-23 | 2021-08-17 | `not_in_matrix_unclassified` |
| 2021-08-30 | 2021-08-24 | `not_in_matrix_unclassified` |
| 2021-09-06 | 2021-08-31 | `not_in_matrix_unclassified` |
| 2021-09-13 | 2021-09-07 | `not_in_matrix_unclassified` |
| 2021-09-20 | 2021-09-14 | `not_in_matrix_unclassified` |
| 2021-09-27 | 2021-09-21 | `not_in_matrix_unclassified` |
| 2021-10-04 | 2021-09-28 | `not_in_matrix_unclassified` |
| 2021-10-11 | 2021-10-05 | `not_in_matrix_unclassified` |
| 2021-10-18 | 2021-10-12 | `not_in_matrix_unclassified` |
| 2021-10-25 | 2021-10-19 | `not_in_matrix_unclassified` |
| 2021-11-01 | 2021-10-26 | `not_in_matrix_unclassified` |
| 2022-03-14 | 2022-03-08 | `not_in_matrix_unclassified` |
| 2022-03-21 | 2022-03-15 | `not_in_matrix_unclassified` |
| 2022-03-28 | 2022-03-22 | `not_in_matrix_unclassified` |
| 2022-04-04 | 2022-03-29 | `not_in_matrix_unclassified` |
| 2022-04-11 | 2022-04-05 | `not_in_matrix_unclassified` |
| 2022-04-18 | 2022-04-12 | `not_in_matrix_unclassified` |
| 2022-04-25 | 2022-04-19 | `not_in_matrix_unclassified` |
| 2022-05-02 | 2022-04-26 | `not_in_matrix_unclassified` |
| 2022-05-09 | 2022-05-03 | `not_in_matrix_unclassified` |
| 2022-05-16 | 2022-05-10 | `not_in_matrix_unclassified` |
| 2022-05-23 | 2022-05-17 | `not_in_matrix_unclassified` |
| 2022-05-30 | 2022-05-24 | `not_in_matrix_unclassified` |
| 2022-06-06 | 2022-05-31 | `not_in_matrix_unclassified` |
| 2022-06-13 | 2022-06-07 | `not_in_matrix_unclassified` |
| 2022-06-20 | 2022-06-14 | `not_in_matrix_unclassified` |
| 2022-06-27 | 2022-06-21 | `not_in_matrix_unclassified` |
| 2022-07-04 | 2022-06-28 | `not_in_matrix_unclassified` |
| 2022-07-11 | 2022-07-05 | `not_in_matrix_unclassified` |
| 2022-07-18 | 2022-07-12 | `not_in_matrix_unclassified` |
| 2022-07-25 | 2022-07-19 | `not_in_matrix_unclassified` |
| 2022-08-01 | 2022-07-26 | `not_in_matrix_unclassified` |
| 2022-08-08 | 2022-08-02 | `not_in_matrix_unclassified` |
| 2022-08-15 | 2022-08-09 | `not_in_matrix_unclassified` |
| 2022-08-22 | 2022-08-16 | `not_in_matrix_unclassified` |
| 2022-08-29 | 2022-08-23 | `not_in_matrix_unclassified` |
| 2022-09-05 | 2022-08-30 | `not_in_matrix_unclassified` |
| 2022-09-12 | 2022-09-06 | `not_in_matrix_unclassified` |
| 2022-09-19 | 2022-09-13 | `not_in_matrix_unclassified` |
| 2022-09-26 | 2022-09-20 | `not_in_matrix_unclassified` |
| 2022-10-03 | 2022-09-27 | `not_in_matrix_unclassified` |
| 2022-10-10 | 2022-10-04 | `not_in_matrix_unclassified` |
| 2022-10-17 | 2022-10-11 | `not_in_matrix_unclassified` |
| 2022-10-24 | 2022-10-18 | `not_in_matrix_unclassified` |
| 2022-10-31 | 2022-10-25 | `not_in_matrix_unclassified` |
| 2023-03-13 | 2023-03-07 | `not_in_matrix_unclassified` |
| 2023-03-20 | 2023-03-14 | `not_in_matrix_unclassified` |
| 2023-03-27 | 2023-03-21 | `not_in_matrix_unclassified` |
| 2023-04-03 | 2023-03-28 | `not_in_matrix_unclassified` |
| 2023-04-10 | 2023-04-04 | `not_in_matrix_unclassified` |
| 2023-04-17 | 2023-04-11 | `not_in_matrix_unclassified` |
| 2023-04-24 | 2023-04-18 | `not_in_matrix_unclassified` |
| 2023-05-01 | 2023-04-25 | `not_in_matrix_unclassified` |
| 2023-05-08 | 2023-05-02 | `not_in_matrix_unclassified` |
| 2023-05-15 | 2023-05-09 | `not_in_matrix_unclassified` |
| 2023-05-22 | 2023-05-16 | `not_in_matrix_unclassified` |
| 2023-05-29 | 2023-05-23 | `not_in_matrix_unclassified` |
| 2023-06-05 | 2023-05-30 | `not_in_matrix_unclassified` |
| 2023-06-12 | 2023-06-06 | `not_in_matrix_unclassified` |
| 2023-06-19 | 2023-06-13 | `not_in_matrix_unclassified` |
| 2023-06-26 | 2023-06-20 | `not_in_matrix_unclassified` |
| 2023-07-03 | 2023-06-27 | `not_in_matrix_unclassified` |
| 2023-07-10 | 2023-07-04 | `not_in_matrix_unclassified` |
| 2023-07-17 | 2023-07-11 | `not_in_matrix_unclassified` |
| 2023-07-24 | 2023-07-18 | `not_in_matrix_unclassified` |
| 2023-07-31 | 2023-07-25 | `not_in_matrix_unclassified` |
| 2023-08-07 | 2023-08-01 | `not_in_matrix_unclassified` |
| 2023-08-14 | 2023-08-08 | `not_in_matrix_unclassified` |
| 2023-08-21 | 2023-08-15 | `not_in_matrix_unclassified` |
| 2023-08-28 | 2023-08-22 | `not_in_matrix_unclassified` |
| 2023-09-04 | 2023-08-29 | `not_in_matrix_unclassified` |
| 2023-09-11 | 2023-09-05 | `not_in_matrix_unclassified` |
| 2023-09-18 | 2023-09-12 | `not_in_matrix_unclassified` |
| 2023-09-25 | 2023-09-19 | `not_in_matrix_unclassified` |
| 2023-10-02 | 2023-09-26 | `not_in_matrix_unclassified` |
| 2023-10-09 | 2023-10-03 | `not_in_matrix_unclassified` |
| 2023-10-16 | 2023-10-10 | `not_in_matrix_unclassified` |
| 2023-10-23 | 2023-10-17 | `not_in_matrix_unclassified` |
| 2023-10-30 | 2023-10-24 | `not_in_matrix_unclassified` |
| 2024-01-01 | 2023-12-26 | `not_in_matrix_unclassified` |
| 2024-03-11 | 2024-03-05 | `not_in_matrix_unclassified` |
| 2024-03-18 | 2024-03-12 | `not_in_matrix_unclassified` |
| 2024-03-25 | 2024-03-19 | `not_in_matrix_unclassified` |
| 2024-04-01 | 2024-03-26 | `not_in_matrix_unclassified` |
| 2024-04-08 | 2024-04-02 | `not_in_matrix_unclassified` |
| 2024-04-15 | 2024-04-09 | `not_in_matrix_unclassified` |
| 2024-04-22 | 2024-04-16 | `not_in_matrix_unclassified` |
| 2024-04-29 | 2024-04-23 | `not_in_matrix_unclassified` |
| 2024-05-06 | 2024-04-30 | `not_in_matrix_unclassified` |
| 2024-05-13 | 2024-05-07 | `not_in_matrix_unclassified` |
| 2024-05-20 | 2024-05-14 | `not_in_matrix_unclassified` |
| 2024-05-27 | 2024-05-21 | `not_in_matrix_unclassified` |
| 2024-06-03 | 2024-05-28 | `not_in_matrix_unclassified` |
| 2024-06-10 | 2024-06-04 | `not_in_matrix_unclassified` |
| 2024-06-17 | 2024-06-11 | `not_in_matrix_unclassified` |
| 2024-06-24 | 2024-06-18 | `not_in_matrix_unclassified` |
| 2024-07-01 | 2024-06-25 | `not_in_matrix_unclassified` |
| 2024-07-08 | 2024-07-02 | `not_in_matrix_unclassified` |
| 2024-07-15 | 2024-07-09 | `not_in_matrix_unclassified` |
| 2024-07-22 | 2024-07-16 | `not_in_matrix_unclassified` |
| 2024-07-29 | 2024-07-23 | `not_in_matrix_unclassified` |
| 2024-08-05 | 2024-07-30 | `not_in_matrix_unclassified` |
| 2024-08-12 | 2024-08-06 | `not_in_matrix_unclassified` |
| 2024-08-19 | 2024-08-13 | `not_in_matrix_unclassified` |
| 2024-08-26 | 2024-08-20 | `not_in_matrix_unclassified` |
| 2024-09-02 | 2024-08-27 | `not_in_matrix_unclassified` |
| 2024-09-09 | 2024-09-03 | `not_in_matrix_unclassified` |
| 2024-09-16 | 2024-09-10 | `not_in_matrix_unclassified` |
| 2024-09-23 | 2024-09-17 | `not_in_matrix_unclassified` |
| 2024-09-30 | 2024-09-24 | `not_in_matrix_unclassified` |
| 2024-10-07 | 2024-10-01 | `not_in_matrix_unclassified` |
| 2024-10-14 | 2024-10-08 | `not_in_matrix_unclassified` |
| 2024-10-21 | 2024-10-15 | `not_in_matrix_unclassified` |
| 2024-10-28 | 2024-10-22 | `not_in_matrix_unclassified` |
| 2024-12-23 | 2024-12-17 | `not_in_matrix_unclassified` |
| 2024-12-30 | 2024-12-24 | `not_in_matrix_unclassified` |
| 2025-03-10 | 2025-03-04 | `not_in_matrix_unclassified` |
| 2025-03-17 | 2025-03-11 | `not_in_matrix_unclassified` |
| 2025-03-24 | 2025-03-18 | `not_in_matrix_unclassified` |
| 2025-03-31 | 2025-03-25 | `not_in_matrix_unclassified` |
| 2025-04-07 | 2025-04-01 | `not_in_matrix_unclassified` |
| 2025-04-14 | 2025-04-08 | `not_in_matrix_unclassified` |
| 2025-04-21 | 2025-04-15 | `not_in_matrix_unclassified` |
| 2025-04-28 | 2025-04-22 | `not_in_matrix_unclassified` |
| 2025-05-05 | 2025-04-29 | `not_in_matrix_unclassified` |
| 2025-05-12 | 2025-05-06 | `not_in_matrix_unclassified` |
| 2025-05-19 | 2025-05-13 | `not_in_matrix_unclassified` |
| 2025-05-26 | 2025-05-20 | `not_in_matrix_unclassified` |
| 2025-06-02 | 2025-05-27 | `not_in_matrix_unclassified` |
| 2025-06-09 | 2025-06-03 | `not_in_matrix_unclassified` |
| 2025-06-16 | 2025-06-10 | `not_in_matrix_unclassified` |
| 2025-06-23 | 2025-06-17 | `not_in_matrix_unclassified` |
| 2025-06-30 | 2025-06-24 | `not_in_matrix_unclassified` |
| 2025-07-07 | 2025-07-01 | `not_in_matrix_unclassified` |
| 2025-07-14 | 2025-07-08 | `not_in_matrix_unclassified` |
| 2025-07-21 | 2025-07-15 | `not_in_matrix_unclassified` |
| 2025-07-28 | 2025-07-22 | `not_in_matrix_unclassified` |
| 2025-08-04 | 2025-07-29 | `not_in_matrix_unclassified` |
| 2025-08-11 | 2025-08-05 | `not_in_matrix_unclassified` |
| 2025-08-18 | 2025-08-12 | `not_in_matrix_unclassified` |
| 2025-08-25 | 2025-08-19 | `not_in_matrix_unclassified` |
| 2025-09-01 | 2025-08-26 | `not_in_matrix_unclassified` |
| 2025-09-08 | 2025-09-02 | `not_in_matrix_unclassified` |
| 2025-09-15 | 2025-09-09 | `not_in_matrix_unclassified` |
| 2025-09-22 | 2025-09-16 | `not_in_matrix_unclassified` |
| 2025-09-29 | 2025-09-23 | `not_in_matrix_unclassified` |
| 2025-10-06 | 2025-09-30 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-10-13 | 2025-10-07 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-10-20 | 2025-10-14 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-10-27 | 2025-10-21 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-03 | 2025-10-28 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-10 | 2025-11-04 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-17 | 2025-11-11 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-11-24 | 2025-11-18 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-01 | 2025-11-25 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-08 | 2025-12-02 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-15 | 2025-12-09 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-22 | 2025-12-16 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2025-12-29 | 2025-12-23 | `not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix` |
| 2026-03-09 | 2026-03-03 | `not_in_matrix_unclassified` |
| 2026-03-16 | 2026-03-10 | `not_in_matrix_unclassified` |
| 2026-03-23 | 2026-03-17 | `not_in_matrix_unclassified` |
| 2026-03-30 | 2026-03-24 | `not_in_matrix_unclassified` |
| 2026-04-06 | 2026-03-31 | `not_in_matrix_unclassified` |
| 2026-04-13 | 2026-04-07 | `not_in_matrix_unclassified` |
| 2026-04-20 | 2026-04-14 | `not_in_matrix_unclassified` |
| 2026-04-27 | 2026-04-21 | `not_in_matrix_unclassified` |
| 2026-05-04 | 2026-04-28 | `not_in_matrix_unclassified` |
| 2026-05-11 | 2026-05-05 | `not_in_matrix_unclassified` |
| 2026-05-18 | 2026-05-12 | `not_in_matrix_unclassified` |
| 2026-05-25 | 2026-05-19 | `not_in_matrix_unclassified` |
| 2026-06-01 | 2026-05-26 | `not_in_matrix_unclassified` |

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

- JSON: app\reports\data-verification\macro-regime\gate54f-standalone-signal-baselines-20260624T020443Z.json
- Markdown: app\reports\data-verification\macro-regime\gate54f-standalone-signal-baselines-20260624T020443Z.md
- Docs copy: docs/research/GATE54F_STANDALONE_SIGNAL_BASELINES_AND_SOURCE_AVAILABILITY_2026-06-23.md

Receipt hash: `14FE841C7A030C03DFDBD854B699806DA1EAD1C5AABA90A574CC41F03780217B`

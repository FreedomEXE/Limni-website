# Gate 54C Controlled No-Write Matrix Identity Reconstruction Proof

Date: 2026-06-23

Status: `PASS_MATRIX_IDENTITY_RECONSTRUCTED_WITH_SOURCE_COVERAGE_CAVEATS`

## Objective

Because the original weekly ADR/Grid JSON receipt lineage was not preserved
locally, Gate 54C reconstructs the Gate 44 matrix identity from current stored
warehouse records and tracked Gate 44 summary lineage.

This is controlled reconstruction, not original receipt recovery.

## Hard Scope

Authorized:

- read current warehouse records;
- compare locked Gate 44 dataset ID/hash/counts;
- classify source and coverage gaps;
- preserve blockers.

Not authorized:

- source mutation;
- warehouse writes;
- M1 backfill;
- outcome grids;
- selector testing or comparison;
- BPR/RRP retesting;
- system selection.

## Read-Only Proof Command

Execution mode:

```text
PostgreSQL transaction: BEGIN READ ONLY
source mutation: none
warehouse mutation: none
helper file written: none
```

The proof queried:

```text
research_matrix_datasets
research_matrix_source_contexts
research_matrix_trade_opportunities
research_matrix_variant_runs
research_matrix_pair_decisions
research_matrix_variant_week_results
research_matrix_trade_events
research_matrix_stop_events
```

## Locked Matrix Identity

Expected Gate 44 identity:

```text
dataset_id:   479624d1-f6a2-4928-82f1-981137762bdc
dataset_hash: cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
```

Warehouse readback:

```text
dataset_id:      479624d1-f6a2-4928-82f1-981137762bdc
dataset_version: research_matrix_dataset_v1
dataset_hash:    cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
asset_class:     fx
from_utc:        2019-01-07 00:00:00+00
to_utc:          2026-06-12 15:00:00+00
universe_count:  28
status:          complete
```

Decision:

```text
locked_gate44_matrix_identity = matched
```

## Source And Execution Versions

Source versions:

```json
{
  "cotModes": [
    "cot_faces_v1_forced",
    "cot_faces_v1_commercial_delta_contrarian"
  ],
  "strengthModes": [
    "strength_open_canonical",
    "strength_friday_snapshot"
  ],
  "sourceContextNeeds": {
    "cot": true,
    "appSource": true,
    "openStrength": true,
    "fridayStrength": true
  }
}
```

Execution versions:

```json
{
  "logicVersion": "fx_hedged_adr_grid_matrix_v1",
  "sourceScript": "audit-fx-hedged-adr-grid-side-selectors",
  "pathResolution": "1m",
  "tradeEventVariantIds": [],
  "tradeEventPersistenceMode": "none"
}
```

## Persisted Count Reconstruction

Expected Gate 44 broad matrix:

```text
weeks:                372
pairs:                 28
source_contexts:   10,416
trade_opportunities: 222,769
variant_runs:          35
pair_decisions:    364,560
variant_week_results: 13,020
trade_events:           0
stop_events:            0
```

Warehouse readback:

```text
weeks:                372
pairs:                 28
source_contexts:   10,416
trade_opportunities: 222,769
variant_runs:          35
pair_decisions:    364,560
variant_week_results: 13,020
trade_events:           0
stop_events:            0
```

Range:

```text
min_week_open_utc: 2019-01-07 00:00:00+00
max_week_open_utc: 2026-06-07 23:00:00+00
```

Decision:

```text
matrix_shape_and_persisted_counts = matched
```

## Source Context Coverage

Rows:

```text
source_context_rows: 10,416
```

Direction coverage:

```text
dealer directional:                 10,332
commercial directional:             10,332
cot faces directional:              10,332
commercial-delta directional:       10,332
Friday Strength directional:        10,292
market-open Strength directional:    9,261
```

Missing rows:

```text
dealer missing:                   0
commercial missing:               0
cot faces missing:               84
commercial-delta missing:        84
Friday Strength missing:        124
market-open Strength missing: 1,155
```

Missing source rows by year:

| Year | Rows | Weeks | COT Faces Missing | Commercial-Delta Missing | Friday Strength Missing | Market-Open Strength Missing |
|---:|---:|---:|---:|---:|---:|---:|
| 2019 | 1,456 | 52 | 28 | 28 | 111 | 635 |
| 2020 | 1,456 | 52 | 28 | 28 | 13 | 58 |
| 2021 | 1,456 | 52 | 0 | 0 | 0 | 378 |
| 2022 | 1,456 | 52 | 0 | 0 | 0 | 28 |
| 2023 | 1,456 | 52 | 28 | 28 | 0 | 56 |
| 2024 | 1,400 | 50 | 0 | 0 | 0 | 0 |
| 2025 | 1,092 | 39 | 0 | 0 | 0 | 0 |
| 2026 | 644 | 23 | 0 | 0 | 0 | 0 |

COT missing weeks:

```text
2019-01-07: 28 rows
2020-12-28: 28 rows
2023-07-09: 28 rows
```

Read:

The locked matrix identity is present, but it is not full source-clean coverage.
Older market-open Strength is materially patchy, and COT-derived face contexts
have the known 84-row gap. This does not break identity reconstruction, but it
does block any blanket "full-window source-ready" claim.

## ADR And Contribution Coverage

Trade opportunities:

```text
rows:                  222,769
weeks:                     372
pairs:                      28
invalid_pair_adr_rows:       0
null_raw_return_rows:        0
null_adr_return_rows:        0
min_pair_adr_pct:      0.21559
max_pair_adr_pct:      4.238343
```

Variant week contribution coverage:

```text
rows:                             13,020
empty_pair_contribution_rows:        393
empty_currency_contribution_rows:    393
empty_exit_count_rows:                 0
```

Read:

The reusable trade-opportunity layer has valid ADR and return fields across all
stored rows. Contribution fields are not universally populated; 393 variant-week
rows have empty pair/currency contribution maps. Those rows require attribution
classification before contribution-level promotion.

## JSON Context Field Coverage

Source timestamp keys:

```text
fridayStrength:     10,416 rows
marketOpenStrength: 10,416 rows
```

Coverage keys:

```text
dealerDirectional:                 10,416 rows
commercialDirectional:             10,416 rows
cotFacesDirectional:               10,416 rows
commercialDeltaCotDirectional:     10,416 rows
fridayStrengthDirectional:         10,416 rows
marketOpenStrengthDirectional:     10,416 rows
```

Source score keys:

```text
none
```

Flag keys:

```text
none
```

Read:

The matrix stores explicit boolean coverage fields for the relevant source
contexts. Missing contexts are query-visible rather than silently dropped.

## M1 Classification

No M1 backfill was run in Gate 54C.

Gate 44 unified local M1 coverage through latest display week `2026-06-08`:

| Year | Weeks | Rows | Complete | Partial | Missing | Lowest Coverage |
|---:|---:|---:|---:|---:|---:|---:|
| 2019 | 52 | 1,456 | 1,126 | 330 | 0 | 46.58% |
| 2020 | 52 | 1,456 | 1,303 | 153 | 0 | 67.97% |
| 2021 | 52 | 1,456 | 1,340 | 116 | 0 | 69.47% |
| 2022 | 52 | 1,456 | 1,420 | 36 | 0 | 77.69% |
| 2023 | 52 | 1,456 | 1,428 | 28 | 0 | 73.71% |
| 2024 | 53 | 1,484 | 1,400 | 84 | 0 | 73.96% |
| 2025 | 52 | 1,456 | 1,398 | 58 | 0 | 71.83% |
| 2026 | 23 | 644 | 643 | 1 | 0 | 88.53% |

Current Gate 54B narrowed-window classification:

```text
2025-12-29 prior-freeze week: 28/28 partial
2026-02-16 CADCHF: partial, coveragePct=88.53, expectedBars=7200, actualBars=6374
```

Read:

M1 is classified, not repaired. Gate 44 reports `0` missing local M1
symbol-weeks across 2019-2026, with remaining partial rows carried as
market/holiday/provider coverage facts. Gate 54C does not convert those
partials into source-clean rows.

## Lineage Boundary

Original receipt status from Gate 54B:

```text
original weekly ADR/Grid JSON receipts: not preserved locally
matrix summary Markdown lineage: partially preserved
```

Gate 54C status:

```text
controlled reconstruction proof: passed for locked matrix identity
original receipt recovery: failed / not applicable
```

This proof must not be described as original lineage preservation.

## Decision

```text
Gate 54C controlled no-write matrix identity reconstruction: PASS WITH CAVEATS
Locked Gate 44 matrix ID/hash: MATCHED
Warehouse counts: MATCHED
372-week / 28-pair shape: MATCHED
Source versions: PRESENT
Execution versions: PRESENT
COT/Strength source coverage: EXPLICIT BUT NOT FULL CLEAN
ADR trade-opportunity coverage: PASS
Contribution-map coverage: PARTIAL, 393 empty pair/currency contribution rows
M1 gaps: CLASSIFIED, NOT BACKFILLED
Original receipt lineage: NOT RECOVERED
Legacy baseline source readiness: NOT YET
System selection: NOT AUTHORIZED
Optimization: PAUSED
```

Gate 54 can continue because the frozen matrix warehouse identity is
reconstructably trustworthy enough for further source-contract hardening.

Gate 54 cannot yet select a final system because source coverage caveats,
original receipt lineage gaps, contribution-map gaps, and selector-output hashes
remain unresolved.

## Next Authorized Work

Next narrow Gate 54 step:

```text
Gate 54D: Legacy Signal Source Contract Proof
```

Scope:

- COT report date/source contract proof for the 372-week matrix window;
- COT gap classification for `2019-01-07`, `2020-12-28`, and `2023-07-09`;
- Friday/open Strength source contract proof;
- confirm whether candidate Signal Model selection must use full-window clean
  rows, clean-window rows, or availability-aware rows;
- no outcome grid, no system selection, no optimization.

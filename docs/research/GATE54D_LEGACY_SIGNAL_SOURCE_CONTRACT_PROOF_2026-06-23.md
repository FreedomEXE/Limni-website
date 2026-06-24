# Gate 54D: Legacy Signal Source Contract Proof

Date: 2026-06-23

## Decision

Gate 54D result: `PASS_SOURCE_CONTRACTS_DEFINED_WITH_COVERAGE_CAVEATS`

Legacy Signal source readiness: `CONTRACT_DEFINED_NOT_FULLY_SOURCE_PROMOTED`

System selection: `NOT AUTHORIZED`

Optimization: `PAUSED`

Outcome grid: `NOT RUN`

BPR/RRP retest: `NOT RUN`

Source mutation: `NOT PERFORMED`

This receipt proves that the legacy COT and Strength signal inputs behind the
locked Gate 44 matrix are contract-defined, hashable, and reconstructable enough
for a later controlled Signal Model evaluation. It does not prove Gate-50-grade
source promotion, and it does not select a final Signal Model.

## Scope

Allowed:

- COT source contract proof.
- Strength source contract proof.
- CLP, SFA, and FSA selector contract definitions.
- Selector/source output hashes against the locked Gate 44 matrix.
- Missing/degraded-source handling classification.
- Read-only warehouse inspection.

Not allowed and not performed:

- No source refetch.
- No source rebuild.
- No database writes.
- No ADR Grid rerun.
- No outcome optimization.
- No outcome grid.
- No BPR or RRP retest.
- No system selection.
- No live, production, or promotion claim.

## Locked Matrix Baseline

Gate 54D uses Gate 54C as the matrix identity baseline.

```text
matrixDatasetId:   479624d1-f6a2-4928-82f1-981137762bdc
matrixDatasetHash: cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
datasetVersion:    research_matrix_dataset_v1
status:            complete
weeks:             372
pairs:             28
sourceContexts:    10,416
variantRuns:       35
```

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

Execution identity:

```json
{
  "logicVersion": "fx_hedged_adr_grid_matrix_v1",
  "sourceScript": "audit-fx-hedged-adr-grid-side-selectors",
  "pathResolution": "1m",
  "tradeEventVariantIds": [],
  "tradeEventPersistenceMode": "none"
}
```

## Read-Only Proof Controls

The Gate 54D probes used explicit `BEGIN READ ONLY` database transactions and
read only the existing warehouse/source tables. No helper script was added and no
receipt was written under `app/reports/`.

Read-only proof status:

```text
matrix/source/selector probe: PASS
CLP source-state overlay probe: PASS
database writes: 0
source refetch: 0
source rebuild: 0
execution rerun: 0
```

## COT Contract

COT source owners inspected:

- `app/src/lib/cotFetch.ts`
- `app/src/lib/cotStore.ts`
- `app/src/lib/dataSectionWeeks.ts`
- `app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts`

Contract definition:

```text
dealer source:       CFTC TFF Socrata dataset gpe5-46if
commercial source:   CFTC legacy futures-only Socrata dataset 6dca-aqww for FX
variant:             futures-only / combined field selected by COT_VARIANT
week mapping:         deriveCotReportDate(weekOpenUtc)
mapping rule:         week open in New York minus 5 calendar days
matrix modes:         cot_faces_v1_forced, cot_faces_v1_commercial_delta_contrarian
```

Point-in-time classification:

```text
timing rule defined: yes
exact publication receipt lineage: not Gate-50-grade
source refetch in Gate 54D: no
missing handling: explicit unavailable/exclusion rows
silent neutralization: no evidence in matrix decisions
```

COT source-context hash:

```text
cotSourceContextHash: CC82BD241C4E7FA3D7517FF2223A9A8DF57497F0D10CFE928C8B4BE787ECB4BC
```

COT matrix coverage:

| Field | Directional | Missing/neutral | Rows |
|---|---:|---:|---:|
| `cot_faces_direction` | 10,332 | 84 | 10,416 |
| `commercial_delta_cot_direction` | 10,332 | 84 | 10,416 |
| `dealer_direction` | 10,332 | 84 | 10,416 |
| `commercial_direction` | 10,332 | 84 | 10,416 |

COT missing/degraded rows are concentrated in three full 28-pair weeks:

```text
2019-01-07T00:00:00.000Z
2020-12-28T00:00:00.000Z
2023-07-09T23:00:00.000Z
```

Year summary:

| Year | Rows | COT faces missing/neutral | Commercial-delta missing/neutral |
|---:|---:|---:|---:|
| 2019 | 1,456 | 28 | 28 |
| 2020 | 1,456 | 28 | 28 |
| 2021 | 1,456 | 0 | 0 |
| 2022 | 1,456 | 0 | 0 |
| 2023 | 1,456 | 28 | 28 |
| 2024 | 1,400 | 0 | 0 |
| 2025 | 1,092 | 0 | 0 |
| 2026 | 644 | 0 | 0 |

## Strength Contract

Strength source owners inspected:

- `app/src/lib/strength/historicalStrength.ts`
- `app/src/lib/strength/weeklyStrength.ts`
- `app/src/lib/strength/canonicalDirection.ts`
- `app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts`

Contract definition:

```text
strength_friday_snapshot:
  latest 1h/4h/24h strength snapshot at or before Friday 17:00 New York

strength_open_canonical:
  Gate 43 M1-backed market-open confirmation context
  resolved from FX market-truth open
  separate from the later execution window
  marketOpenForwardMinutes = 180 in the matrix source builder

derivationVersion:
  fx_m1_currency_strength_v1
```

Point-in-time classification:

```text
Friday timing rule defined: yes
market-open timing rule defined: yes
source refetch in Gate 54D: no
missing handling: explicit unavailable/exclusion rows
silent neutralization: no evidence in matrix decisions
```

Strength source-context hash:

```text
strengthSourceContextHash: DB1D66B7D553140125ABF88BBCD4D7151A49ADF151ADFC1606E43B8B16E58A5A
combinedSourceContextHash: 328E8C12E3256C833D74340A90E26EA8329044F253C915CC70CA051D46489736
```

Strength matrix coverage:

| Field | Directional | Missing/neutral | Rows |
|---|---:|---:|---:|
| `friday_strength_direction` | 10,292 | 124 | 10,416 |
| `market_open_strength_direction` | 9,261 | 1,155 | 10,416 |

Year summary:

| Year | Rows | Friday Strength missing/neutral | Open-canonical Strength missing/neutral |
|---:|---:|---:|---:|
| 2019 | 1,456 | 111 | 635 |
| 2020 | 1,456 | 13 | 58 |
| 2021 | 1,456 | 0 | 378 |
| 2022 | 1,456 | 0 | 28 |
| 2023 | 1,456 | 0 | 56 |
| 2024 | 1,400 | 0 | 0 |
| 2025 | 1,092 | 0 | 0 |
| 2026 | 644 | 0 | 0 |

## Selector Contracts

### CLP

Label: `COT Lifecycle Polarity`

Selector ID: `cot_lifecycle_polarity_v0_noncomm_primary`

Classification:

```text
contract status: source-state overlay contract-defined
stored Gate 44 variant: no
execution harness: cot_faces_v1_commercial_delta_contrarian_selected
full-window eligible: no
valid-window eligible: yes
benchmark/promoted selector: no promotion claim
```

Formula:

```text
TEI = (noncomm_percentile + (100 - commercial_percentile) + (100 - dealer_percentile)) / 3
selected-side spread = long_currency_TEI - short_currency_TEI
negative spread = selected side fades crowded/exhausted spread
positive spread = selected side goes with crowded/exhausted spread
```

CLP read-only reconstruction:

```text
formulaVersion:              gate46_gate51_noncomm_primary_tei_v1
lifecycleLookback:           156 COT reports
lifecycleFirstReportDate:    2021-12-28
lifecycleReportCount:        234
lifecycleCurrencyStateRows:  1,872
missingMetricWindows:        0
selectedRows:                10,332
computedRows:                6,020
expectedWarmupRows:          4,312
trueMissingLifecycleRows:    0
denominatorImpactPct:        41.7344
missingRowsNeutralized:      false
missingRowsImputed:          false
missingRowsUnavailable:      true
```

CLP source-state hash:

```text
clpSourceStateHash: DB4A9FCD04F843C88169E1A711B4D7D7B06178C06B04EFDCD7B74D2367CD8FBD
harnessRunResultHash: 926E62A244112167256343A2391073DE2C6842A55A1D043055CA4E0594C35E2A
```

CLP valid-window coverage:

| Year | Selected rows | Computed rows | Warmup rows | True missing lifecycle rows |
|---:|---:|---:|---:|---:|
| 2019 | 1,428 | 0 | 1,428 | 0 |
| 2020 | 1,428 | 0 | 1,428 | 0 |
| 2021 | 1,456 | 0 | 1,456 | 0 |
| 2022 | 1,456 | 1,456 | 0 | 0 |
| 2023 | 1,428 | 1,428 | 0 | 0 |
| 2024 | 1,400 | 1,400 | 0 | 0 |
| 2025 | 1,092 | 1,092 | 0 | 0 |
| 2026 | 644 | 644 | 0 | 0 |

CLP bucket counts, valid rows only:

| Bucket | Rows |
|---|---:|
| `fade_extreme` | 51 |
| `fade_lean` | 681 |
| `neutral_mixed` | 2,703 |
| `with_lean` | 2,233 |
| `with_extreme` | 352 |

CLP decision:

```text
Defined enough for later Signal Model evaluation: YES, valid-window only.
Defined enough for full seven-year system selection: NO.
```

### SFA

Label: `Strength Fade Accord`

Selector ID: `strength_friday_snapshot_open_canonical_fade_agree`

Contract:

```text
friday = strength_friday_snapshot
open = strength_open_canonical
selected side = friday when friday is directional and friday == opposite(open)
missing/degraded rows = unavailable/excluded
non-agreement rows = variant_filter_not_met / friday_open_fade_disagree
```

Stored matrix identity:

```text
runResultHash: 5C3C41CC126F955CEF277A77CAB3AA41075965665C13CBC33CA0A42309A309D6
outputHash:    083B6EEE23F6B69E4E3937A82E6CFD2FC9103BC6C40704BF8637591E5CF0A1E3
```

Coverage:

```text
decisionRows:             10,416
selectedRows:              4,618
excludedRows:              5,798
missingExclusionRows:      1,196
neutralizedRows:               0
nullExclusionRows:             0
imputedRows:                   0
```

Exclusion reasons:

| Reason | Rows |
|---|---:|
| `SELECTED` | 4,618 |
| `friday_open_fade_disagree` | 4,602 |
| `missing_open_canonical_strength` | 1,072 |
| `missing_friday_and_open_strength` | 83 |
| `missing_friday_strength` | 41 |

SFA decision:

```text
Defined enough for later Signal Model evaluation: YES, with explicit unavailable rows.
Defined enough for system selection in Gate 54D: NO.
```

### FSA

Label: `Friday Strength Anchor`

Selector ID: `strength_friday_snapshot_selected`

Contract:

```text
selected side = strength_friday_snapshot when directional
missing/degraded rows = unavailable/excluded
role = benchmark/reporting view only
```

Stored matrix identity:

```text
runResultHash: EDE02332FA990592CE6316B837B4222EF31CBBBD4726433A2F0A712B79C19432
outputHash:    F8BA8079A128606979CEE05F0E373D70957E8CF22B876C88968AAC1292113008
```

Coverage:

```text
decisionRows:             10,416
selectedRows:             10,292
excludedRows:                124
missingExclusionRows:        124
neutralizedRows:               0
nullExclusionRows:             0
imputedRows:                   0
```

Exclusion reasons:

| Reason | Rows |
|---|---:|
| `SELECTED` | 10,292 |
| `missing_strength_friday_snapshot_direction` | 124 |

FSA decision:

```text
Defined enough for later benchmark evaluation: YES.
Defined enough as an optimized/promoted selector: NO.
```

## COT Harness Hashes

These are not final Signal Model selections. They are retained so later review
can distinguish the frozen matrix COT harnesses from CLP.

| Variant | Selected rows | Missing rows | Neutralized rows | Output hash |
|---|---:|---:|---:|---|
| `cot_faces_v1_forced_selected` | 10,332 | 84 | 0 | `617153E093842C5AC56459E6D9A4C3FD9CB4E2CDB0886E0B034C591D3EDDD3F4` |
| `cot_faces_v1_commercial_delta_contrarian_selected` | 10,332 | 84 | 0 | `3E4C380C927A3DEE5A3DC236A55A78B6056F408B85B359759E058860D8BEB00E` |

## Missing, Neutral, Imputed, Fallback Classification

| Surface | Missing/degraded rows | Neutralized rows | Imputed rows | Contract handling |
|---|---:|---:|---:|---|
| COT matrix contexts | 84 per COT mode | 0 in selected COT decisions | 0 detected | Excluded/unavailable |
| Friday Strength contexts | 124 | 0 in FSA decisions | 0 detected | Excluded/unavailable |
| Open Strength contexts | 1,155 | 0 in open-selected decisions | 0 detected | Excluded/unavailable |
| SFA selector | 1,196 missing exclusions | 0 | 0 detected | Missing rows excluded; disagreement rows are filter-not-met |
| CLP overlay | 4,312 expected warmup rows | 0 | 0 detected | Warmup unavailable; valid-window only |

No Gate 54D evidence supports treating missing source as neutral, forward-filled,
or promotion-eligible. Missing and warmup rows remain unavailable.

## Carried Gate 54C Caveats

Gate 54D carries forward the Gate 54C caveats:

- Original ADR/Grid weekly JSON receipt lineage was not recovered.
- Gate 54C reconstructed matrix identity but did not recover original receipt lineage.
- Contribution-map coverage remains partial:

```text
variantWeekRows:                  13,020
emptyPairContributionRows:           393
emptyCurrencyContributionRows:       393
emptyExitCountRows:                    0
```

- M1 gaps remain classified, not backfilled.
- The legacy matrix remains a frozen/reconstructable research artifact, not a
  Gate-50-grade promoted source layer.

The 393 empty contribution rows do not invalidate the signal source contract
hashes above, but they still block final system-selection readiness until their
effect on directional stats and candidate ranking is classified.

## Gate 54D Conclusion

```text
COT availability/coverage:                 CONTRACT_DEFINED_WITH_84_UNAVAILABLE_ROWS
Friday Strength availability/coverage:     CONTRACT_DEFINED_WITH_124_UNAVAILABLE_ROWS
Open Strength availability/coverage:       CONTRACT_DEFINED_WITH_1,155_UNAVAILABLE_ROWS
CLP valid-window coverage:                 VALID_WINDOW_ONLY_6,020_OF_10,332_ROWS
SFA coverage:                              STORED_SELECTOR_4,618_SELECTED_ROWS
FSA coverage:                              STORED_BENCHMARK_10,292_SELECTED_ROWS
Missing rows neutralized:                  NO
Missing rows imputed:                      NO
Selector output hashes:                    RECORDED
System selection readiness:                NOT YET
```

Gate 54D permits a later controlled Signal Model evaluation using these explicit
contracts and availability rules. It does not authorize selecting the final
system, optimizing, or promoting any legacy source stack.

Recommended next gate:

```text
Gate 54E: Legacy Signal Evaluation Readiness Boundary
```

Purpose:

```text
Classify whether the 393 empty contribution rows, COT/Strength unavailable rows,
and CLP valid-window restriction materially affect directional signal stats and
candidate ranking before any final Signal Model selection.
```

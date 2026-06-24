# Gate 54E: Legacy Signal Evaluation Readiness Boundary

Date: 2026-06-23

## Decision

Gate 54E result: `READY_FOR_SIGNAL_EVALUATION_COMMON_MASK_ONLY`

System selection: `NOT AUTHORIZED`

Optimization: `NOT AUTHORIZED`

Outcome grid: `NOT RUN`

Source mutation: `NOT PERFORMED`

BPR/RRP retest: `NOT RUN`

PPP/NEER/REER work: `NOT OPENED`

Gate 54E answers:

```text
Can legacy signal evaluation be run without denominator, coverage, or
attribution distortion?
```

Answer:

```text
Yes, but only under explicit common-mask or valid-window denominators.
Full-window CLP/SFA/FSA comparisons remain unauthorized.
```

Gate 54E does not select a Signal Model. It only defines the evaluation boundary
needed before any later model-selection gate.

## Baseline

Locked matrix:

```text
matrixDatasetId:   479624d1-f6a2-4928-82f1-981137762bdc
matrixDatasetHash: cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
status:            complete
fullMatrixRows:    10,416
weeks:             372
pairs:             28
```

Gate 54D accepted source-contract hashes remain the input boundary. Gate 54E did
not rerun source reconstruction, ADR Grid execution, BPR, RRP, or any macro
source family.

## Read-Only Controls

Gate 54E used read-only warehouse probes:

```text
BEGIN READ ONLY: yes
database writes: 0
source refetch: 0
source rebuild: 0
execution rerun: 0
new verification script: no
```

## Denominator Reconciliation

| Denominator | Rows | Meaning |
|---|---:|---|
| `full_window_mask` | 10,416 | Every Gate 44 pair-week context |
| `cot_available_mask` | 10,332 | Both COT matrix modes directional |
| `strength_friday_available_mask` | 10,292 | Friday Strength directional |
| `strength_open_available_mask` | 9,261 | Open-canonical Strength directional |
| Strength-both available | 9,220 | Friday and open Strength directional |
| `clp_valid_window_mask` | 6,020 | Commercial-delta COT selected and CLP lifecycle available |
| SFA valid source rows | 9,220 | Source contexts where SFA could evaluate Friday/open fade accord |
| FSA valid source rows | 10,292 | Friday Strength directional |
| `common_clp_sfa_fsa_mask` | 5,936 | CLP valid plus Friday/open Strength available |

Hard rule:

```text
No CLP-ranked model may be compared against full-window SFA/FSA stats unless the
comparison uses a common eligible denominator.
```

## Common Masks

| Mask | Rows | Hash |
|---|---:|---|
| `full_window_mask` | 10,416 | `FBBA342D3D44897FCD9695D5AC1773419651B9D40592F1607558416CD03559D4` |
| `cot_available_mask` | 10,332 | `D46E72D700ABDD9858ECF8AFA49FDC4F0515F6D3B66A9C1F952644ABF4CB3567` |
| `strength_friday_available_mask` | 10,292 | `083B77CFC6206DB78F7F830306FE83AD73C1EE731550A440A4F0BFC0C31B3B34` |
| `strength_open_available_mask` | 9,261 | `45DC1C1C1AB76ABD718C2CAC2EB048823F1F65B93A6CCE3377FBE7AA2963CE31` |
| `clp_valid_window_mask` | 6,020 | `413599BEB839E545FED26AC4605B7ADA35E93983E0425F58A7AE6A6E8F53C8A0` |
| `common_clp_sfa_fsa_mask` | 5,936 | `6A1A03A08C122C774D616541F3B926B7AEBBAC113CA39BED92032C7DA0F39BA9` |

Mask definition hash:

```text
gate54eMaskDefinitionHash: 42C467402433FD7365F068D5A99710C48852D82417E0AA32DF12669FC09B16A3
```

## Missingness Concentration

Overall missingness by reason:

| Reason | Rows |
|---|---:|
| `clp_expected_warmup_unavailable` | 4,312 |
| `missing_strength_open_available` | 1,155 |
| `missing_strength_friday_available` | 124 |
| `missing_cot_available` | 84 |

Missingness hash:

```text
gate54eMissingnessHash: 75178239A1FDB14459D4D4AFFDE64C46C59EF3F7EF72C04E581F7D38E6C25CAD
```

### By Year And Reason

| Year / reason | Rows |
|---|---:|
| `2021|clp_expected_warmup_unavailable` | 1,456 |
| `2019|clp_expected_warmup_unavailable` | 1,428 |
| `2020|clp_expected_warmup_unavailable` | 1,428 |
| `2019|missing_strength_open_available` | 635 |
| `2021|missing_strength_open_available` | 378 |
| `2019|missing_strength_friday_available` | 111 |
| `2020|missing_strength_open_available` | 58 |
| `2023|missing_strength_open_available` | 56 |
| `2019|missing_cot_available` | 28 |
| `2020|missing_cot_available` | 28 |
| `2022|missing_strength_open_available` | 28 |
| `2023|missing_cot_available` | 28 |
| `2020|missing_strength_friday_available` | 13 |

### Source-Specific Concentration

COT unavailable rows:

```text
rows: 84
years: 2019=28, 2020=28, 2023=28
pair concentration: every FX pair has 3 missing COT rows
```

Friday Strength unavailable rows:

```text
rows: 124
years: 2019=111, 2020=13
top pairs: AUDUSD/EURUSD/GBPUSD/NZDUSD/USDCAD/USDCHF/USDJPY at 13 rows each
top base currency: USD at 39 rows
top quote currency: USD at 52 rows
```

Open-canonical Strength unavailable rows:

```text
rows: 1,155
years: 2019=635, 2021=378, 2020=58, 2023=56, 2022=28
top pairs: USDCHF=72; AUDUSD/EURUSD/GBPUSD/NZDUSD/USDCAD/USDJPY=70 each
top base currencies: EUR=276, USD=212, AUD=184, GBP=182, NZD=158
top quote currencies: CHF=402, USD=280, JPY=203, CAD=142
```

Read:

The open-canonical Strength gap is concentrated enough that SFA evaluation must
use explicit masks. It is not acceptable to compare SFA against FSA or CLP on a
casual full-window denominator.

## Selector Missingness

| Selector / harness | Selected rows | Missing / unavailable rows | Main unavailable reason |
|---|---:|---:|---|
| `cot_faces_v1_commercial_delta_contrarian_selected` | 10,332 | 84 | `missing_cot_direction` |
| `strength_friday_snapshot_open_canonical_fade_agree` | 4,618 | 1,196 | missing Friday/open Strength |
| `strength_friday_snapshot_selected` | 10,292 | 124 | `missing_strength_friday_snapshot_direction` |
| `cot_lifecycle_polarity_v0_noncomm_primary` | 6,020 valid | 4,312 warmup | `clp_expected_warmup_unavailable` |

CLP remains valid-window only. Its unavailable warmup rows are not neutralized or
imputed.

## Contribution-Gap Audit

Gate 54C carried forward:

```text
variantWeekRows:                  13,020
emptyPairContributionRows:           393
emptyCurrencyContributionRows:       393
```

Gate 54E classification:

```text
empty contribution rows with selected_pair_sides > 0: 0
stored week-level ranking changed when empty contribution weeks removed: no
rankingChangedVariantCount: 0
```

The 393 fully empty contribution maps do not alter directional selector outputs
and do not alter stored week-level `final_adr` ranking. They still matter for
attribution because pair/currency maps are absent for those variant-week rows.

Empty contribution rows by year:

| Year | Rows |
|---:|---:|
| 2019 | 112 |
| 2023 | 91 |
| 2021 | 70 |
| 2020 | 45 |
| 2022 | 35 |
| 2025 | 20 |
| 2024 | 15 |
| 2026 | 5 |

Target selector contribution coverage:

| Selector / harness | Empty variant-week maps | Selected rows with missing pair contribution | Years affected |
|---|---:|---:|---|
| CLP harness `cot_faces_v1_commercial_delta_contrarian_selected` | 3 | 17 | 2024, 2025, 2026 |
| `strength_friday_snapshot_open_canonical_fade_agree` | 7 | 1 | 2025 |
| `strength_friday_snapshot_selected` | 1 | 12 | 2024, 2025, 2026 |

Read:

Directional outputs are not affected. Week-level candidate ranking is not
affected by the 393 empty maps. Pair/currency/year attribution remains partial
where selected rows have missing pair contribution entries and must be labelled
as zero-filled or excluded in any later attribution receipt.

## Ranking-Distortion Dry Read

This is a diagnostic stability read only. It is not model selection.

Dry-read hash:

```text
gate54eDryReadHash: 9D9979522A8F3EB76B297F414A1BCE6BE0C44BC9B6D35B138C0671B637B4B38B
```

Common-mask diagnostic rows:

| Selector | Eligible rows inside common mask | Zero-filled selected contribution rows | Stored contribution ADR |
|---|---:|---:|---:|
| `strength_friday_snapshot_selected` | 5,936 | 12 | 1,190.2215 |
| `cot_lifecycle_polarity_v0_noncomm_primary` | 5,936 | 17 | 958.7014 |
| `strength_friday_snapshot_open_canonical_fade_agree` | 2,888 | 1 | 691.7066 |

The apparent ordering of stored contribution ADR is stable across the tested
masks, but row counts differ materially. This is not a final ranking and must
not be used as a system-selection claim.

## Gate 54E Verdict

```text
READY_FOR_SIGNAL_EVALUATION_COMMON_MASK_ONLY
```

Allowed next step:

```text
Run a controlled Signal Model evaluation only if it uses explicit denominator
masks and labels attribution gaps.
```

Required guardrails for the next gate:

- Report every candidate on its native valid denominator and on the common mask.
- Do not compare CLP full-window against SFA/FSA full-window.
- Do not hide missingness behind neutral rows.
- Do not treat zero-filled pair contributions as clean attribution.
- Do not select the final Signal Model in the readiness gate.

Still blocked:

- final Signal Model selection
- optimization
- outcome grid expansion
- BPR/RRP retest
- PPP/NEER/REER valuation work
- execution/risk-overlay changes
- live, MT5, production, or promotion claims

## External Value Parking Lot

PPP, NEER, and REER remain outside Gate 54E.

Later source-governance family:

```text
External Value Regime Candidates
- PPP deviation / fair-value gap
- NEER trend / deviation
- REER trend / deviation
```

Likely later gate:

```text
Gate 56 or later: External Value Regime Source Inventory
```

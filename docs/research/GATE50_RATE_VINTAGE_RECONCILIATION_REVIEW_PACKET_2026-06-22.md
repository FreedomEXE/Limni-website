# Gate 50 Rate Vintage Reconciliation Review Packet

Date: 2026-06-22

Gate: Gate 50: macro-source-promotion-proof

Status: rate source proof only. This is not an ACTIVE manifest, not RRP
promotion, and not a macro outcome test.

## Decision

The canonical rate selection rule is now frozen as:

```text
latest_eligible_vintage_as_of_weekly_freeze
```

For FRED/ALFRED rate sources, this means the weekly selected value is the latest
eligible observation vintage returned by `fred/series/observations` with
`output_type=1` and `realtime_start=realtime_end=<freeze date>`.

Initial-release values remain diagnostic evidence, not the promoted weekly
selection rule.

## Receipt

Script:

`app/scripts/verification/audit-macro-rate-differential-reconstruction.ts`

Command:

```powershell
npm run verification:audit-macro-rate-differential
```

Receipt:

`app/reports/data-verification/macro-regime/gate50-rate-alfred-differential-reconstruction-20260622.{json,md}`

Result:

- `rowsAudited`: `139`
- `distinctSources`: `8`
- `selectionRule`: `latest_eligible_vintage_as_of_weekly_freeze`
- `stalenessRuleVersion`: `rate_3m_market_release_aware_carry_v1`
- `rateFamilyManifestStatus`: `BUILT_DIAGNOSTIC_REBUILD_REQUIRED`
- `promotionEligible`: `false`
- `outcomeConsumable`: `false`
- `receiptHash`:
  `8cbc4b565e6ccd8ea30942ec3dbacc9c5a72baa5abf6d23f44b90b2674092989`
- `rateFamilyManifestHash`:
  `c1befe5d6711265a3c2b55191eec19f9dec8b8e3e0316b48ea01a1e723eeb219`

## Classification

The old stale rows classify cleanly into the requested review buckets:

| Classification | Count | Meaning |
|---|---:|---|
| `legitimate_revision` | 92 | FRED/ALFRED latest eligible as-of value differs from the initial-release value currently stored in the old sealed dataset. Rebuild with the latest eligible vintage. |
| `valid_carry_incorrectly_marked_stale` | 47 | The selected row equals the latest eligible as-of value; the old fixed `70` day age threshold falsely marked it stale. |
| `wrong_vintage` | 0 | No row selected an observation date different from the latest eligible as-of observation date. |
| `reconstruction_defect` | 0 | No remaining query/reconstruction failure after widening the as-of query window. |
| `genuine_missing_observation` | 0 | No row lacks a source observation after the corrected query. |

The prior single `no_as_of_observation_returned` row was not a source gap. It
was a reconstruction query-window defect: the as-of request started after the
selected `2021-12-01` CHF observation. The audit now starts far enough back to
include the selected observation and eligible vintages through the freeze. That
row is now classified as `legitimate_revision`.

The receipt preserves this original anomaly in `rateReconciliationRepairHistory`
so the final zero-defect classification does not erase the defect history:

```text
original anomaly: no_as_of_observation
root cause: query-window defect
repair version: rate_vintage_reconciliation_query_window_repair_v1
post-repair classification: legitimate_revision
```

## Proposed Rate Family Contract

Manifest id:

```text
rate_3m_market_family_v1
```

Instrument:

```text
oecd_3m_interbank_rate
```

Required currency set:

```text
AUD, CAD, CHF, EUR, GBP, JPY, NZD, USD
```

Source branches:

| Currency | Source id | FRED/OECD series |
|---|---|---|
| AUD | `fred_IR3TIB01AUM156N` | `IR3TIB01AUM156N` |
| CAD | `fred_IR3TIB01CAM156N` | `IR3TIB01CAM156N` |
| CHF | `fred_IR3TIB01CHM156N` | `IR3TIB01CHM156N` |
| EUR | `fred_IR3TIB01EZM156N` | `IR3TIB01EZM156N` |
| GBP | `fred_IR3TIB01GBM156N` | `IR3TIB01GBM156N` |
| JPY | `fred_IR3TIB01JPM156N` | `IR3TIB01JPM156N` |
| NZD | `fred_IR3TIB01NZM156N` | `IR3TIB01NZM156N` |
| USD | `fred_IR3TIB01USM156N` | `IR3TIB01USM156N` |

Selection rule:

```text
latest eligible FRED/ALFRED vintage known at the weekly freeze
```

Release-aware carry rule:

```text
Carry the latest eligible vintage known at the weekly freeze until FRED/ALFRED
exposes a newer eligible observation vintage at or before that freeze. Do not
stale solely because a fixed age threshold is exceeded.
```

Revision rule:

```text
If FRED/ALFRED revises an observation before a later freeze, the later weekly
snapshot must use that latest eligible vintage. Prior frozen snapshots are not
rewritten.
```

Missing rule:

```text
Missing means no valued observation exists from the contracted endpoint after a
query window that includes the selected observation and all eligible vintages
through the freeze.
```

## Diagnostic Manifest State

The audit emits:

- sealed diagnostic `rate_3m_market_family_v1`;
- eight `RATE_DIAGNOSTIC` currency bundle branches;
- `diagnosticOnly=true`;
- `promotionEligible=false`;
- `outcomeConsumable=false`.

The manifest is rebuild-required because the old sealed dataset was built under
the prior initial-release/fixed-age policy.

## Rebuilt Rate Dataset

The source-fill path now materializes the rate family under the accepted
contract:

- selector: `latest_eligible_vintage_as_of_weekly_freeze`;
- FRED/ALFRED endpoint: `fred/series/observations` with `output_type=1`;
- staleness: `rate_3m_market_release_aware_carry_v1`;
- default rate sources: the eight canonical `oecd_3m_interbank_rate` branches
  only; exploratory call-money, policy, and reference series remain behind
  `--allow-exploratory-source-fallback`;
- dataset version: `macro_regime_source_dataset_v3`.

Rate-only SEALED diagnostic dataset:

```text
regimeDatasetId: ee1f1611-5d6d-41cf-86fe-c06c66cb16bb
datasetHash: eef3689856712225b2b1288e3a6005c8c11e8ec1271331aaf565581cc15c01cd
promotionManifestId: 4f187897b9e60a79865e371daa2415d2654ef72aef18a2afd63609260b840947
contractManifestHash: 9d5f6d859a2f409f45a41a15f71994203ae3411fd36603aa1c40ab360ff8f774
```

Write receipt:

`app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-write-20260622.json`

Counts:

- `8` rate sources;
- `2,886` rate source observations;
- `2,976` SEALED weekly rate snapshots (`372` weeks x `8` currencies);
- `0` stale snapshots;
- `0` missing snapshots;
- `40` FRED/ALFRED real-time-period artifacts;
- `2,886` availability events.

The warehouse schema was versioned so raw source observations now carry
`source_observation_id`. This is required because FRED real-time periods produce
multiple vintages for the same source/currency/observation date.

## Join And Boundary Proof

SEALED diagnostic rate join receipt:

`app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-join-coverage-20260622.{json,md}`

Result:

- `joinReceiptStatus`: `PASS_DIAGNOSTIC`;
- `diagnosticOnly`: `true`;
- `promotionEligible`: `false`;
- `featureBundleManifestId`: `rate_attribution_v1`;
- `joinablePairWeeks`: `10,416/10,416`;
- `allowedSnapshotStates`: `SEALED`.

Boundary proof receipt:

`app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-boundary-proof-20260622.{json,md}`

Result:

- `status`: `PASS`;
- `stableReceiptHash`:
  `7ee1449a41bf46598b375650beb354af41e512857b21a430e2f2583567e49a45`;
- `snapshotsAudited`: `2,976`;
- `auditedStaleRowsReconciled`: `139`;
- `legitimateRevisionRows`: `92`;
- `legitimateRevisionBoundaryViolations`: `0`;
- `validCarryRows`: `47`;
- `validCarryViolations`: `0`;
- `staleSnapshots`: `0`;
- `missingSnapshots`: `0`;
- `selectionOrStalenessRuleMismatches`: `0`.

The boundary proof compares the rebuilt selected observation/value with the
as-of-freeze value, requires selected vintage date <= freeze date, and requires
the selected FRED real-time period to contain the freeze date.

## Next Work

1. Wire the official CPI family materializer to the sealed CPI source contracts
   instead of the old in-script FRED/OECD CPI scaffold.
2. Combine the rebuilt rate family with the sealed CPI family.
3. Build full RRP currency bundles.
4. Rebuild canonical `real_rate_pressure` snapshots under a new dataset.
5. Rerun SEALED diagnostic RRP join proof until `10,416/10,416`.
6. Only after SEALED proof, run deterministic rebuild, boundary, activation,
   and ACTIVE non-diagnostic proof.

## Source Basis

FRED/ALFRED supports historical real-time/vintage reconstruction through
`fred/series/observations` parameters such as `realtime_start`,
`realtime_end`, and `output_type`, and through series vintage dates:

<https://fred.stlouisfed.org/docs/api/fred/series_observations.html>

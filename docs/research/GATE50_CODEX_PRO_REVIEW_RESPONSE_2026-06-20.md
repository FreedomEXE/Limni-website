# Gate 50 Codex Pro Review Response

Date: 2026-06-20

Gate: Gate 50: macro-source-promotion-proof

Verdict received: **PASS WITH CAVEATS** on the proof design. The current
exploratory macro dataset remains **FAIL**, correctly and intentionally.

## Accepted Blockers

The review found that the zero-P&L join proof is the right gate, but it must be
non-bypassable before any macro outcome runner exists. A standalone audit is not
enough if future outcome scripts can re-query or reconstruct joins on their own.

Accepted caveats:

- outcome runners must require a non-diagnostic PASS join receipt;
- diagnostic receipts from `--allow-fail` must be marked non-promotion;
- the receipt must expose and pin a deterministic resolved join-map hash;
- historical and live clock semantics must stay distinct;
- dependency requirements must come from a frozen feature bundle, not a generic
  all-family default;
- promotion identity must expose transitive source-lineage hashes;
- `ACTIVE` remains the default outcome-eligible state;
- missing/stale rows block required dependencies only;
- key-set hashes must bind weeks, pairs, pair mapping, and pair-week keys;
- final promotion receipts cannot depend solely on ignored local JSON files.

## Immediate Repo Amendments

Updated `app/scripts/verification/audit-macro-regime-join-coverage.ts`:

- added explicit feature bundles:
  - `bpr_attribution_v1`
  - `rate_attribution_v1`
  - `inflation_attribution_v1`
  - `real_rate_pressure_attribution_v1`
  - `full_macro_regime_v1`
- made `--feature-bundle-id` required;
- changed dependency blocking to use the selected bundle's required source
  families instead of forcing all macro families;
- added receipt fields:
  - `joinReceiptStatus`
  - `diagnosticOnly`
  - `promotionEligible`
  - `featureBundleManifestId`
  - `requiredDependencySetHash`
  - `resolvedJoinMapHash`
- added matrix key hashes:
  - macro week ids;
  - pair ids;
  - pair base/quote mapping;
  - pair-week key set;
- added source-lineage hashes derived from the macro dataset source versions;
- added resolved join-map rows/samples that bind pair-week context to aggregate
  manifest and selected required currency snapshots;
- added explicit future outcome-runner contract text:
  - require `joinReceiptStatus=PASS`;
  - require `diagnosticOnly=false`;
  - require `promotionEligible=true`;
  - require zero blocked contexts;
  - pin and verify `resolvedJoinMapHash`.

## New Verification

Type/lint:

- `npx tsc --noEmit --project app/tsconfig.json --pretty false`
- `npx eslint app/scripts/verification/audit-macro-regime-join-coverage.ts`

Bundle-aware diagnostic receipt:

```powershell
npm run verification:audit-macro-regime-join-coverage -- --feature-bundle-id=real_rate_pressure_attribution_v1 --macro-regime-dataset-id=a403b126-9f65-4a35-b353-0b9dcc986bd0 --allow-fail --sample-limit=3 --json-out=app/reports/data-verification/macro-regime/gate50-macro-join-coverage-feature-bundle-rrp-20260620.json
```

Result:

- `joinReceiptStatus`: `FAIL`
- `diagnosticOnly`: `true`
- `promotionEligible`: `false`
- `featureBundleManifestId`: `real_rate_pressure_attribution_v1`
- `requiredDependencySetHash`:
  `7ee93d10c23d065b272543a71315e0c708b07c938f3d20cf2fcb95176053c5f6`
- `resolvedJoinMapHash`:
  `17d4186afff5eb91616f3ab49778e9acbd9988d39ff3134dc8dcf9e376166461`
- `joinablePairWeeks`: `0/10416`

Remaining blockers for that bundle-aware exploratory dataset:

| Blocker | Count |
|---|---:|
| `macro_dataset_missing_promotion_manifest_id` | 1 |
| `macro_dataset_missing_contract_manifest_hash` | 1 |
| `missing_required_source_family:real_rate_pressure` | 1 |
| `unexpected_macro_source_family:real_value` | 1 |
| `no_macro_weekly_snapshot_manifests_for_matrix_weeks` | 1 |
| `missing_weekly_snapshot_manifest` | 372 |
| `pair_week_join_coverage_incomplete` | 1 |

Negative proof:

- the audit now refuses to run without `--feature-bundle-id`;
- the same bundle-aware audit without `--allow-fail` exits `1` when blockers
  remain.

## Still Not Solved

These caveats are documented but not fully implemented yet:

- historical/live clock separation fields such as `activation_scope`;
- source-registry/source-map hashes as first-class manifest columns rather than
  only derived receipt hashes;
- final content-addressed durable promotion receipts outside ignored local
  reports;
- revocation-aware invalidation of prior PASS join receipts;
- downstream macro outcome runners that require and verify PASS join receipts.

These are still Gate 50 source-proof requirements before macro outcome logic.

## Decision

Continue Gate 50 source promotion proof. Do not open macro outcome logic yet.

Next steps:

1. configure `FRED_API_KEY` or `ALFRED_API_KEY`;
2. configure `ESTAT_APP_ID`;
3. finish promotion-bound source fill;
4. build active aggregate weekly manifests under explicit feature bundles;
5. rerun bundle-specific join audits until the relevant bundle reaches
   `10,416/10,416` joinable pair-week contexts with
   `diagnosticOnly=false` and `promotionEligible=true`.

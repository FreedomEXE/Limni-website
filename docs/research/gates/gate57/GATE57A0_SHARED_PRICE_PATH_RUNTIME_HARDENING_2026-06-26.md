# Gate 57A0 Shared Price Path Runtime Hardening

Generated: 2026-06-26

## Verdict

PASS_WITH_REMAINING_SIMULATION_BOTTLENECK.

Gate 57A0 inserted generic shared price/path runtime hardening before Strength
bucket work. The evaluator can now accept multiple `ResearchDecisionManifest`
inputs in one command and score them in a week-major batch, so manifests that
share a price bundle load the week path bars and ADR map once per week, then
optionally clear runtime cache before moving to the next week.

This gate did not change COT logic, Strength logic, ADR Grid semantics, Weekly
Hold semantics, price data, source data, registry equivalence semantics, or
manifest hashing semantics. Runtime/cache settings are recorded as memory and
speed controls only, not strategy or evaluator variants.

The useful improvement is real but bounded: shared weekly price/path loading is
now reusable for multi-manifest ladders, while the per-symbol ADR Grid
simulation loop remains the dominant runtime cost.

## Design

Reusable object:

```text
price_bundle_id
-> week/window + symbol universe + path_resolution
-> shared price/path context
-> one or more manifests consume the same context
```

Implemented changes:

- Runtime cache telemetry in `engine/src/cache/runtimeCache.ts`.
- Price/path cache keys now include `price_bundle_id` where the evaluator
  provides a bundle identity.
- Shared evaluator result JSON now includes runtime telemetry:
  wall-clock time, mode, manifest count, union week count, evaluated row count,
  cache gets/hits/misses, clear-all calls, entries cleared, and namespace stats.
- `engine/scripts/verification/evaluate-research-decision-manifest.ts` accepts
  repeated `--manifest=<path>` inputs.
- Single-manifest runs keep the existing single-manifest path.
- Multi-manifest runs use `batch_week_major` mode:
  load one weekly price/path context, score each manifest's rows for that week,
  then honor `--clear-runtime-cache-between-weeks`.
- Registry duplicate detection still runs per manifest before scoring.

Cache identity:

- `pathBarLoader` cache keys include:
  `price_bundle_id`, source, path resolution, window, and normalized symbol set.
- `adrLookup` cache keys include:
  `price_bundle_id` and week.
- `canonicalPriceBars` helpers now accept an optional `priceBundleId` cache
  scope for future direct callers.

The cache keys do not include COT or Strength labels for shared price/path
objects.

## Changed Files

- `engine/src/cache/runtimeCache.ts`
- `engine/src/price/adrLookup.ts`
- `engine/src/price/canonicalPriceBars.ts`
- `engine/src/price/pathBarLoader.ts`
- `engine/src/research/decisionManifestEvaluator.ts`
- `engine/scripts/verification/evaluate-research-decision-manifest.ts`
- `docs/BACKTEST_CANONICAL_PROTOCOL.md`
- `docs/backlog/CURRENT_WORK.md`

## Duplicate Detection Canary

Command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=docs/research/gates/gate56/manifests/gate56f-locked-gate54-clp-cot-restatement.manifest.json --artifact-gate=gate56 --out-dir=docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine --docs-receipt-dir=docs/research/gates/gate56/receipts --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --clear-runtime-cache-between-weeks
```

Result:

```text
Equivalent research run already exists: gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142
Receipt: docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/runs/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.receipt.md
Result: docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/results/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.result.json
Equivalence key: 98B0C2AA4E5BD6E73AE6E35A3DFCB78B64CF562061E96C8C6208B8237FFF5270
```

## Gate 56E Strength Batch Canary

Final-code command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-selected-equivalent.manifest.json --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-fade-equivalent.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a0-strength-batch-canary-final --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --clear-runtime-cache-between-weeks --no-registry-write --no-doc-copy
```

Runtime:

- Mode: `batch_week_major`
- Wall-clock seconds: `3409.3`
- Manifest count: `2`
- Union weeks: `387`
- Evaluated rows: `21,672`
- Runtime cache gets/hits/misses: `774/0/774`
- Runtime cache clear-all calls: `387`
- `pathBarLoader`: `387` gets, `387` misses, `387` sets, `387` deletes
- `adrLookup`: `387` gets, `387` misses, `387` sets, `387` deletes

Previous Gate 56E separate-run reference:

- Selected scoring: about `45.4` minutes.
- Fade scoring: about `50.7` minutes.
- Combined separate-run scoring: about `96.1` minutes.
- Gate 57A0 final batch scoring: about `56.8` minutes.

Parity:

| Signal | Metric | Accepted Gate 56E | Gate 57A0 final canary | Delta |
|---|---|---:|---:|---:|
| selected | ADR Grid ADR | `1311.8526` | `1311.8526` | `0.0000` |
| selected | ADR Grid DD | `-698.5889` | `-698.5889` | `0.0000` |
| selected | ADR Grid PF | `1.2674` | `1.2674` | `0.0000` |
| selected | ADR Grid fills | `119147` | `119147` | `0` |
| selected | Weekly Hold ADR | `-315.1911` | `-315.1911` | `0.0000` |
| selected | Weekly Hold DD | `-377.0083` | `-377.0083` | `0.0000` |
| selected | Weekly Hold PF | `0.8666` | `0.8666` | `0.0000` |
| fade | ADR Grid ADR | `988.7181` | `988.7181` | `0.0000` |
| fade | ADR Grid DD | `-653.5674` | `-653.5674` | `0.0000` |
| fade | ADR Grid PF | `1.1794` | `1.1794` | `0.0000` |
| fade | ADR Grid fills | `118460` | `118460` | `0` |
| fade | Weekly Hold ADR | `315.1911` | `315.1911` | `0.0000` |
| fade | Weekly Hold DD | `-230.8041` | `-230.8041` | `0.0000` |
| fade | Weekly Hold PF | `1.1540` | `1.1540` | `0.0000` |

Final canary run receipts:

- Selected:
  `docs/research/gates/gate57/artifacts/gate57a0-strength-batch-canary-final/runs/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260626T064353Z-33DB0459.receipt.md`
- Selected receipt hash:
  `C6C1BE59123EA45696464117CA50FE6CB46C6BF5513CCC373076148C2A902229`
- Fade:
  `docs/research/gates/gate57/artifacts/gate57a0-strength-batch-canary-final/runs/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260626T064353Z-BB3142AF.receipt.md`
- Fade receipt hash:
  `85E816915C8E3CF3F5338157F78064C0F0545F8B26E5E681E4485522E53E396D`

## Gate 56F COT Canary

Final-code command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=docs/research/gates/gate56/manifests/gate56f-locked-gate54-clp-cot-restatement.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a0-cot-canary-final --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --clear-runtime-cache-between-weeks --no-registry-write --no-doc-copy
```

Runtime:

- Mode: `single_manifest`
- Wall-clock seconds: `2945.9`
- Manifest count: `1`
- Union weeks: `388`
- Evaluated rows: `10,864`
- Runtime cache gets/hits/misses: `776/0/776`
- Runtime cache clear-all calls: `388`

Parity:

| Metric | Accepted Gate 56F | Gate 57A0 final canary | Delta |
|---|---:|---:|---:|
| ADR Grid ADR | `1493.8161` | `1493.8161` | `0.0000` |
| ADR Grid DD | `-344.9941` | `-344.9941` | `0.0000` |
| ADR Grid R/DD | `4.3300` | `4.3300` | `0.0000` |
| ADR Grid PF | `1.3204` | `1.3204` | `0.0000` |
| ADR Grid fills | `118785` | `118785` | `0` |
| Weekly Hold ADR | `367.5166` | `367.5166` | `0.0000` |
| Weekly Hold DD | `-151.9313` | `-151.9313` | `0.0000` |
| Weekly Hold R/DD | `2.4190` | `2.4190` | `0.0000` |
| Weekly Hold PF | `1.1929` | `1.1929` | `0.0000` |
| Missing price rows | `0` | `0` | `0` |

Final canary run receipt:

- COT:
  `docs/research/gates/gate57/artifacts/gate57a0-cot-canary-final/runs/gate57-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T073421Z-563B4142.receipt.md`
- COT receipt hash:
  `765082927EB7BB0272055168F506F250672B327DA16D16AEE44BA104EE67B43B`

## Artifact Policy

The final canary result JSON, hash JSON, and normalized manifest JSON files are
generated artifacts under ignored `*.json` policy. The tracked durable evidence
for this gate is this receipt plus the final Markdown canary receipts. A
preliminary Strength batch canary was also generated before adding explicit
`price_bundle_id` cache-key scope; its Markdown receipts are retained as
diagnostic timing only, and the final `gate57a0-strength-batch-canary-final`
run is the accepted canary for this gate.

## Validation

Passed:

```powershell
npx tsc --noEmit --pretty false
npx tsc --noEmit --project app/tsconfig.json --pretty false
npm run engine:research-manifest:evaluate -- --help
npm test -- app/src/lib/__tests__/runtimeCache.test.ts
git diff --check
git status -sb --untracked-files=all
```

## Boundary

Still blocked until explicitly opened:

- Strength context/bucket manifest preflight.
- Strength bucket evaluation.
- Regime filters.
- COT+Strength combined manifests.
- COT source/tie-policy changes.
- Strength logic changes.
- ADR Grid or Weekly Hold semantic changes.
- Execution optimization.
- Risk overlays.
- MT5/live/bot work.
- App refactor work.
- Final combined system selection.

Receipt hash: `215929970E9F2DFFA41F48529ADCD250187DF7A7C5BEA213A3AFB8CB9E33747E`

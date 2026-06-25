# Gate 55H Blessed Research Commands

Price bundle for Gate 55H command shapes:

```text
gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953
```

The shared evaluator command is:

```powershell
npm run verification:research-manifest:evaluate -- `
  --manifest=<manifest.json> `
  --artifact-gate=gate55 `
  --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 `
  --path-resolution=1m `
  --evaluators=adr_grid,weekly_hold `
  --status=diagnostic
```

Every blessed run writes:

- normalized manifest copy
- result JSON
- Markdown receipt
- hash JSON
- registry JSONL entry

## COT Restatement

Do not change COT signal logic. Generate a manifest from the locked Gate 54 CLP
carry-forward plus carry-previous tie-fill decisions, then score it:

```powershell
npm run verification:research-manifest:evaluate -- `
  --manifest=docs/research/gates/gate55/manifests/gate54-clp-carry-forward-restatement-gate55e.manifest.json `
  --artifact-gate=gate55 `
  --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 `
  --path-resolution=1m `
  --evaluators=adr_grid,weekly_hold `
  --status=diagnostic
```

Expected output receipt belongs under
`docs/research/gates/gate55/receipts/`. It must not edit Gate 54 truth.

## Strength Selected/Fade

Selected and fade should be two frozen manifests with different `signal_id` and
decision rows. The evaluator scores both identically:

```powershell
npm run verification:research-manifest:evaluate -- `
  --manifest=docs/research/gates/gate55/manifests/gate55-strength-friday-selected.manifest.json `
  --artifact-gate=gate55 `
  --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 `
  --path-resolution=1m `
  --evaluators=adr_grid,weekly_hold `
  --status=diagnostic
```

```powershell
npm run verification:research-manifest:evaluate -- `
  --manifest=docs/research/gates/gate55/manifests/gate55-strength-friday-fade.manifest.json `
  --artifact-gate=gate55 `
  --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 `
  --path-resolution=1m `
  --evaluators=adr_grid,weekly_hold `
  --status=diagnostic
```

## Strength Buckets

Bucket construction must happen before the evaluator and be represented in
`decisions[].bucket_id` plus manifest `source_metadata`.

```powershell
npm run verification:research-manifest:evaluate -- `
  --manifest=docs/research/gates/gate55/manifests/gate55-strength-bucket-<bucket-id>.manifest.json `
  --artifact-gate=gate55 `
  --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 `
  --path-resolution=1m `
  --evaluators=adr_grid,weekly_hold `
  --status=diagnostic
```

## Regime Filters

Regime filters must emit filtered manifests; do not embed regime logic in the
evaluator.

```powershell
npm run verification:research-manifest:evaluate -- `
  --manifest=docs/research/gates/gate55/manifests/gate55-<signal>-regime-<regime-id>.manifest.json `
  --artifact-gate=gate55 `
  --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 `
  --path-resolution=1m `
  --evaluators=adr_grid,weekly_hold `
  --status=diagnostic
```

## Combined Manifests

Combined logic must be upstream of the evaluator. The combined manifest should
declare all contributing `source_context_ids` and a config hash covering the
combination rule.

```powershell
npm run verification:research-manifest:evaluate -- `
  --manifest=docs/research/gates/gate55/manifests/gate55-combined-<rule-id>.manifest.json `
  --artifact-gate=gate55 `
  --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 `
  --path-resolution=1m `
  --evaluators=adr_grid,weekly_hold `
  --status=diagnostic
```

## Runtime Expectations

- Cached manifest evaluation: seconds for small slices, low minutes for broad
  cached 387-week FX manifests, depending on M1 path resolution and DB cache.
- Full 387-week `1m` rescoring: minutes when path bars and ADR maps are cached;
  Gate 55G's one-off full source rebuild plus scoring took about 90 minutes and
  is not the target for repeated bucket/regime tests.
- Source reconstruction from M1: slow path; Gate 55F/G source rebuilds were
  tens of minutes to about 90 minutes and should not be repeated for every
  bucket/regime test.
- Matrix/result writes: JSON/hash/registry writes are seconds; DB matrix
  warehouse writes depend on row volume and should remain explicit.

Future bucket/regime tests should reuse frozen feature and price artifacts and
therefore run in seconds to low minutes, not all-day M1 rebuilds.

# Gate 56E Gate 55G Equivalent Manifest Parity

Generated: 2026-06-25

## Verdict

PASS.

The engine-owned manifest and shared evaluator path reproduced the accepted
Gate 55G Friday Strength selected-vs-fade metrics exactly under price bundle:

```text
gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953
```

This accepts the manifest/evaluator path for Gate 55G equivalent-manifest
parity. It does not promote a final combined strategy and does not open COT
restatement, Strength buckets, regime filters, COT+Strength, execution
optimization, risk overlays, or MT5/live work.

## Engine Path Proven

```text
Gate 55G-equivalent Strength manifest
-> engine-owned ResearchDecisionManifest
-> engine-owned ADR Grid / Weekly Hold evaluator
-> result JSON / receipt / hashes
-> append-only run registry
```

Forward command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json>
```

## Manifest Build

Command:

```powershell
npm run engine:gate55g:manifests -- --batch-weeks=8
```

Result:

- Selected manifest:
  `docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-selected-equivalent.manifest.json`
- Fade manifest:
  `docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-fade-equivalent.manifest.json`
- Build receipt:
  `docs/research/gates/gate56/receipts/GATE56E_GATE55G_EQUIVALENT_MANIFEST_BUILD_2026-06-25.md`
- Build receipt hash:
  `A3AAC44FE81F648C5A0878E84BCC3D3438B460F065A8F064700ACE17E3B67C66`
- Runtime:
  `3245.1` seconds.

Full decision-manifest JSON files are generated artifacts and are ignored by the
repo's default JSON policy. The tracked review evidence is the manifest build
receipt, manifest hashes, evaluator result JSONs, evaluator receipts, hash
files, and registry row. The full manifests are reproducible from the command
above.

Manifest coverage:

| Manifest | Rows | Weeks | Long | Short | Manifest hash |
|---|---:|---:|---:|---:|---|
| selected | 10836 | 387 | 5612 | 5224 | `33DB04595F371AF4943E2E83E0E40EBEF8C51F7AE89CF96ACF17FF0B71E53ADE` |
| fade | 10836 | 387 | 5224 | 5612 | `BB3142AF507A5CEBE6467E8055467C1B2003126BACA896F3827206DB0755ED28` |

## Parity Runs

Selected command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-selected-equivalent.manifest.json --artifact-gate=gate56 --out-dir=docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity --docs-receipt-dir=docs/research/gates/gate56/receipts --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --log-progress --clear-runtime-cache-between-weeks
```

Fade command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-fade-equivalent.manifest.json --artifact-gate=gate56 --out-dir=docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity --docs-receipt-dir=docs/research/gates/gate56/receipts --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --log-progress --clear-runtime-cache-between-weeks
```

Artifacts:

| Signal | Run ID | Result | Receipt hash | Runtime |
|---|---|---|---|---:|
| selected | `gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260625T225526Z-33DB0459` | `docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity/results/gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260625T225526Z-33DB0459.result.json` | `EB663091ADECED5B136F7EDA620710AA0EEDAE66FEF25DAA2028978AAE297236` | 2722.3s |
| fade | `gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260625T234135Z-BB3142AF` | `docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity/results/gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260625T234135Z-BB3142AF.result.json` | `1278E7874F78461D7602D5B9125A3E6DA0E75161D2266F24E555F0CE2D554B4D` | 3039.7s |

## Metric Parity

| Signal | Evaluator | Metric | Gate 55G accepted | Gate 56E engine path | Delta |
|---|---|---|---:|---:|---:|
| selected | coverage | weeks | 387 | 387 | 0 |
| selected | coverage | rows | 10836 | 10836 | 0 |
| selected | ADR Grid | total ADR | 1311.8526 | 1311.8526 | 0.0000 |
| selected | ADR Grid | max DD ADR | -698.5889 | -698.5889 | 0.0000 |
| selected | ADR Grid | R/DD | 1.8779 | 1.8779 | 0.0000 |
| selected | ADR Grid | PF | 1.2674 | 1.2674 | 0.0000 |
| selected | ADR Grid | fills | 119147 | 119147 | 0 |
| selected | Weekly Hold | total ADR | -315.1911 | -315.1911 | 0.0000 |
| selected | Weekly Hold | max DD ADR | -377.0083 | -377.0083 | 0.0000 |
| selected | Weekly Hold | R/DD | -0.8360 | -0.8360 | 0.0000 |
| selected | Weekly Hold | PF | 0.8666 | 0.8666 | 0.0000 |
| fade | coverage | weeks | 387 | 387 | 0 |
| fade | coverage | rows | 10836 | 10836 | 0 |
| fade | ADR Grid | total ADR | 988.7181 | 988.7181 | 0.0000 |
| fade | ADR Grid | max DD ADR | -653.5674 | -653.5674 | 0.0000 |
| fade | ADR Grid | R/DD | 1.5128 | 1.5128 | 0.0000 |
| fade | ADR Grid | PF | 1.1794 | 1.1794 | 0.0000 |
| fade | ADR Grid | fills | 118460 | 118460 | 0 |
| fade | Weekly Hold | total ADR | 315.1911 | 315.1911 | 0.0000 |
| fade | Weekly Hold | max DD ADR | -230.8041 | -230.8041 | 0.0000 |
| fade | Weekly Hold | R/DD | 1.3656 | 1.3656 | 0.0000 |
| fade | Weekly Hold | PF | 1.1540 | 1.1540 | 0.0000 |

Both runs also preserved:

- Missing price rows: `0`.
- Default ADR rows: `270`.
- Price bundle ID:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`.

## Important Implementation Note

The manifest builder physically used 8-week batches to keep DB-derived source
work bounded, but source lookup now preserves Gate 55G's 16-week logical source
batch semantics. That matters because the old Gate 55G `at_or_before` Friday
Strength lookup can use earlier complete snapshots inside the same logical
source batch around holiday closures.

This changed only equivalent manifest generation. It did not change the shared
ADR Grid / Weekly Hold evaluator, COT logic, Strength scoring rules, execution
logic, risk logic, or price bundle.

## Runtime Interpretation

- Full M1 source reconstruction for the equivalent selected/fade manifests:
  about `54.1` minutes in this run.
- Full 387-week `1m` selected scoring with runtime cache cleared between weeks:
  about `45.4` minutes.
- Full 387-week `1m` fade scoring with runtime cache cleared between weeks:
  about `50.7` minutes.

Future bucket/regime work should not rebuild M1 Strength source context each
time. It should create filtered or annotated manifests from frozen source
manifests and reuse cached price/path artifacts through the same evaluator.
This gate did not benchmark a no-cache-clear warm run.

## Status Update

Gate 55H pending marker is superseded by this receipt:

```text
docs/research/gates/gate55/receipts/GATE55H_EVALUATOR_PARITY_PENDING_2026-06-25.md
```

The forward research command remains:

```text
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json>
```

## No-Go List

Still blocked until explicitly opened:

- COT restatement.
- Strength bucket tests.
- Regime-filtered manifests.
- COT+Strength combination.
- COT signal logic or tie-policy changes.
- ADR Grid execution optimization.
- Risk overlays.
- MT5/live/bot work.
- Final combined system selection.

Receipt hash: `1261638885C2DC446B3951BB04601FA08CB6E3AD19A1EAA25DA24F0CEAEA946E`

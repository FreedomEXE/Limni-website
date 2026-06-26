# Gate 56F Gate 54 COT Restatement Through Engine

Generated: 2026-06-26

## Verdict

PASS_WITH_RUNTIME_CAVEAT.

The locked Gate 54 CLP carry-forward + carry-previous tie-fill decisions were
represented as a `ResearchDecisionManifest` and scored through the same
engine-owned evaluator path proven in Gate 56E.

Runtime caveat: the first evaluator attempt without runtime-cache clearing
failed before writing artifacts with JavaScript heap exhaustion after `1478.7`
seconds. A second run with `--clear-runtime-cache-between-weeks` completed in
`3165.7` seconds. Cache clearing is therefore required for this full 388-week
1m COT restatement proof unless the evaluator memory profile is later improved.
The cache-clearing flag is recorded as a runtime/memory-control setting only;
it is not a strategy-logic, signal-logic, or evaluator-logic variant.

This receipt does not open COT retuning, Strength buckets, regime filters,
COT+Strength, execution optimization, risk overlays, MT5/live work, app
refactors, or final system selection.

## Source Truth

Accepted locked COT baseline:

```text
CLP carry-forward + carry-previous tie fill
```

Source context:

- `docs/research/GATE54G_COT_WARMUP_CARRY_FORWARD_PROOF_2026-06-23.md`
- `docs/research/GATE54H_CLP_TIE_BREAK_COMPARISON_2026-06-23.md`
- `docs/research/GATE54I_RAW_SIGNAL_REVIEW_PACKET_2026-06-23.md`
- `docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md`

Gate 54 locked policy:

- CLP lifecycle lookback: `156` COT reports.
- Report selection: exact report date when available, holiday-adjusted date
  when shifted, otherwise latest prior report with no lookahead through the
  2025 source-ambiguous lapse.
- Tie policy: `carry_previous_clp_side`.
- Tied rows filled: `71` rows across `60` weeks.

## Manifest Build

Command:

```powershell
npm run engine:gate54:cot-manifest -- --expected-weeks=388 --expected-rows=10864
```

Builder:

- `engine/src/signals/cot/gate54ClpManifest.ts`
- `engine/scripts/verification/generate-gate54-cot-restatement-manifest.ts`

Manifest:

- Path: `docs/research/gates/gate56/manifests/gate56f-locked-gate54-clp-cot-restatement.manifest.json`
- Manifest hash: `563B4142312DD7B84541C3378AF68402E06BC68AEBF00D3F289E936B58005781`
- Manifest file SHA-256: `B18B09D4FC4C596D82638F57A5546F39D06FF8EF936DC329431060C20C98E523`
- Config hash: `BE94F3417E3043758B0F450877BD50C9F5C4C604D45B966449F9EC01F2BAB383`
- Source summary hash: `56D144A60FC986C1C1F155CF71C20A4F3820A5250C32FC76477B0D0CCCD1B52A`
- Build receipt:
  `docs/research/gates/gate56/receipts/GATE56F_GATE54_COT_RESTATEMENT_MANIFEST_BUILD_2026-06-26.md`
- Build receipt hash:
  `B04EA91950B2771EBB23F73D7422F43E17ADB87FD0AA39F1241A49D8661DE985`

Full manifest JSON remains ignored/reproducible. The manifest hash, file
SHA-256, exact regeneration command, source context, tracked result JSON,
tracked hash JSON, tracked receipts, and registry row are the durable evidence.

## Shape Validation

Manifest shape passed before evaluator scoring:

| Check | Value |
|---|---:|
| Rows | `10,864 / 10,864` |
| Weeks | `388 / 388` |
| First week | `2019-01-07T00:00:00.000Z` |
| Last week | `2026-06-07T23:00:00.000Z` |
| Long rows | `5,443` |
| Short rows | `5,421` |
| Duplicate week/symbol rows | `0` |
| Non-full weeks | `0` |

## Engine Evaluation

Successful command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=docs/research/gates/gate56/manifests/gate56f-locked-gate54-clp-cot-restatement.manifest.json --artifact-gate=gate56 --out-dir=docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine --docs-receipt-dir=docs/research/gates/gate56/receipts --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --clear-runtime-cache-between-weeks
```

Run ID:

```text
gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142
```

Evidence:

- Result JSON:
  `docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/results/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.result.json`
- Hash JSON:
  `docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/hashes/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.hashes.json`
- Run receipt:
  `docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/runs/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.receipt.md`
- Docs receipt:
  `docs/research/gates/gate56/receipts/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.md`
- Registry:
  `docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/registry/research-run-registry.jsonl`

Hashes:

- Result hash: `10FF10665562F4F16B1BBF42B5E5D712BF6A0803C3DA7CED374E6563AB19E813`
- Result file SHA-256: `E261D33510F770FCE7BA4A05F4AF6D00062E5988AB3494DD2AF5C8BC7BA6E9DC`
- Evaluator receipt hash: `F069819D4F294FE48067EE1D2D5596834424A4687182C1FCBE952B66965380E8`
- Evaluator receipt file SHA-256: `49A9E41F0444D79634C5510BE62C9ACDD39C30106B9D23FCCB402ED21604F5B6`
- Equivalence key: `98B0C2AA4E5BD6E73AE6E35A3DFCB78B64CF562061E96C8C6208B8237FFF5270`

Commit state:

- Evaluator run-time commit:
  `b2801b356bb7754f3fd9c8f6337148fb4c61dc0e`
- Artifact commit containing tracked result/hash/receipt/registry files:
  `f8ab474`
- Working tree status at evaluator start: `clean`.

## Metric Restatement

| Metric | Gate 54 accepted legacy | Gate 56F engine-restated | Delta |
|---|---:|---:|---:|
| Rows | `10,864` | `10,864` | `0` |
| Full weeks | `388/388` | `388/388` | `0` |
| ADR Grid ADR | `1176.4520` | `1493.8161` | `+317.3641` |
| ADR Grid DD | `-358.9404` | `-344.9941` | `+13.9463` |
| ADR Grid R/DD | `3.2776` | `4.3300` | `+1.0524` |
| ADR Grid PF | `1.2604` | `1.3204` | `+0.0600` |
| ADR Grid missing price rows | legacy path caveat | `0` | improved |
| ADR Grid fills | not locked in Gate 54I | `118,785` | n/a |
| Weekly Hold ADR | `339.4126` | `367.5166` | `+28.1040` |
| Weekly Hold DD | `-151.9313` | `-151.9313` | `0.0000` |
| Weekly Hold R/DD | `2.2340` | `2.4190` | `+0.1850` |
| Weekly Hold PF | `1.1844` | `1.1929` | `+0.0085` |
| Weekly Hold missing price rows | old Gate 54G/H context caveat | `0` | improved |

Interpretation:

The decision manifest preserved the locked Gate 54 COT decision surface:
`10,864` rows, `388` full weeks, `28` rows per week, and no duplicate
week/symbol rows. Metric drift is expected and acceptable because the old Gate
54 numbers were tied to the legacy matrix/price context, while Gate 56F scores
the same decisions through the Gate 55E canonical `1m` price bundle and shared
Gate 56 evaluator.

No COT source logic, CLP carry-forward rule, or carry-previous tie-fill policy
was changed.

## Duplicate Detection

The exact successful evaluator command was run a second time. It returned the
existing registry result and did not rescore:

```text
Equivalent research run already exists: gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142
Receipt: docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/runs/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.receipt.md
Result: docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/results/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.result.json
Equivalence key: 98B0C2AA4E5BD6E73AE6E35A3DFCB78B64CF562061E96C8C6208B8237FFF5270
```

## Acceptance

Gate 56F acceptance checks:

- Locked Gate 54 decisions preserved: PASS.
- Manifest shape complete: PASS.
- Same Gate 56 engine evaluator path used: PASS.
- Result/receipt/hash/registry artifacts created: PASS.
- No new evaluator/backtester introduced: PASS.
- Duplicate detection prevents identical rerun: PASS.
- Runtime caveat recorded: PASS_WITH_CAVEAT.

## Boundary

Still blocked until explicitly opened:

- Strength buckets.
- Regime-filtered manifests.
- COT+Strength combined manifests.
- COT source/tie-policy changes.
- Execution optimization.
- Risk overlays.
- MT5/live/bot work.
- Final combined system selection.

Receipt hash: `CA657B21F148BBBCBEBAB4EA737DD893E6BF9B4169102F03085111B648726D00`

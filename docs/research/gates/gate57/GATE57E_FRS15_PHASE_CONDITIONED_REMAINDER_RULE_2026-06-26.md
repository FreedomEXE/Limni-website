# Gate 57E FRS15 Phase-Conditioned Remainder Rule

Generated: 2026-06-26

## Verdict

PASS_WAREHOUSE_ONLY_PHASE_CONDITIONED_REMAINDER_LOCK_CANDIDATE__FULL28_PHASE_SANITY_FAILS.

Gate 57E tested one approved point-in-time state variable, `phaseBucket`, on top
of the Gate 57B Friday-settled FRS15 source:

```text
phaseBucket = initial | persistent | flip
```

The primary rule tested:

```text
compressed = selected
non-compressed persistent = fade
non-compressed flip = selected
non-compressed initial = selected
```

Freedom's requested anti-curve-fit sanity was also tested:

```text
all 28 persistent = fade
all 28 flip/initial = selected
```

Result:

- `phase_conditioned_remainder` improves PF versus Gate 57D
  compressed/remainder while preserving most of Gate 57D's DD/R-DD improvement.
- It is now the best forced-28 Strength lock candidate from this sequence.
- The full-28 phase sanity test fails as a standalone rule, so the evidence does
  not support "phase alone" across the whole basket.
- The institutional read is a small two-state map: lifecycle compression still
  matters, and phase helps decide the non-compressed remainder.

Stop here. Do not open more Strength windows, deciles, bucket families, regimes,
COT+Strength, risk overlays, MT5/live, app work, or further engine work without
explicit approval.

## Boundaries

Frozen:

- Gate 55E price bundle:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Gate 57A0B warehouse:
  `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`
- ADR Grid and Weekly Hold semantics.
- Gate 54 COT baseline and all COT logic.
- Gate 57B FRS15 source definition.
- Gate 57C and Gate 57D diagnostic evidence.
- App/release/canon areas.

Not run:

- Raw M1 ADR Grid simulation.
- New evaluator or backtest engine.
- COT changes.
- COT+Strength.
- Regimes.
- Risk overlays.
- Additional windows.
- Additional buckets or deciles.
- MT5/live.
- App/dashboard/refactor work.

## Candidate Definitions

Evaluated only:

| Candidate | Definition | Rows/week |
|---|---|---:|
| parent_selected | all 28 selected | 28 |
| original_binary | compressed + middle selected; extreme fade | 28 |
| compressed_selected_remainder_fade | compressed selected; middle + extreme fade | 28 |
| phase_conditioned_remainder | compressed selected; non-compressed persistent fade; non-compressed flip/initial selected | 28 |
| phase_conditioned_all28 | all 28 persistent fade; all 28 flip/initial selected | 28 |

## Manifest Build

Command:

```text
npm run engine:gate57e:frs15-phase-conditioned-remainder-manifests
```

Manifest build output:

- Build receipt:
  `docs/research/gates/gate57/receipts/GATE57E_FRS15_PHASE_CONDITIONED_REMAINDER_MANIFEST_BUILD_2026-06-26.md`
- Build receipt hash:
  `F6DD8C8493FC9B016EC6F15D2EC2402C7C22FACF5B6E52967F8DB286348C2223`
- Ignored summary:
  `engine/reports/gate57e-frs15-phase-conditioned-remainder/manifest-summary.json`
- Requested trade weeks: `387`
- Supported trade weeks: `373`
- Unsupported trade weeks: `14`
- Unsupported reason: first 14 requested weeks lack the required 15-week lookback
  inside the frozen Gate 55E bundle.
- First supported week: `2019-04-14T23:00:00.000Z`
- Last supported week: `2026-05-31T23:00:00.000Z`
- Build runtime: `51.7s`
- Build runtime commit: `49743886e769f2c7f28eeda864b05d8d33141c5e`
- Build working tree status: `dirty`

Dirty-tree caveat: Gate 57E manifest build and evaluation ran from a dirty
Gate 57E worktree on top of pushed Gate 57D. Dirty files were limited to the
Gate 57E manifest source, generator preset, and package script before receipts
and artifacts were written.

## Manifest Shape

| Candidate | Rows | Weeks | Rows/week | Long | Short | Duplicate week+symbol rows | Non-full weeks | Manifest hash |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| parent_selected | 10,444 | 373 | 28 | 5,393 | 5,051 | 0 | 0 | `48D9644A123489D653435584FB1BA392CF496872146671CF9B3D21894A5A5480` |
| original_binary | 10,444 | 373 | 28 | 5,096 | 5,348 | 0 | 0 | `8682272623160F14BA299A4C506B248FAFEAE7CC5BBF4DC3F2427FACFA13666E` |
| compressed_selected_remainder_fade | 10,444 | 373 | 28 | 4,980 | 5,464 | 0 | 0 | `BD686DD89AC65251C5F6BB40E54367934267207C9D251FE9C02F6DEC91E150D7` |
| phase_conditioned_remainder | 10,444 | 373 | 28 | 4,993 | 5,451 | 0 | 0 | `325AA226215ABAC5D722A8011209239A84DC24416EADBCF8C33EACF54E6E5D27` |
| phase_conditioned_all28 | 10,444 | 373 | 28 | 5,056 | 5,388 | 0 | 0 | `DC79B1345E1FE3E2FA506C0C2F353651B076C01175DA37B8D7B78A9C2D925235` |

Candidate 4 proof:

```text
phase_conditioned_remainder rows = 10,444
supported weeks = 373
rows per supported week = 28
duplicate week+symbol rows = 0
non-full weeks = 0
```

Full-28 phase sanity proof:

```text
phase_conditioned_all28 rows = 10,444
supported weeks = 373
rows per supported week = 28
duplicate week+symbol rows = 0
non-full weeks = 0
```

## Lifecycle x Phase Row Counts

| Lifecycle | Initial | Persistent | Flip | Total |
|---|---:|---:|---:|---:|
| compressed | 7 | 1,769 | 835 | 2,611 |
| middle | 14 | 4,773 | 435 | 5,222 |
| extreme | 7 | 2,575 | 29 | 2,611 |
| total | 28 | 9,117 | 1,299 | 10,444 |

## Evaluation Method

Accepted evaluation method:

```text
npm run engine:research-manifest:evaluate -- --manifest=<gate57e manifest> --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

Sequential warehouse-only evaluation completed for all five manifests.

All accepted runs report:

- Runtime mode: `warehouse_aggregation`
- Runtime cache gets/hits/misses: `0/0/0`
- Missing ADR Grid price rows: `0`
- Missing Weekly Hold price rows: `0`
- Missing warehouse outcome rows: `0`; each successful warehouse run evaluated
  all requested manifest rows against Gate 57A0B, and the evaluator did not
  fall back to raw M1 simulation.
- Sum of evaluator-reported warehouse runtimes: `70.1s`
- Sequential command wall time including process overhead: `234.8s`

## ADR Grid Results

| Candidate | Runtime | ADR | DD | R/DD | PF | Fills | TP | Reset | Week-close | Missing rows |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| parent_selected | 13.8s | 1244.3749 | -691.1957 | 1.8003 | 1.2442 | 115,320 | 90,980 | 14,229 | 10,111 | 0 |
| original_binary | 13.8s | 1268.1378 | -350.5031 | 3.6181 | 1.3035 | 115,326 | 90,977 | 14,312 | 10,037 | 0 |
| compressed_selected_remainder_fade | 14.6s | 1339.8105 | -285.5127 | 4.6926 | 1.2864 | 114,401 | 90,236 | 14,289 | 9,876 | 0 |
| phase_conditioned_remainder | 13.7s | 1386.2813 | -304.4126 | 4.5540 | 1.3027 | 114,630 | 90,411 | 14,122 | 10,097 | 0 |
| phase_conditioned_all28 | 14.2s | 1239.1000 | -466.1116 | 2.6584 | 1.2455 | 114,416 | 90,207 | 13,860 | 10,349 | 0 |

## Weekly Hold Results

| Candidate | ADR | DD | R/DD | PF | Missing rows |
|---|---:|---:|---:|---:|---:|
| parent_selected | -268.2949 | -526.9812 | -0.5091 | 0.8892 | 0 |
| original_binary | -42.0920 | -139.5781 | -0.3016 | 0.9540 | 0 |
| compressed_selected_remainder_fade | 436.1613 | -181.9718 | 2.3969 | 1.2349 | 0 |
| phase_conditioned_remainder | 401.5248 | -181.5893 | 2.2112 | 1.2165 | 0 |
| phase_conditioned_all28 | 369.1967 | -231.5789 | 1.5943 | 1.1642 | 0 |

## Decision Comparison

Versus Gate 57D compressed/remainder:

| Candidate | ADR delta | DD delta | R/DD delta | PF delta |
|---|---:|---:|---:|---:|
| phase_conditioned_remainder | +46.4708 | -18.8999 | -0.1386 | +0.0163 |
| phase_conditioned_all28 | -100.7105 | -180.5989 | -2.0342 | -0.0409 |

Versus Gate 57C original binary:

| Candidate | ADR delta | DD improvement | R/DD delta | PF delta |
|---|---:|---:|---:|---:|
| phase_conditioned_remainder | +118.1435 | +46.0905 | +0.9359 | -0.0008 |
| phase_conditioned_all28 | -29.0378 | -115.6085 | -0.9597 | -0.0580 |

Decision-rule result:

```text
Primary Gate 57E rule: PASS as Strength lock candidate.
Full-28 phase sanity: FAIL as standalone rule.
```

Reasoning:

- Candidate 4 improves PF versus Gate 57D (`1.3027` vs `1.2864`).
- Candidate 4 keeps most of Gate 57D's DD/R-DD improvement, with DD only
  `18.8999` ADR worse and R/DD only `0.1386` lower.
- Candidate 4 improves ADR versus Gate 57D by `46.4708`.
- Candidate 4 nearly matches the original binary's PF (`1.3027` vs `1.3035`)
  while materially improving ADR, DD, and R/DD.
- Candidate 5 proves that phase alone across all 28 pairs is not enough.

Institutional read:

```text
compressed rows remain structurally different.
non-compressed persistent Strength is the state that wants fade.
non-compressed flip/initial can stay selected.
phase alone is not a universal all-pair rule.
```

## Artifact Paths And Hashes

Per-run artifacts:

| Label | Result JSON | Result hash | Receipt hash | Equivalence key |
|---|---|---|---|---|
| parent_selected | `docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation/results/gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-parent-selected-20260627T013014Z-48D9644A.result.json` | `2C314C092B3D8D22792538746DDEA1C7BA913AAE4558F418B3DC9C00FE321E48` | `D1B8768FF4EAE585DCAE4595BEB6F6693E7C0954B4BA3721A947F0884FED57F3` | `9B74E96A685A51F3329A9F716E0464AE10E45384C0D0E18B3C7FAA9B9D2FF814` |
| original_binary | `docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation/results/gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-binary-lifecycle-selected-else-extreme-fade-20260627T013100Z-86822726.result.json` | `461183BE0407544C62E62DF5286DD5B4834AEB6D79A55CA374464F231F48F724` | `2387DECDEF49E3CB0BE6D785041551002C7384F8E6CD953F427EBD25E371B76D` | `3FCFA5A0E4244B200E49C376C8DDE86EC21060285AA7EBA6AFF2AD3AA1FC4B81` |
| compressed_selected_remainder_fade | `docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation/results/gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-compressed-selected-remainder-fade-20260627T013154Z-BD686DD8.result.json` | `9EF31C851E8C87D500AACF51635EF9922772F9F23E711FD05EE6646154ED6C1E` | `E43D37C3BCC44806C0C2521F8834EA024028B8BE52A71A48F1EA7068C4F8CEE0` | `E7692E497C653AF1DA7611B41682BE82352BB0617187302AD1250DD71534134C` |
| phase_conditioned_remainder | `docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation/results/gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-phase-conditioned-remainder-20260627T013240Z-325AA226.result.json` | `00FA9DC936A90149A7E3A4A7AE8BA96BBCB5104947672560030F32C66C857433` | `0F5FBCFDFF3609CAC6D5D79CE69195E11D047CE6AE69B4A1081327D80B9986E9` | `5A1CF58F68FC7AEF523F6F8B72394DA408BDCFD74DD60E8BE1EDAC9A82070D08` |
| phase_conditioned_all28 | `docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation/results/gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-phase-conditioned-all28-20260627T013329Z-DC79B134.result.json` | `1E1B59ED9ADF99009EA1C6063B041704CF2F008DEACA83B6DB974FD235080B4D` | `675F696D7F51D559374EB39E845350DF9813EB7FD633B699BBE3BBE78601A3D5` | `9AAE6507F6CB716A7607AA7DE10DF17B6544D4E31C00B5F8ACC1D1C05C14F0ED` |

## Duplicate Detection

Rerun command:

```text
npm run engine:research-manifest:evaluate -- --manifest=engine/reports/gate57e-frs15-phase-conditioned-remainder/manifests/gate57e-frs15-phase-conditioned-remainder-phase_conditioned_remainder.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

Duplicate detection returned:

- Existing run:
  `gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-phase-conditioned-remainder-20260627T013240Z-325AA226`
- Equivalence key:
  `5A1CF58F68FC7AEF523F6F8B72394DA408BDCFD74DD60E8BE1EDAC9A82070D08`

## Validation

Passed before manifest generation/evaluation:

```text
npm run engine:gate57e:frs15-phase-conditioned-remainder-manifests -- --help
npm run engine:gate57d:frs15-compressed-remainder-fade-manifests -- --help
npx tsc --noEmit --pretty false
npx tsc --noEmit --project app/tsconfig.json --pretty false
```

Final validation after receipt is still required before commit/push.

## Stop Line

Stop here and wait for explicit approval.

Do not start:

- More Strength searches.
- More rolling windows.
- More buckets or deciles.
- Regime filters.
- COT+Strength.
- COT source/tie-policy changes.
- ADR Grid or Weekly Hold semantic changes.
- Risk overlays.
- MT5/live/bot work.
- App refactor work.
- Final combined system selection.

Receipt hash: `5AE08798DCF6C94604E476D8D7D300C65E1547F66991312C322F88709DE6AFAB`

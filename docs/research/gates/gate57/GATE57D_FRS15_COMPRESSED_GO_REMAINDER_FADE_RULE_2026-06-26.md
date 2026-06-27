# Gate 57D FRS15 Compressed-Go Remainder-Fade Rule

Generated: 2026-06-26

## Verdict

PASS_WAREHOUSE_ONLY_COMPRESSED_REMAINDER_FADE_ALIVE__NO_LOCK_PF_CAVEAT.

Gate 57D tested the direct replacement implied by Gate 57C:

```text
compressed = selected
middle + extreme = fade
```

The candidate is mechanically valid and preserves a forced 28 rows per
supported week:

```text
rows = 10,444
weeks = 373
rows per supported week = 28
duplicate week+symbol rows = 0
non-full parent weeks = 0
```

It materially improves ADR Grid ADR, drawdown, and R/DD versus both FRS15 parent
selected and the Gate 57C original binary lifecycle rule. It also flips Weekly
Hold strongly positive:

| Comparison | ADR delta | DD improvement | R/DD delta | PF delta |
|---|---:|---:|---:|---:|
| compressed/remainder vs parent selected | +95.4356 | +405.6830 | +2.8923 | +0.0422 |
| compressed/remainder vs original binary | +71.6727 | +64.9904 | +1.0745 | -0.0171 |

The predeclared decision rule required improvement in PF, R/DD, and DD versus
both parent selected and Gate 57C original binary. Gate 57D fails that strict
lock condition because PF is lower than the original binary rule (`1.2864` vs
`1.3035`), even though ADR, DD, and R/DD improve.

Institutional read:

- `compressed_selected_remainder_fade` is alive and deserves to remain in the
  Strength candidate set.
- It is not clean enough to lock as the final Strength parent because PF does
  not beat the original binary.
- The optional sanity candidate shows the opposite tradeoff: better PF
  (`1.3211`) but materially worse DD/R-DD than compressed/remainder.
- This supports Freedom's concern that Strength probably needs one additional
  point-in-time state variable instead of more spread buckets.

Stop here. Do not run broader windows, deciles, regimes, COT+Strength, risk,
MT5/live, app work, or further engine work without explicit approval.

## Boundaries

Frozen:

- Gate 55E price bundle:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Gate 57A0B warehouse:
  `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`
- ADR Grid and Weekly Hold semantics.
- COT logic and Gate 54 COT baseline.
- Gate 57B FRS15 source definition.
- Gate 57C diagnostic evidence.
- App/release/canon areas.

Not run:

- Raw M1 ADR Grid simulation.
- New evaluator or backtest engine.
- Threshold optimization by PnL.
- Additional rolling windows.
- Additional bucket families or deciles.
- Regimes.
- COT+Strength.
- Risk overlays.
- MT5/live.
- App/dashboard/refactor work.

## Source Algorithm

Gate 57D reuses the Gate 57B Friday-settled FRS15 source:

```text
Friday freeze close
minus 15-week prior Friday freeze close
-> pair log return pct
-> isolate each major currency across its 7 related FX crosses
-> average oriented returns per currency
-> normalize the 8 currency scores to 0-100 within that Friday snapshot
-> pair side from base score versus quote score
```

Lifecycle buckets each supported week:

```text
compressed = bottom 7 of 28 by absolute base/quote score spread
middle     = middle 14 of 28
extreme    = top 7 of 28
```

Gate 57D candidate under test:

```text
compressed_selected_remainder_fade:
compressed = selected side
middle + extreme = opposite selected side
```

Optional sanity candidate:

```text
compressed_selected_middle_fade_extreme_selected:
compressed + extreme = selected side
middle = opposite selected side
```

## Manifest Build

Command:

```text
npm run engine:gate57d:frs15-compressed-remainder-fade-manifests
```

Manifest build output:

- Build receipt:
  `docs/research/gates/gate57/receipts/GATE57D_FRS15_COMPRESSED_GO_REMAINDER_FADE_MANIFEST_BUILD_2026-06-26.md`
- Build receipt hash:
  `A387EAD0862E9B824E8756EAB868E9FA0469D454F0B056EA45C636CABDDD171B`
- Ignored summary:
  `engine/reports/gate57d-frs15-compressed-remainder-fade/manifest-summary.json`
- Requested trade weeks: `387`
- Supported trade weeks: `373`
- Unsupported trade weeks: `14`
- Unsupported reason: first 14 requested weeks lack the required 15-week
  lookback inside the frozen Gate 55E bundle.
- First supported week: `2019-04-14T23:00:00.000Z`
- Last supported week: `2026-05-31T23:00:00.000Z`
- Build runtime: `36.5s`

## Manifest Shape

| Signal | Rows | Weeks | Rows/week | Long | Short | Duplicate rows | Non-full parent weeks | Manifest hash |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| parent selected | 10,444 | 373 | 28 | 5,393 | 5,051 | 0 | 0 | `A78CF038B4A68059715A719FC66079BDAF31DEFCCD671AAB55074D41F86B1F01` |
| parent fade | 10,444 | 373 | 28 | 5,051 | 5,393 | 0 | 0 | `90820405FA8708B6A657A618F1219DC7CB245CFF403AACEA8A98984DBF10FC90` |
| original binary | 10,444 | 373 | 28 | 5,096 | 5,348 | 0 | 0 | `8FAB570A5901E26C84EDC903E09031ACDB99C1315C7CB6C93924A6122C021599` |
| compressed selected remainder fade | 10,444 | 373 | 28 | 4,980 | 5,464 | 0 | 0 | `AAB42479A02155CC55D96340890CDAB5390DBEBA02FF3ACC1867D988BA348399` |
| compressed selected middle fade extreme selected | 10,444 | 373 | 28 | 5,277 | 5,167 | 0 | 0 | `90AA71FD06B870EBC3CC1AE92F7FD12FF2580D85FD13627B1941FADE94EE4FD7` |

Candidate 4 proof:

```text
compressed_selected_remainder_fade rows = 10,444
supported weeks = 373
rows per supported week = 28
duplicate week+symbol rows = 0
non-full parent weeks = 0
```

## Evaluation

Accepted evaluation method:

```text
npm run engine:research-manifest:evaluate -- --manifest=<gate57d manifest> --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

Sequential warehouse-only evaluation completed for all five manifests.

All accepted runs report:

- Runtime mode: `warehouse_aggregation`
- Runtime cache: `0/0/0`
- Missing ADR Grid price rows: `0`
- Missing Weekly Hold price rows: `0`
- Missing warehouse outcome rows: `0`; successful runs evaluated all requested
  manifest rows against the Gate 57A0B warehouse.
- Sum of evaluator-reported warehouse runtimes: `48.1s`
- Sequential command wall time including process overhead: `121.6s`

## ADR Grid Results

| Candidate | Weeks | Rows | Runtime | ADR | DD | R/DD | PF | Fills | TP | Reset | Week-close | Missing rows | ADR/row |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| parent selected | 373 | 10,444 | 8.6s | 1244.3749 | -691.1957 | 1.8003 | 1.2442 | 115,320 | 90,980 | 14,229 | 10,111 | 0 | 0.1191 |
| parent fade | 373 | 10,444 | 8.4s | 877.5425 | -436.3846 | 2.0109 | 1.1657 | 114,394 | 90,130 | 14,010 | 10,254 | 0 | 0.0840 |
| original binary | 373 | 10,444 | 10.3s | 1268.1378 | -350.5031 | 3.6181 | 1.3035 | 115,326 | 90,977 | 14,312 | 10,037 | 0 | 0.1214 |
| compressed selected remainder fade | 373 | 10,444 | 11.4s | 1339.8105 | -285.5127 | 4.6926 | 1.2864 | 114,401 | 90,236 | 14,289 | 9,876 | 0 | 0.1283 |
| compressed selected middle fade extreme selected | 373 | 10,444 | 9.4s | 1316.0476 | -564.9370 | 2.3295 | 1.3211 | 114,395 | 90,239 | 14,206 | 9,950 | 0 | 0.1260 |

## Weekly Hold Results

| Candidate | Weeks | Rows | ADR | DD | R/DD | PF | Missing rows | ADR/row |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| parent selected | 373 | 10,444 | -268.2949 | -526.9812 | -0.5091 | 0.8892 | 0 | -0.0257 |
| parent fade | 373 | 10,444 | 268.2949 | -209.9643 | 1.2778 | 1.1246 | 0 | 0.0257 |
| original binary | 373 | 10,444 | -42.0920 | -139.5781 | -0.3016 | 0.9540 | 0 | -0.0040 |
| compressed selected remainder fade | 373 | 10,444 | 436.1613 | -181.9718 | 2.3969 | 1.2349 | 0 | 0.0418 |
| compressed selected middle fade extreme selected | 373 | 10,444 | 209.9584 | -86.6383 | 2.4234 | 1.2461 | 0 | 0.0201 |

## Diagnostic Comparisons

Forced-28 ADR Grid comparison:

| Model | Rows/week | ADR | DD | R/DD | PF | Read |
|---|---:|---:|---:|---:|---:|---|
| parent selected | 28 | 1244.3749 | -691.1957 | 1.8003 | 1.2442 | Original FRS15 full selected. |
| original binary | 28 | 1268.1378 | -350.5031 | 3.6181 | 1.3035 | Gate 57C rule; better PF than compressed/remainder. |
| compressed/remainder | 28 | 1339.8105 | -285.5127 | 4.6926 | 1.2864 | Best ADR/DD/R-DD, but PF below original binary. |
| compressed/middle-fade/extreme-selected | 28 | 1316.0476 | -564.9370 | 2.3295 | 1.3211 | Best PF, but worse DD/R-DD. |

Decision-rule result:

```text
Strict lock condition: FAIL
Reason: compressed/remainder improves DD and R/DD versus original binary, but not PF.
```

This is evidence that Strength has a usable lifecycle shape, but the final
binary rule probably needs one additional point-in-time state dimension.

## Artifact Paths And Hashes

Per-run artifacts:

| Label | Result JSON | Result hash | Receipt hash | Equivalence key |
|---|---|---|---|---|
| parent selected | `docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/results/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-parent-selected-20260627T005104Z-A78CF038.result.json` | `9E8857B10C3F09175670C7299B1181CAEA4DC74098D8202725594F5CC0C36730` | `301892A633048742A06B55F8557B7BB1431041302D0FF358161553F60CB7011F` | `BA95AF40BD594612178617215C34769CB0AE1EA8EEFAA7179BDB61FB14F5636F` |
| parent fade | `docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/results/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-parent-fade-20260627T005119Z-90820405.result.json` | `FB7D7A6BC71567ACDF7355581F7045C732228DE577A213887462F75ACD01D1F4` | `C06043E30CC045588D0744E5CB314FD8E73F09F3FC8F5023E9CA77E42925C68B` | `145A72D256013BB57903F879D1DB4BF6211E5DA97FAFB2C4F3C470E075059F3E` |
| original binary | `docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/results/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-binary-lifecycle-selected-else-extreme-fade-20260627T005136Z-8FAB570A.result.json` | `E2941C3C0FAFCF579F58022B721F542674B28817AFBA8202394B91DE73C5B362` | `E890E8018825FC3598C3CB3D1779B419FB1881F06057A86F8EFD5833BB162C73` | `C1ED9A91B9028D7581508704A9FE6AF8556539A12919BA885B14DA2B8768B53B` |
| compressed/remainder | `docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/results/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-remainder-fade-20260627T005206Z-AAB42479.result.json` | `3DDCB326F0594BCE41F12C7C8F0FDFA8FE7858BD0D9C60124F9F2B5A92D05C80` | `EDAEF0C8F2E5A485D37ABF6FDE264A2D7E85E4E752B64119FB23849179A4976B` | `3537EDA1A6CA7FEB39DA52972B78D1645FBE92F37B9656723189DD9719A1D98A` |
| compressed/middle-fade/extreme-selected | `docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/results/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-middle-fade-extreme-selected-20260627T005235Z-90AA71FD.result.json` | `7E1BE7772092439D5607E4DD7A9CFA30C6D2989094620A3E550A75CDA325ED52` | `A994A272F8198EB4CC0C1CB00D81D55CF8D9DF87C9BFE0BC948AADDD75B26B7A` | `84C042799AAFF82291A46F1F11FAB28454BE15EEFBD76109D8310E1160CF68EB` |

Duplicate detection proof on compressed/remainder rerun:

```text
Equivalent research run already exists:
gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-remainder-fade-20260627T005206Z-AAB42479
Equivalence key:
3537EDA1A6CA7FEB39DA52972B78D1645FBE92F37B9656723189DD9719A1D98A
```

## Role Verdict

Gate 57D role classification:

| Role | Verdict |
|---|---|
| Selected directional layer | Not locked. Parent selected is inferior to lifecycle-aware variants. |
| Fade / contrarian layer | Non-compressed fade is alive, but not enough to lock the parent alone. |
| Ranking / eligibility layer | Still valid; `compressed_selected` remains the cleanest bucket-side source from Gate 57C. |
| Binary lifecycle forced-28 layer | Alive but not locked. Compressed/remainder improves DD/R-DD but misses PF lock condition. |
| Diagnostic only / parked | Do not park Strength yet; the evidence points toward a small 2D point-in-time state map. |

## Stop Line

Stop here and wait for explicit approval.

Still blocked:

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

Receipt hash: `D82E88E4B9ED8D61732C726207570FF9F51FF99852F191E7D5D1485BBDF9866D`

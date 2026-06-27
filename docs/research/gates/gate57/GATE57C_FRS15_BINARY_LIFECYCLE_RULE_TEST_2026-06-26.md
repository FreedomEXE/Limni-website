# Gate 57C FRS15 Binary Lifecycle Rule Test

Generated: 2026-06-26

## Verdict

PASS_WAREHOUSE_ONLY_DIAGNOSTIC__DO_NOT_LOCK_ORIGINAL_BINARY_RULE.

Gate 57C tested the proposed FRS15 binary lifecycle simplification through the
Gate 57A0B durable pair-week path outcome warehouse only. It added the missing
fade-side lifecycle bucket tests, then evaluated the forced-28 candidate:

```text
compressed + middle = selected
extreme = fade
```

The candidate is mechanically valid and materially improves the FRS15 parent
selected drawdown profile while preserving 28 rows per supported week:

| Comparison | ADR delta | DD improvement | R/DD delta | PF delta |
|---|---:|---:|---:|---:|
| binary lifecycle vs parent selected | +23.7629 | +340.6926 | +1.8178 | +0.0593 |

However, this gate also found the blocking contradiction requested in the
decision rule: `middle_fade` beats `middle_selected` on ADR Grid and Weekly
Hold. That means the original simple rule is not clean enough to lock as the
Strength algo. Stop here. Do not expand the search inside this gate.

Institutional read:

- `compressed_selected` remains the cleanest bucket-side signal.
- `middle_fade` beats `middle_selected`, so middle lifecycle behavior is not
  compatible with the proposed "normal spread = selected" rule.
- `extreme_fade` is only less bad than `extreme_selected`; it is not a strong
  positive ADR Grid contributor.
- The forced-28 binary candidate is viable as a diagnostic improvement over
  parent selected, but not a final lock candidate because the middle bucket
  points the other way.

Next gate, only if approved, should test one narrow replacement split derived
from this result. Do not add windows, deciles, regimes, COT+Strength, risk,
MT5/live, app work, or engine work.

## Boundaries

Frozen:

- Gate 55E price bundle:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Gate 57A0B warehouse:
  `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`
- ADR Grid and Weekly Hold semantics.
- COT logic and Gate 54 COT baseline.
- Gate 57B FRS15 source definition.
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

Gate 57C reuses the Gate 57B Friday-settled FRS15 source:

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

Gate 57C adds fade-side bucket manifests and the binary candidate:

```text
binary_lifecycle_selected_else_extreme_fade:
compressed + middle = selected side
extreme = opposite selected side
```

## Manifest Build

Command:

```text
npm run engine:gate57c:frs15-binary-manifests
```

Manifest build output:

- Build receipt:
  `docs/research/gates/gate57/receipts/GATE57C_FRS15_BINARY_LIFECYCLE_MANIFEST_BUILD_2026-06-26.md`
- Build receipt hash:
  `D0657A1205621723B4FC448FF0678DEAF9FCB86FB7A1E27A6EE44C610D7B4391`
- Ignored summary:
  `engine/reports/gate57c-frs15-binary-lifecycle/manifest-summary.json`
- Requested trade weeks: `387`
- Supported trade weeks: `373`
- Unsupported trade weeks: `14`
- Unsupported reason: first 14 requested weeks lack the required 15-week
  lookback inside the frozen Gate 55E bundle.
- First supported week: `2019-04-14T23:00:00.000Z`
- Last supported week: `2026-05-31T23:00:00.000Z`
- Build runtime: `38.1s`

## Manifest Shape

| Signal | Rows | Weeks | Rows/week | Long | Short | Duplicate rows | Non-full parent weeks | Manifest hash |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| compressed selected | 2,611 | 373 | 7 | 1,270 | 1,341 | 0 | 0 | `5B037322A6F8402990A31343DFFBCDC70E2452278F71DF0CBCCF813F5EECE2D1` |
| middle selected | 5,222 | 373 | 14 | 2,669 | 2,553 | 0 | 0 | `DD0101D6E7779AC7C007E90DA6B5BEC90EE224E2A0959322354BFE8573DD9358` |
| extreme selected | 2,611 | 373 | 7 | 1,454 | 1,157 | 0 | 0 | `973AEEF5BA4910F5CEE6C54E70B06C2F53EE7DE659F97D72677DE340B8F127D4` |
| compressed fade | 2,611 | 373 | 7 | 1,341 | 1,270 | 0 | 0 | `E9F525760E4F089C0B2E9251D7E49F06A7960A7D384456FABCB2466B9E5A7043` |
| middle fade | 5,222 | 373 | 14 | 2,553 | 2,669 | 0 | 0 | `6083349B67E5BFA4F5F1610F0E05DA406BB55F60F622F7DDB2FF76D1203A8CE2` |
| extreme fade | 2,611 | 373 | 7 | 1,157 | 1,454 | 0 | 0 | `7DC98960CDE87BDD862F5C966E12849EBF93AE77F1F0796C9C5D5D0475BAE5FB` |
| binary lifecycle | 10,444 | 373 | 28 | 5,096 | 5,348 | 0 | 0 | `A8DBADAF16C5BB5B16508DA6DAC4BCDDCC81A53D2DD19A880F7BEF4DE37A5D32` |
| parent selected | 10,444 | 373 | 28 | 5,393 | 5,051 | 0 | 0 | `B76955B5320E7AEAF2E2F33A0C56EA63104D130FE28EBD03790C311ACD34CC95` |
| parent fade | 10,444 | 373 | 28 | 5,051 | 5,393 | 0 | 0 | `01138ADF25F9069E9F0F12D93DFC7232BFD0B240660BD2C66940CE9D127868CB` |
| no extreme selected | 7,833 | 373 | 21 | 3,939 | 3,894 | 0 | 0 | `A189D4FA75C78AA20AC44BE2CD6FD6E9365DE3761638C815796865AADE241C26` |

Candidate 7 proof:

```text
binary_lifecycle_selected_else_extreme_fade rows = 10,444
supported weeks = 373
rows per supported week = 28
duplicate week+symbol rows = 0
non-full parent weeks = 0
```

## Evaluation

Accepted evaluation method:

```text
npm run engine:research-manifest:evaluate -- --manifest=<gate57c manifest> --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

Sequential warehouse-only evaluation completed for all ten manifests.

All accepted runs report:

- Runtime mode: `warehouse_aggregation`
- Runtime cache: `0/0/0`
- Missing ADR Grid price rows: `0`
- Missing Weekly Hold price rows: `0`
- Missing warehouse outcome rows: `0`; successful runs evaluated all requested
  manifest rows against the Gate 57A0B warehouse.
- Sum of evaluator-reported warehouse runtimes: `86.1s`
- Sequential command wall time including process overhead: `206.8s`

## ADR Grid Results

| Candidate | Weeks | Rows | Runtime | ADR | DD | R/DD | PF | Fills | TP | Reset | Week-close | Missing rows | ADR/row |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| compressed selected | 373 | 2,611 | 8.9s | 697.5492 | -118.8741 | 5.8680 | 1.5518 | 28,592 | 22,773 | 3,396 | 2,423 | 0 | 0.2672 |
| middle selected | 373 | 5,222 | 9.9s | 572.2976 | -354.0534 | 1.6164 | 1.2028 | 58,303 | 45,967 | 7,208 | 5,128 | 0 | 0.1096 |
| extreme selected | 373 | 2,611 | 5.1s | -25.4719 | -430.7950 | -0.0591 | 0.9884 | 28,425 | 22,240 | 3,625 | 2,560 | 0 | -0.0098 |
| compressed fade | 373 | 2,611 | 5.1s | 235.2812 | -191.2690 | 1.2301 | 1.1425 | 28,585 | 22,667 | 3,117 | 2,801 | 0 | 0.0901 |
| middle fade | 373 | 5,222 | 9.5s | 643.9703 | -315.3919 | 2.0418 | 1.2311 | 57,378 | 45,226 | 7,185 | 4,967 | 0 | 0.1233 |
| extreme fade | 373 | 2,611 | 9.9s | -1.7090 | -216.3388 | -0.0079 | 0.9992 | 28,431 | 22,237 | 3,708 | 2,486 | 0 | -0.0007 |
| binary lifecycle | 373 | 10,444 | 12.2s | 1268.1378 | -350.5031 | 3.6181 | 1.3035 | 115,326 | 90,977 | 14,312 | 10,037 | 0 | 0.1214 |
| parent selected | 373 | 10,444 | 9.3s | 1244.3749 | -691.1957 | 1.8003 | 1.2442 | 115,320 | 90,980 | 14,229 | 10,111 | 0 | 0.1191 |
| parent fade | 373 | 10,444 | 6.2s | 877.5425 | -436.3846 | 2.0109 | 1.1657 | 114,394 | 90,130 | 14,010 | 10,254 | 0 | 0.0840 |
| no extreme selected | 373 | 7,833 | 10.9s | 1269.8468 | -354.3502 | 3.5836 | 1.3665 | 86,895 | 68,740 | 10,604 | 7,551 | 0 | 0.1621 |

## Weekly Hold Results

| Candidate | Weeks | Rows | ADR | DD | R/DD | PF | Missing rows | ADR/row |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| compressed selected | 373 | 2,611 | 83.9332 | -53.8245 | 1.5594 | 1.1897 | 0 | 0.0321 |
| middle selected | 373 | 5,222 | -239.1267 | -303.4156 | -0.7881 | 0.8216 | 0 | -0.0458 |
| extreme selected | 373 | 2,611 | -113.1015 | -256.7215 | -0.4406 | 0.9013 | 0 | -0.0433 |
| compressed fade | 373 | 2,611 | -83.9332 | -100.4775 | -0.8353 | 0.8405 | 0 | -0.0321 |
| middle fade | 373 | 5,222 | 239.1267 | -114.4286 | 2.0897 | 1.2171 | 0 | 0.0458 |
| extreme fade | 373 | 2,611 | 113.1015 | -115.6847 | 0.9777 | 1.1095 | 0 | 0.0433 |
| binary lifecycle | 373 | 10,444 | -42.0920 | -139.5781 | -0.3016 | 0.9540 | 0 | -0.0040 |
| parent selected | 373 | 10,444 | -268.2949 | -526.9812 | -0.5091 | 0.8892 | 0 | -0.0257 |
| parent fade | 373 | 10,444 | 268.2949 | -209.9643 | 1.2778 | 1.1246 | 0 | 0.0257 |
| no extreme selected | 373 | 7,833 | -155.1935 | -274.7993 | -0.5648 | 0.8951 | 0 | -0.0198 |

## Diagnostic Comparisons

Bucket-side tests:

| Bucket | Selected ADR Grid | Fade ADR Grid | Read |
|---|---:|---:|---|
| compressed | 697.5492 | 235.2812 | Selected is clearly better. |
| middle | 572.2976 | 643.9703 | Fade is better; this blocks the proposed binary lock. |
| extreme | -25.4719 | -1.7090 | Fade is less bad, but not a strong edge. |

Forced-28 comparisons:

| Model | Rows/week | ADR | DD | R/DD | PF | Read |
|---|---:|---:|---:|---:|---:|---|
| parent selected | 28 | 1244.3749 | -691.1957 | 1.8003 | 1.2442 | Original FRS15 full selected. |
| parent fade | 28 | 877.5425 | -436.3846 | 2.0109 | 1.1657 | Broad fade is not the ADR Grid answer. |
| binary lifecycle | 28 | 1268.1378 | -350.5031 | 3.6181 | 1.3035 | Valid improvement, but middle-side contradiction blocks lock. |

Eligibility comparison:

| Model | Rows/week | ADR | DD | R/DD | PF | Read |
|---|---:|---:|---:|---:|---:|---|
| no extreme selected | 21 | 1269.8468 | -354.3502 | 3.5836 | 1.3665 | Slightly higher ADR/PF than binary, but not forced 28. |
| binary lifecycle | 28 | 1268.1378 | -350.5031 | 3.6181 | 1.3035 | Forced 28 with slightly better DD/R-DD than no-extreme. |

## Artifact Paths And Hashes

Per-run artifacts:

| Label | Result JSON | Result hash | Receipt hash | Equivalence key |
|---|---|---|---|---|
| compressed selected | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-compressed-selected-20260626T211227Z-5B037322.result.json` | `35D0B0A9380F48FDFD54EBCBE65A0FF06BC4921D8D107B473C49F0D5AB3879D8` | `59036204B48934A343427F5F9340D1CD885A3EC65E21063CD8619A811291B569` | `F9BD0AB868AB903E82F3D2C04E02F1B59DD5A382C8C24F5E8B518FD34434485D` |
| middle selected | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-middle-selected-20260626T211253Z-DD0101D6.result.json` | `2CE89150FBAEB3FBEEAB5D33689EBA768B35F686957633B4ADA8402B10489A2A` | `5BFA8459D713A1BCC649A40FDE5D4DCE24EDD836D4400FAB9822C1FE92531146` | `21D90E5D04ACFDF323DB01D06BECF458E760BAC1DCA735AC5278E958DC6DAC9D` |
| extreme selected | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-extreme-selected-20260626T211307Z-973AEEF5.result.json` | `660DFAC2CACE5DE1CE23C0EF88F093DDE39C7B26DAC59AACC3D2326214B6ED81` | `8A2CAB2206FA52988A7DCF189B97080376A91C0FB38DC536BE75874C2F41E41F` | `1530C68AC6D72ABE28A29C7F41FE4716EC5BC3C49E45302004B0C84728B59A27` |
| compressed fade | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-compressed-fade-20260626T211316Z-E9F52576.result.json` | `AC4700B602BFE856F0404C8789719455A6F671EC68480999D6F058D219398A4D` | `50C01EC73CFE2DEAD52E6FF25AE537E924136C06D2AF5CB8D225A43626A02749` | `E3CFE4F5CE89F7D73751543BE7AD2A085521480BB65E01C1506DC129C5E7CAFE` |
| middle fade | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-middle-fade-20260626T211331Z-6083349B.result.json` | `21BF4E1E0428A0A39431346EFAC5E4D435CCD2DF686619E37B2C44826A4A9C8D` | `594ADE7DA80126E7572BF336F57A66F8F33DD45B1D7B2661470A805A65C123C2` | `1A87753D396E50A189D6ED252AB3C7F66C22324943F401AE10494FEC621FBDF1` |
| extreme fade | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-extreme-fade-20260626T211353Z-7DC98960.result.json` | `4FFF9E7D30F26CB37DE41A0F0AE5AAD673EDEB18BFA6CFE841F74A56EDF2F22D` | `BDA0892E9F575AE24CE1340DC427C2613AE5926787B5284630897D21D3812BBF` | `99AE0DC5CCC1EE6C588B2082F28E30F91C60510A1888F1B0020050200254D481` |
| binary lifecycle | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-binary-lifecycle-selected-else-extreme-fade-20260626T211426Z-A8DBADAF.result.json` | `9B04D0F0926FA59F76732D2B1356CEABB6E9B850F62DA023DEC7E548B3B85681` | `CE24F1AAEA5884DF826B79C88833C967BA80BE5401758B9ADD92353C3D005472` | `BEE1366F35F87B7E888F5427B2391E158BE658D703CDBF62E6AD4E4C85FB0E51` |
| parent selected | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-parent-selected-20260626T211455Z-B76955B5.result.json` | `51B701430560564043C15D0A92C63D621156021DBC92F923F22C239C2B1A32D6` | `7CE1A72A0DA4CDA0DF966DE50FA222F3C46B5F597DEA0CC91F84D83CB6B0351B` | `C68025F5FD5D76ED30FBD8DC1E887FFBC0297B9E9CD5620220CFB5936280A6F2` |
| parent fade | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-parent-fade-20260626T211508Z-01138ADF.result.json` | `026B77B0801C52BED31344174FB0C07F861096761A2348049496BF72C2855CF5` | `1B8BA0CDF8E71D635D1FFF14F171B4C5A88041C53D92F0412AF633893B61B2F6` | `9535E54D23D5CAB85BAC59C2C6F59969D45EB213834DC54627C713721EB2580F` |
| no extreme selected | `docs/research/gates/gate57/artifacts/gate57c-frs15-binary-lifecycle-evaluation/results/gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-no-extreme-selected-20260626T211526Z-A189D4FA.result.json` | `FE2295714773D4907E95932BEC4CE3ACA80386D562F654B663644FF9A9A84E9D` | `F271A15970CF65FDDB8D65F89A30212A868E87E6AA252E9AB5170C82CD5FC19A` | `20A400DB5542E0F5355CE2264D4EB0F9222C8F803E92F1E16A7B2D2209270AC1` |

Duplicate detection proof on binary lifecycle rerun:

```text
Equivalent research run already exists:
gate57-frs15-binary-lifecycle-rule-test-gate57c-frs15-binary-lifecycle-selected-else-extreme-fade-20260626T211426Z-A8DBADAF
Equivalence key:
BEE1366F35F87B7E888F5427B2391E158BE658D703CDBF62E6AD4E4C85FB0E51
```

## Role Verdict

Gate 57C role classification:

| Role | Verdict |
|---|---|
| Selected directional layer | Not locked. Parent selected is alive, but bucket sides are not uniformly selected. |
| Fade / contrarian layer | Middle fade is live; full parent fade is not the main ADR Grid answer. |
| Ranking / eligibility layer | Still the strongest clean read because `compressed_selected` and `no_extreme_selected` remain high-quality. |
| Binary lifecycle forced-28 layer | Viable but not locked. Original selected-else-extreme-fade rule is contradicted by middle fade. |
| Diagnostic only / parked | Do not park Strength yet; this gate found a sharper lifecycle-side split to test later. |

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

Receipt hash: `B6CC4108696B491A013E1E6EB4698889B945DB35D927D9D331A69B97FEB13E10`

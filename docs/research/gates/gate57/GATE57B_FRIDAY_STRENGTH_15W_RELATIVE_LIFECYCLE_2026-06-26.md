# Gate 57B Friday Strength 15W Relative Lifecycle

Generated: 2026-06-26

## Verdict

PASS_WAREHOUSE_ONLY_FRS15_COMPRESSED_ELIGIBILITY_ALIVE.

Gate 57B tested the Friday-only, 15-week, currency-isolated relative Strength
concept through the Gate 57A0B durable pair-week path outcome warehouse. The
source uses only the frozen Friday snapshot: no market-open confirmation, no
Monday/open-week information, no raw M1 ADR Grid simulation, no new evaluator,
no COT changes, no regimes, no COT+Strength, no risk overlays, no MT5/live, and
no app work.

The institutional read is clear:

- The full parent 15-week selected signal is alive but does not beat the current
  Gate 55G/Gate 56E selected Strength baseline.
- The lifecycle split is the useful discovery. Bottom-quartile absolute score
  spread (`compressed_selected`) is the strongest ADR Grid role candidate.
- The extreme absolute-spread bucket is not useful under ADR Grid.
- `no_extreme_selected` keeps almost all parent ADR while sharply improving
  drawdown, R/DD, and PF.
- Strength should remain a ranking/eligibility layer candidate, not a
  "strongest score wins" directional rule.

Stop after this receipt. Do not add more windows, thresholds, buckets, regimes,
COT+Strength, risk overlays, MT5/live, or app work without explicit approval.

## Boundaries

Frozen:

- Gate 55E price bundle:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Gate 57A0B warehouse:
  `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`
- ADR Grid and Weekly Hold semantics.
- COT logic and Gate 54 COT baseline.
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

Gate 57B implements a Friday-settled relative Strength source:

```text
Friday freeze close
minus 15-week prior Friday freeze close
-> pair log return pct
-> isolate each major currency across its 7 related FX crosses
-> average oriented returns per currency
-> normalize the 8 currency scores to 0-100 within that Friday snapshot
-> pair side from base score versus quote score
```

Operational details:

- Source table: `canonical_price_bars`
- Source timeframe: `1m`
- Friday close lookup: latest 1m bar close at or before Friday freeze within
  `2880` minutes.
- The `2880` minute lookup is closure-safe Friday-only behavior. It handles
  Christmas/New Year style provider closures without using market-open data.
- Tie policy: carry previous supported Friday side for the same pair; otherwise
  use the pair return sign on the first supported Friday.
- Lifecycle buckets each supported week:
  - `compressed`: bottom 7 of 28 by absolute base/quote score spread
  - `middle`: middle 14 of 28
  - `extreme`: top 7 of 28
- Phase buckets: `initial`, `persistent`, `flip` versus previous supported
  Friday side for the same pair.

## Manifest Build

Command:

```text
npm run engine:gate57b:strength15w-manifests
```

Manifest build output:

- Build receipt:
  `docs/research/gates/gate57/receipts/GATE57B_FRIDAY_STRENGTH_15W_MANIFEST_BUILD_2026-06-26.md`
- Build receipt hash:
  `8504E283157FE57B3D0BCDE86538C7DE66479855193704891D4D696D6E546CBC`
- Ignored summary:
  `engine/reports/gate57b-friday-strength15w/manifest-summary.json`
- Requested trade weeks: `387`
- Supported trade weeks: `373`
- Unsupported trade weeks: `14`
- Unsupported reason: first 14 requested weeks lack the required 15-week
  lookback inside the frozen Gate 55E bundle.
- First supported week: `2019-04-14T23:00:00.000Z`
- Last supported week: `2026-05-31T23:00:00.000Z`
- Parent rows: `10,444`
- Parent duplicate rows: `0`
- Parent non-full weeks: `0`
- Build runtime: `24.8s`

## Manifest IDs

| Signal | Rows | Weeks | Manifest hash |
|---|---:|---:|---|
| parent_selected | 10,444 | 373 | `C78D99BD8252ACB6C38E33B9C78ABEF56771CD6311AEFE74188E1D86CC20043B` |
| parent_fade | 10,444 | 373 | `B07E5A4D8D38532EBCA5C036887528F37889FE5F8F7B1F8386C2F8EE049EE2DF` |
| compressed_selected | 2,611 | 373 | `5F1C3DFFE70BC60C152170A840EED3FAC62A18E48CD55CD446698A7953767285` |
| middle_selected | 5,222 | 373 | `A2D18FAFC62CB8D427DDBA2740582DCD38CFF5920E73444258C22BAF5D9C48D5` |
| extreme_selected | 2,611 | 373 | `D656F556467B4B696E1D2B46B2D879DFC6FCA1AE03659A7EAA498CC0F71FA1C9` |
| no_extreme_selected | 7,833 | 373 | `79D46B5CE925611550811F5560AA52C991DC688528838CB4CA5458F278B64A4D` |
| persistent_selected | 9,117 | 372 | `D9771E1612960FAA8C524A65894508FA1770E861E4B9C2D93DD96631A2CBFC95` |
| flip_selected | 1,299 | 352 | `42CAC91BF2482AE8A4AAB87A05FDEF0929F617CF702A4819B04033B8C46EFCC0` |

## Evaluation

Accepted evaluation method:

```text
npm run engine:research-manifest:evaluate -- --manifest=<gate57b manifest> --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

Sequential warehouse-only evaluation completed for all eight manifests.

All accepted runs report:

- Runtime mode: `warehouse_aggregation`
- Runtime cache: `0/0/0`
- Missing ADR Grid price rows: `0`
- Missing Weekly Hold price rows: `0`
- Warehouse missing outcome behavior: fail-closed by evaluator; successful
  runs evaluated all requested manifest rows.
- Sum of evaluator-reported warehouse runtimes: `49.9s`
- Sequential command wall time including process overhead: `78.5s`

## ADR Grid Results

| Candidate | Weeks | Rows | Runtime | ADR | DD | R/DD | PF | Fills | TP | Reset | Week-close | Missing rows | ADR/row |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| parent selected | 373 | 10,444 | 6.7s | 1244.3749 | -691.1957 | 1.8003 | 1.2442 | 115,320 | 90,980 | 14,229 | 10,111 | 0 | 0.1191 |
| parent fade | 373 | 10,444 | 6.6s | 877.5425 | -436.3846 | 2.0109 | 1.1657 | 114,394 | 90,130 | 14,010 | 10,254 | 0 | 0.0840 |
| compressed selected | 373 | 2,611 | 5.8s | 697.5492 | -118.8741 | 5.8680 | 1.5518 | 28,592 | 22,773 | 3,396 | 2,423 | 0 | 0.2672 |
| middle selected | 373 | 5,222 | 6.4s | 572.2976 | -354.0534 | 1.6164 | 1.2028 | 58,303 | 45,967 | 7,208 | 5,128 | 0 | 0.1096 |
| extreme selected | 373 | 2,611 | 6.1s | -25.4719 | -430.7950 | -0.0591 | 0.9884 | 28,425 | 22,240 | 3,625 | 2,560 | 0 | -0.0098 |
| no extreme selected | 373 | 7,833 | 6.2s | 1269.8468 | -354.3502 | 3.5836 | 1.3665 | 86,895 | 68,740 | 10,604 | 7,551 | 0 | 0.1621 |
| persistent selected | 372 | 9,117 | 6.9s | 1004.7311 | -638.9585 | 1.5725 | 1.2059 | 100,759 | 79,484 | 12,620 | 8,655 | 0 | 0.1102 |
| flip selected | 352 | 1,299 | 5.2s | 211.7274 | -116.0877 | 1.8239 | 1.2306 | 14,292 | 11,277 | 1,585 | 1,430 | 0 | 0.1630 |

## Weekly Hold Results

| Candidate | Weeks | Rows | ADR | DD | R/DD | PF | Missing rows | ADR/row |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| parent selected | 373 | 10,444 | -268.2949 | -526.9812 | -0.5091 | 0.8892 | 0 | -0.0257 |
| parent fade | 373 | 10,444 | 268.2949 | -209.9643 | 1.2778 | 1.1246 | 0 | 0.0257 |
| compressed selected | 373 | 2,611 | 83.9332 | -53.8245 | 1.5594 | 1.1897 | 0 | 0.0321 |
| middle selected | 373 | 5,222 | -239.1267 | -303.4156 | -0.7881 | 0.8216 | 0 | -0.0458 |
| extreme selected | 373 | 2,611 | -113.1015 | -256.7215 | -0.4406 | 0.9013 | 0 | -0.0433 |
| no extreme selected | 373 | 7,833 | -155.1935 | -274.7993 | -0.5648 | 0.8951 | 0 | -0.0198 |
| persistent selected | 372 | 9,117 | -318.7458 | -580.9088 | -0.5487 | 0.8706 | 0 | -0.0350 |
| flip selected | 352 | 1,299 | 44.8026 | -61.7152 | 0.7260 | 1.0907 | 0 | 0.0345 |

## Comparison To Gate 57A

Current Gate 55G/Gate 56E selected Strength remains the better full-parent ADR
Grid baseline:

| Parent model | Weeks | Rows | ADR | DD | R/DD | PF | ADR/row |
|---|---:|---:|---:|---:|---:|---:|---:|
| Existing selected | 387 | 10,836 | 1311.8526 | -698.5889 | 1.8779 | 1.2674 | 0.1211 |
| FRS15 parent selected | 373 | 10,444 | 1244.3749 | -691.1957 | 1.8003 | 1.2442 | 0.1191 |

The Gate 57B lifecycle split is stronger than the earlier Gate 57A weakest
absolute-spread candidate:

| Eligibility model | Rows | ADR | DD | R/DD | PF | ADR/row |
|---|---:|---:|---:|---:|---:|---:|
| Gate 57A weakest quartile selected | 2,709 | 546.5253 | -112.9896 | 4.8370 | 1.3873 | 0.2017 |
| Gate 57B FRS15 compressed selected | 2,611 | 697.5492 | -118.8741 | 5.8680 | 1.5518 | 0.2672 |

`no_extreme_selected` is also important:

| Comparison | ADR delta | DD improvement | R/DD delta | PF delta |
|---|---:|---:|---:|---:|
| FRS15 no-extreme vs FRS15 parent selected | +25.4719 | +336.8455 | +1.7833 | +0.1223 |

Interpretation: the useful structure is not "take the strongest Strength
spreads". The strongest-spread/extreme bucket is the bad part. The institutional
candidate is a Friday-settled eligibility/ranking rule that either prioritizes
compressed spreads or excludes extremes.

## Artifact Paths And Hashes

Per-run artifacts:

| Label | Result JSON | Result hash | Receipt hash | Equivalence key |
|---|---|---|---|---|
| parent selected | `docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-parent-selected-20260626T202811Z-C78D99BD.result.json` | `45B8E09A24502B1631FDBD16B65317C140B5AAB42576D9C5606E572E6E7BF2F9` | `9B34AADD9A831164DBAD386276F2B636DF20054F097F94433E60FF30230A8521` | `4E3D177CBA72F0BFD447BB71DC4420CF1C9A0FB4BCEC657F97CE8AC7417AB9DE` |
| parent fade | `docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-parent-fade-20260626T202823Z-B07E5A4D.result.json` | `E79A498B86B521D43AB63227EB0912483BC6FD545FC5F66F37510BC36B010138` | `17667A93A78019CE903FA3BCFFA7131C310EC7F120101CCFCD0C61E73510EA9F` | `3923C557D620ECBFCABC7DD39D3B4727EF16569BB2A3C10D2C5EE6E651137B03` |
| compressed selected | `docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-compressed-selected-20260626T202831Z-5F1C3DFF.result.json` | `0C4BACFD14A49BC7409461A53C917B5AA053D74F12AD034506CFEE79FFBB02BC` | `18C0B37ACE3BD7A6968EEBA1220B9A3F33384103C52E7BE3912285CC37A8B738` | `F84540176D6E35641F1AAC3FFCF83E1C9597CAB209078F6F6A11999F44FF80BD` |
| middle selected | `docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-middle-selected-20260626T202841Z-A2D18FAF.result.json` | `A8C6E39D80448B429B88067AE13C09436B3890C0EDA427B31B07DAFF8B488D58` | `8637692E488A1CFA9BAAD2050AD1B2ED88027791025B599FF7B3F592FD57C45F` | `684593097A1FCEA59DE4EEA04517B8A134576C5BEF8134888CBB529011B779DC` |
| extreme selected | `docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-extreme-selected-20260626T202849Z-D656F556.result.json` | `2CE580512678E2F5B48BE5F35888311B537E7117F09DD55D3C30D8D766EF1CDB` | `DA9E1B3ED08555D248F5CB60EDCC271880A08C9887DA7CA4E5D7699CBA4692BB` | `2ACD6CD51FED1BA597AEB12ADF170BC56E7DB176A031E12A54E65896A85D54CB` |
| no extreme selected | `docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-no-extreme-selected-20260626T202859Z-79D46B5C.result.json` | `0BF5ABFC8637D4536E31B17F35FEBC35214A8C6870A8B907E68DC3FD10AE18CC` | `D2DF8278D1ABA245C204A5D86854890102C4AA3852322B84A6228691ADE69C37` | `72E180194F7D0C0B6E9AA0D5BAE90C38A03575FB2D36406E9BF3AC679E08BFA6` |
| persistent selected | `docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-persistent-selected-20260626T202911Z-D9771E16.result.json` | `D826217EB14ECD06D884C84A8885F354A20D3F65B16EE183FFB45ED3689378E2` | `38ECE82A59005CD9C027E55081718BB589E59BF8612F2C66988FA67CDC46C228` | `EE2942CC4D838AE48E9057EE52CD942123215EC9198FCBB792194C79E945E072` |
| flip selected | `docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-flip-selected-20260626T202918Z-42CAC91B.result.json` | `19B6532E35A899D276186AECA43336B883B0C411FF4A874C2C75372ED63765B0` | `B848D22E6063CEC2622DEAFA4AA89848CDC3680EF978D952720A89D54D590F79` | `B29DD81CA3F184900CC47660F072CC03268C5CF7E2A09502A92B10D004695D91` |

Duplicate detection proof:

```text
Equivalent research run already exists:
gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-parent-selected-20260626T202811Z-C78D99BD
Equivalence key:
4E3D177CBA72F0BFD447BB71DC4420CF1C9A0FB4BCEC657F97CE8AC7417AB9DE
```

## Role Verdict

Gate 57B role classification:

| Role | Verdict |
|---|---|
| Selected directional layer | Alive but not better than existing selected as a full-parent signal. |
| Fade / contrarian layer | Weekly Hold context only; not the primary ADR Grid role. |
| Ranking / eligibility layer | Strongest evidence. FRS15 compressed selected and no-extreme selected are the useful shapes. |
| Rolling/lifecycle-normalized layer | Lifecycle split is useful; the bad lifecycle state is extreme spread, not low spread. |
| Diagnostic only / parked | Do not park Strength yet. It has a cleaner Friday-only eligibility path. |

Recommended next decision, if approved later:

```text
Gate 57C - Strength Friday Eligibility Robustness
```

Keep it narrow. Test only whether `compressed_selected` and/or
`no_extreme_selected` survive one or two predeclared robustness checks. Do not
open an unconstrained Strength search.

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

Receipt hash: `3FA2B1E09BDC5F710F8C9F288E2E91B2FCCB03EC93885A7FFCB199C91174B07D`

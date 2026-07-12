# Gate 57A Strength Warehouse Role Evaluation

Generated: 2026-06-26

## Verdict

PASS_WAREHOUSE_ONLY_STRENGTH_ALIVE_ROLE_LIMITED.

Gate 57A phase 2 evaluated the five preflighted Strength candidate contracts
through the Gate 57A0B durable pair-week path outcome warehouse. The evaluation
used warehouse aggregation only. It did not run raw M1 ADR Grid path
simulation, change evaluator semantics, create a new backtest engine, change
COT logic, run regimes, run COT+Strength, run risk overlays, touch MT5/live
work, or touch app work.

Strength is alive, but the stable role is not "strongest Strength wins".
Current evidence supports:

- Broad selected Strength remains the full-horizon ADR Grid directional
  baseline.
- Weakest absolute-spread quartile under selected direction is the strongest
  role-limiting/ranking candidate in this test.
- Rolling 52-week context selected is not an independently improved
  lifecycle-normalized signal; it is identical to the same-window selected
  control.
- Fade remains useful Weekly Hold context, but not the primary ADR Grid role.

Stop after this receipt. Do not add rolling windows, bucket families, regimes,
COT+Strength, risk overlays, MT5/live, or app work without explicit approval.

## Boundaries

Frozen:

- Gate 55E price bundle:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Gate 57A0B warehouse:
  `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`
- ADR Grid and Weekly Hold semantics.
- COT logic and Gate 54 COT baseline.
- Gate 55F/G Strength source and Friday-selected source context.

Not run:

- Raw M1 ADR Grid simulation.
- New evaluator or backtest engine.
- Threshold optimization by PnL.
- Additional bucket families, deciles, 104-week windows, or 156-week windows.
- Regimes.
- COT+Strength.
- Risk overlays.
- MT5/live.
- App/dashboard/refactor work.

## Execution

Initial batch attempt:

```text
npm run engine:research-manifest:evaluate -- [7 manifests] --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

The all-at-once batch failed before writing results with a PostgreSQL connection
timeout during concurrent warehouse inspection. The failure was not a strategy,
evaluator, or warehouse-content failure.

Accepted run method:

```text
Same command shape, run sequentially one manifest at a time with explicit --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B.
```

Sequential warehouse-only evaluation completed in approximately `129` seconds
for the seven runs: five candidate contracts plus two same-window controls.

All accepted runs report:

- Runtime mode: `warehouse_aggregation`
- Runtime cache: `0/0/0`
- Missing price rows: `0`
- Warehouse ID:
  `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Candidate Results

ADR Grid:

| Candidate | Weeks | Rows | Runtime | ADR | DD | R/DD | PF | Fills | TP | Reset | Week-close | Missing rows | ADR/row |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| existing selected | 387 | 10,836 | 5.6s | 1311.8526 | -698.5889 | 1.8779 | 1.2674 | 119,147 | 93,777 | 14,487 | 10,883 | 0 | 0.1211 |
| existing fade | 387 | 10,836 | 9.3s | 988.7181 | -653.5674 | 1.5128 | 1.1794 | 118,460 | 93,523 | 14,643 | 10,294 | 0 | 0.0912 |
| strongest quartile selected | 387 | 2,709 | 6.4s | 174.7853 | -373.2471 | 0.4683 | 1.0834 | 29,749 | 23,328 | 3,550 | 2,871 | 0 | 0.0645 |
| weakest quartile selected | 387 | 2,709 | 10.4s | 546.5253 | -112.9896 | 4.8370 | 1.3873 | 29,359 | 23,308 | 3,321 | 2,730 | 0 | 0.2017 |
| rolling 52w context selected | 335 | 9,380 | 7.6s | 1671.1975 | -364.7738 | 4.5815 | 1.4121 | 103,613 | 81,854 | 12,679 | 9,080 | 0 | 0.1782 |

Weekly Hold:

| Candidate | Weeks | Rows | ADR | DD | R/DD | PF | Missing rows | ADR/row |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| existing selected | 387 | 10,836 | -315.1911 | -377.0083 | -0.8360 | 0.8666 | 0 | -0.0291 |
| existing fade | 387 | 10,836 | 315.1911 | -230.8041 | 1.3656 | 1.1540 | 0 | 0.0291 |
| strongest quartile selected | 387 | 2,709 | -112.1407 | -177.0966 | -0.6332 | 0.8989 | 0 | -0.0414 |
| weakest quartile selected | 387 | 2,709 | 20.2038 | -103.7744 | 0.1947 | 1.0355 | 0 | 0.0075 |
| rolling 52w context selected | 335 | 9,380 | -165.6235 | -240.3576 | -0.6891 | 0.9164 | 0 | -0.0177 |

## Same-Window Controls

The rolling 52-week candidate was compared against selected and fade controls
on the same 335-week, 9,380-row supported window.

| Comparison | ADR Grid ADR delta | ADR Grid PF delta | ADR Grid R/DD delta | ADR Grid DD delta | Weekly Hold ADR delta |
|---|---:|---:|---:|---:|---:|
| rolling 52w selected vs same-window selected | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| rolling 52w selected vs same-window fade | 1044.1819 | 0.2873 | 3.6221 | 288.7936 | -331.2470 |

Interpretation: rolling 52-week context did not add a new Strength lifecycle
normalization effect. It simply restricts evaluation to the post-support window.
The apparent improvement versus full-horizon selected is a window effect unless
a later, explicitly approved test adds a real historical-context transform.

## Ranking Signal

The quartile test gives the main role-lock signal:

| Comparison | ADR Grid ADR/row delta | ADR Grid PF delta | ADR Grid R/DD delta | ADR Grid DD delta |
|---|---:|---:|---:|---:|
| strongest quartile selected vs existing selected | -0.0566 | -0.1840 | -1.4096 | 325.3418 |
| weakest quartile selected vs existing selected | 0.0806 | 0.1199 | 2.9591 | 585.5993 |

The strongest absolute-spread quartile under selected direction is not the
winner. The weakest absolute-spread quartile has the best ADR Grid R/DD
(`4.8370`), the smallest drawdown (`-112.9896`), the best PF among the
preflighted candidate contracts (`1.3873`), and the best ADR per row
(`0.2017`).

This is not enough to declare final production logic. It is enough to say
Strength should be treated as alive and role-limited, with the next narrow
question centered on ranking/eligibility, not open-ended bucket search.

## Artifact Paths And Hashes

Ignored local summary:

```text
engine/reports/gate57a-strength-role-evaluation/metrics-summary.json
engine/reports/gate57a-strength-role-evaluation/input-manifest-summary.json
```

Per-run artifacts:

| Label | Result JSON | Result hash | Receipt hash | Equivalence key |
|---|---|---|---|---|
| existing selected | `docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260626T193557Z-33DB0459.result.json` | `BA6799EED1A8D14774B837FFC5565AE743BAB1E4D72569981C4FA23A423616F7` | `5B2B5ABB456AB1DDF06633742BE92EC1F41C8F8EDCCC4FA031A7E4620F8C8FAA` | `F7FC75648247393CD325B609492B36B438304CB9F1642EA247120079F77ACBDB` |
| existing fade | `docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260626T193612Z-BB3142AF.result.json` | `58731751502FA37E24B53D8C67C964E959B8BE36C52672E71EE7F761494AEC4B` | `D8622831E31B5F8301F066F0D3C08DB8E189C1DC142DA654BF6C828D8C05C4CF` | `9BD957FEA31E4D3932A2462AD6C658A186F770F4A7EE8E3A6F3CDF5EA7456971` |
| strongest quartile selected | `docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-strongest-quartile-selected-20260626T193622Z-97A12B87.result.json` | `FEF967003CF5643074BE0817F5F990EC75EEBCBEA709CA50A42CA2005FD103C4` | `D6309CA46127FC00849C5DCB8895E49F0DC24FC774BD9AF1693AC9AA89627E7A` | `9E7319747482BFCE813ECED19FCB92E61F77067AB1B77D11CE5F663EE0C26768` |
| weakest quartile selected | `docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-weakest-quartile-selected-20260626T193641Z-BD861B66.result.json` | `8F94F4F52B44E27902AC070F9C9F51FC151FD4A93AB357E5963D209349D8CBA9` | `9FA87DC3B97575A8C7C62975FB96D58AADB95E95192B6D7D05AFA12AB58B3811` | `B5E6B214B90885067AE3A78DABA505CD2C77FE61E69DA3D8315621A49D855FBF` |
| rolling 52w context selected | `docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-rolling-52w-context-selected-20260626T193658Z-A2FB501D.result.json` | `C11F972AEC41C38888C0F8B799A6434CF3E487DBC98A8D38F4F2F117B4A806F8` | `17E83E3E99E6D31CDD3D10F1A8FEB0FDD37DFD4C9074414B9B21F22D22C9241A` | `AE131D571F3482B3F7F69346EAE5731B04E06BDCE07AC8865AA24A131CC2307C` |
| control selected same-window rolling52 | `docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate57a-strength-role-evaluation-control-gate57a-control-selected-same-window-rolling52-20260626T193715Z-C100B45F.result.json` | `DD3415CBDF7F7BB8CB9FE4C6595B04E3C9BE5390BECC2D7D512FA4084A301D7F` | `92FCC07E10D154DA16F3DC0CB9EDF99C4FA8A54D19EC8AE2D138BC68BC619F18` | `7743453CDAF84B4165B5103291A3DF91664933A662B51672EAA5D7FBD2D64735` |
| control fade same-window rolling52 | `docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate57a-strength-role-evaluation-control-gate57a-control-fade-same-window-rolling52-20260626T193756Z-7AF6C273.result.json` | `CEBCD0B4AEADCC483C4A70F796331B6C4346D1AE0669AC72F9B23001287B8446` | `01EEB86B7BBD32C638E277E0951AEFBC502CF238BD65825CCB185D4452029304` | `F4F07EA2F2DFADDE24BC7970334753861151DE0C47216FCAD47443A918C9708A` |

Duplicate detection proof: rerunning the seven manifests against the same
artifact directory returned existing equivalent runs with the equivalence keys
listed above instead of rescoring.

## Role Verdict

Gate 57A phase 2 role classification:

| Role | Verdict |
|---|---|
| Selected directional layer | Alive as the broad ADR Grid baseline. |
| Fade / contrarian layer | Useful Weekly Hold context only; not the main ADR Grid path. |
| Ranking / eligibility layer | Strongest evidence in this phase, specifically weakest absolute-spread quartile under selected direction. |
| Rolling-context / lifecycle-normalized layer | Not proven; rolling 52w is identical to same-window selected. |
| Diagnostic only / parked | Do not park Strength yet. It has a role-limited path worth a narrow next gate. |

Recommended next decision, if approved later:

```text
Gate 57B - Strength Ranking Eligibility Robustness
```

That gate should be narrow and predeclared. It should not open broad Strength
search. It should only test whether the weakest-absolute-spread eligibility
signal survives one or two controlled robustness checks.

## Stop Line

Stop here and wait for explicit approval.

Still blocked:

- More rolling windows.
- More buckets or deciles.
- Regime filters.
- COT+Strength.
- COT source/tie-policy changes.
- Strength source logic changes.
- ADR Grid or Weekly Hold semantic changes.
- Risk overlays.
- MT5/live/bot work.
- App refactor work.
- Final combined system selection.

Receipt hash: `8B6D3FBCCDF88A8BF92F6B6199AD76BF6BA862EC68058EF34C58252ECB4739DA`

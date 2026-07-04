# Gate 91 Formulaic V2.3 Add-Feed Throttle Diagnostic

Generated: 2026-07-03

## Verdict

`FAIL_V2_3_ADD_FEED_THROTTLE_NOT_STABLE_KEEPER_NO_PROMOTION`

Gate 91 v2.3 implemented the bounded fourth-reviewer test:

```text
v2.1 floor-pin base
+ first-adverse-add bypass
+ local reversion evidence since last fill
+ late-session reversion evidence
+ late-session last-3 center progress
```

Result:

```text
Late-session reversion evidence improved 2019.
It did not travel to 2026.
All-session reversion evidence and progress-last3 were too blunt.
```

V2.3 produced useful receipts, but it is not the next keeper. The current best
pure-grid geometry base remains:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

## What Was Implemented

New activation rows:

```text
triangle_formulaic_directionless_geometry_v2_floorpin_reversion_evidence
triangle_formulaic_directionless_geometry_v2_floorpin_late_reversion_evidence
triangle_formulaic_directionless_geometry_v2_floorpin_progress_last3
```

All rows stayed directionless:

- No Candidate B.
- No David side bias.
- No Katarakti trigger.
- No red-news logic.
- No MT5/live/app work.
- No promotion.

Execution surface:

- all 28 pairs for bounded windows
- bar path `open`
- signal clock `m1`
- target mode `session_center_band_reversion`
- grid adds `adverse_only`
- session mode `ny_daily_window`
- trade window `18:05..15:45 ET`
- flatten `16:00 ET`
- Sunday start `20:00 ET`
- protection mode `baseline`

## V2.3 Rules

### First Adverse Add Bypass

The first adverse add bypasses every v2.3 throttle. The throttle governs
continued bad feeding, not the first recovery add.

### Reversion Evidence

For continued adverse adds:

```text
local_reversion_evidence_units =
  max(0, local_max_pnl_since_last_fill - pnl_at_last_fill) / Q

required_reversion_evidence =
  min(0.50, 0.10 + 0.05 * depth)
```

Pass:

```text
local_reversion_evidence_units >= required_reversion_evidence
```

### Late-Session Reversion Evidence

Same local reversion rule, but only when:

```text
tau = minutes_until_flatten / clean_session_minutes
tau < 0.25
```

### Progress Last-3 Center

Late in session, while the basket is red:

```text
block if current_distance_to_existing_cycle_target_center
  > average_distance_to_center(last_3_fills)
```

This uses the existing v2 cycle target center. No new center definition was
introduced.

## Receipts Added

The runner now writes:

```text
add-throttle-events.rows.json
add-throttle-events.rows.csv
```

Each row records a unique proposed adverse-add decision, including:

- actual allow/block decision
- first-add bypass state
- minutes/tau until flatten
- local MFE and MAE since last fill
- required reversion evidence
- current and last-3 fill distance to the existing target center
- eventual cycle close reason
- eventual price PnL ADR, net USD, max PnL ADR, and min PnL ADR

Validation was clean:

| Run | Validation rows | Failed | Add-throttle events |
|---|---:|---:|---:|
| Smoke AUDCHF 2019 1W | `59` | `0` | `49` |
| 2019 all pairs | `59` | `0` | `81209` |
| 2026 all pairs | `59` | `0` | `51817` |

## Smoke Result

Window: `AUDCHF`, week `2019-04-14`.

| Row | ADR units | Account % | PF | Entries | Max depth | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|
| v2.1 floor-pin base | `1.836110` | `0.0774` | `2.271787` | `28` | `4` | `13.73` | `-5.99` |
| all-session reversion evidence | `1.636375` | `0.0678` | `2.113249` | `27` | `4` | `12.77` | `-5.99` |
| late reversion evidence | `1.646125` | `0.0682` | `2.120596` | `27` | `4` | `12.81` | `-5.99` |
| progress last3 | `1.673392` | `0.0702` | `2.192062` | `26` | `3` | `12.81` | `-5.79` |

Smoke was not decisive. It only proved the rows execute and receipts populate.

## 2019 Result

Window: `2019-04-14..2019-12-30`, all pairs.

| Row | ADR units | Account % | PF | Weekly PF | Entries | Max open | Max depth | Max DD % | Return/DD | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v2.1 floor-pin base | `728.107258` | `23.5524` | `1.097770` | `1.393284` | `32772` | `277` | `46` | `-24.7650` | `0.951036` | `19306.69` | `-16951.45` |
| all-session reversion evidence | `490.409668` | `10.0879` | `1.056220` | `1.277979` | `25438` | `162` | `21` | `-18.9419` | `0.532571` | `14700.61` | `-13691.82` |
| late reversion evidence | `776.657311` | `26.5915` | `1.115710` | `1.487226` | `31089` | `276` | `32` | `-19.2670` | `1.380294` | `18973.89` | `-16314.74` |
| progress last3 | `652.171907` | `19.6636` | `1.088063` | `1.363867` | `28386` | `271` | `30` | `-18.8955` | `1.040679` | `18494.03` | `-16527.67` |

2019 read:

```text
Late-session reversion evidence improved the base.
All-session reversion evidence and progress-last3 were too blunt.
```

The late row improved account return, PF, weekly PF, max depth, max DD, and
Return/DD versus v2.1 floor-pin. It still did not reach institutional target
quality, but it was a real bounded improvement in 2019.

## 2026 Result

Window: `2025-12-08..2026-05-31`, all pairs.

| Row | ADR units | Account % | PF | Weekly PF | Entries | Max open | Max depth | Max DD % | Return/DD | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v2.1 floor-pin base | `496.655106` | `10.7569` | `1.069909` | `1.335111` | `21065` | `187` | `83` | `-10.1006` | `1.064976` | `12388.39` | `-11312.70` |
| all-session reversion evidence | `189.598864` | `-2.2142` | `0.981636` | `0.912575` | `16514` | `117` | `24` | `-7.5847` | `-0.291933` | `9578.66` | `-9800.08` |
| late reversion evidence | `432.060823` | `6.8245` | `1.044118` | `1.208111` | `20372` | `186` | `83` | `-11.6556` | `0.585516` | `12312.33` | `-11629.89` |
| progress last3 | `381.613968` | `4.7702` | `1.031867` | `1.150613` | `18697` | `181` | `83` | `-11.4296` | `0.417352` | `12136.52` | `-11659.50` |

2026 read:

```text
No v2.3 row beat the v2.1 floor-pin base.
```

All-session reversion evidence cut depth but destroyed return and PF.
Late-session reversion evidence did not reduce max depth, worsened drawdown,
worsened flatten net, and lowered PF/Return-DD. Progress-last3 had the same
problem.

## Blocked-Add Receipt Read

Baseline shadow receipts ask whether candidate blocks were actually worse than
candidate allows in the unthrottled v2.1 base.

### 2019 Baseline Shadow

| Candidate split | Rows | Target % | Avg net USD | Avg ADR |
|---|---:|---:|---:|---:|
| all-session reversion fail | `5879` | `24.51` | `-14.836545` | `-2.320468` |
| all-session reversion pass | `11005` | `22.76` | `-11.605642` | `-1.810436` |
| late reversion fail | `1444` | `9.76` | `-32.831176` | `-5.974812` |
| late reversion pass | `2946` | `5.40` | `-17.778706` | `-2.999888` |
| progress fail | `4359` | `6.56` | `-22.906884` | `-3.979555` |
| progress pass | `31` | `45.16` | `2.155472` | `-3.819998` |

2019 supports the hypothesis directionally: candidate blocked late-reversion
adds were worse than candidate allowed late-reversion adds.

### 2026 Baseline Shadow

| Candidate split | Rows | Target % | Avg net USD | Avg ADR |
|---|---:|---:|---:|---:|
| all-session reversion fail | `3464` | `24.88` | `-21.079468` | `-3.556358` |
| all-session reversion pass | `7103` | `23.60` | `-12.091386` | `-1.795450` |
| late reversion fail | `647` | `5.10` | `-14.446169` | `-2.162680` |
| late reversion pass | `1721` | `5.17` | `-14.591098` | `-2.217708` |
| progress fail | `2368` | `5.15` | `-14.551499` | `-2.202673` |
| progress pass | `0` | n/a | n/a | n/a |

2026 is the falsifier. All-session reversion failure did identify worse
baseline events, but the actual all-session throttle removed too much target
profit. Late reversion did not separate bad adds from acceptable adds in 2026.
Progress-last3 had no useful pass population in the late red state.

## Decision

Do not promote v2.3.

Do not keep all-session reversion evidence as a keeper.

Do not keep progress-last3 as a keeper.

Late-session reversion evidence is a useful diagnostic because it improved 2019
and exposed late-feed structure, but it is not stable enough to replace v2.1
floor-pin after the 2026 bounded run.

Current pure-grid keeper remains:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

## Researcher Opinion

The hypothesis was partially right:

```text
Bad cycles do go adverse without bending.
```

But the v2.3 rule is not enough:

```text
Not every no-bend add is removable edge.
```

In 2026, the add-feed throttle reduced feed but failed to improve the complete
cycle economy. That means the remaining failure is not just local add quality.
It is likely a mix of direction/trigger context and session lifecycle. Pure
directionless add throttling is near its standalone ceiling under this daily
flatten surface.

## Artifacts

- Smoke:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v23-smoke-audchf-2019-1w/GATE91_FORMULAIC_V23_SMOKE_AUDCHF_2019_1W.md`
- 2019 bounded:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v23-ab-2019-open/GATE91_FORMULAIC_V23_AB_2019_OPEN.md`
- 2026 bounded:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v23-ab-2026-open/GATE91_FORMULAIC_V23_AB_2026_OPEN.md`
- Add-throttle receipts:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v23-ab-2019-open/add-throttle-events.rows.csv`
  and
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v23-ab-2026-open/add-throttle-events.rows.csv`

## Stop Line

Gate 91 remains formulaic grid-geometry research only. No MT5/live/app work,
no promotion, no red-news implementation, no 2020/year-by-year expansion, no
full matrix restart, no full seven-pair handshake gate, no Candidate B
direction dependency, no David side bias, and no Katarakti trigger integration.

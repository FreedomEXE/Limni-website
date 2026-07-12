# Gate 91 v2.3 Outside Review Synthesis

Generated: 2026-07-03

## Verdict

`PASS_V2_3_REVIEW_SYNTHESIS__PROGRESS_GATE_REVIEW_BEFORE_IMPLEMENTATION`

Three outside reviews were compared after the Gate 91 v2.2 diagnostic:

- Grok
- Gemini
- ChatGPT

Consensus:

```text
V2.2 reduced depth but did not improve edge.
Depth reduction alone is not edge.
The next pure-grid question is whether the basket has shown local bending
since the last fill.
```

The current keeper remains:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

with v2.1 surplus retained as a near-identical companion receipt. V2.2
terminal-horizon and basket-solvency are not keeper candidates.

## What V2.2 Proved

V2.2 tested:

```text
v2.1 floor-pin base
+ terminal-horizon add feasibility
+ basket green-close solvency
```

Result:

- Basket solvency was non-binding in both bounded windows: `0` blocks.
- Terminal horizon blocked roughly `84%` of add-feasibility checks.
- Terminal horizon reduced max depth but damaged PF, return, Return/DD,
  Sharpe, Sortino, and Calmar.

The failure is not simply:

```text
too many adds
```

The failure is:

```text
too many bad feeds: adverse adds into cycles that are not bending back.
```

## Review Inputs

### Grok

Useful idea:

```text
Late-session adverse adds should require recent reversion evidence since the
last fill.
```

Suggested scaffolds:

- `MFE_since_last_fill >= 0.40Q`
- or `MFE_since_last_fill / MAE_since_last_fill >= 0.68`
- optional stricter requirement in the final session segment

Read:

```text
Keep the MFE/MAE structure.
Treat the constants as research rails, not final law.
```

### Gemini

Useful idea:

```text
Progress gate: in the final session segment, block a new adverse add if price
is farther from the center than the recent fill average.
```

Suggested scaffold:

```text
tau = minutes_until_flatten / clean_session_minutes

if tau < 0.25 and basket_pnl < 0:
  if current_distance_from_center > average_distance_from_center_last_3_fills:
    block add
```

Read:

```text
Last-3-fill center progress is cheap to compute in the current runner because
cycles already store ordered fill prices.
```

### ChatGPT

Useful idea:

```text
Bad grid cycles do not just go adverse; they go adverse without bending.
```

Suggested scaffold:

```text
reversion_evidence_units = reversion_since_last_fill / Q_cycle
required_reversion_evidence = min(0.50, 0.10 + 0.05 * depth)
```

Optional late factor should be tested separately, not baked into the first row.

Read:

```text
The clean first hypothesis is local reversion evidence before continued
adverse feeding.
```

## Recommended V2.3 Review Set

The next Codex pass should act as a fourth reviewer before implementation.
Do not code until the exact bounded test rows are accepted.

Candidate rows to review:

### A. Baseline

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

Purpose: preserve the current best base.

### B. Reversion-Evidence Add Throttle

Working name:

```text
triangle_formulaic_directionless_geometry_v2_floorpin_reversion_evidence
```

Rule:

```text
Before a continued adverse add, require local reversion since the previous
adverse fill.
```

Possible scaffold:

```text
required_reversion_evidence = min(0.50, 0.10 + 0.05 * depth)
reversion_evidence_units = reversion_since_last_fill / Q_cycle

allow_add = reversion_evidence_units >= required_reversion_evidence
```

Review question:

```text
Should the first add bypass this throttle?
```

Initial preference: yes. The throttle should govern continued feeding, not the
first recovery add.

### C. Late-Session Reversion-Evidence Add Throttle

Working name:

```text
triangle_formulaic_directionless_geometry_v2_floorpin_late_reversion_evidence
```

Rule:

```text
Apply row B only when tau is late.
```

Candidate late threshold:

```text
tau < 0.40
```

or the more conservative Gemini threshold:

```text
tau < 0.25
```

Review question:

```text
Should v2.3 test non-time evidence first, or late-only evidence first?
```

Initial preference: include both as separate bounded rows.

### D. Progress Gate Last-3 Center

Working name:

```text
triangle_formulaic_directionless_geometry_v2_floorpin_progress_last3
```

Rule:

```text
if tau < 0.25 and basket_pnl < 0:
  block if current distance from center is greater than the average distance
  from center across the last 3 fills
```

Review question:

```text
Should this use median M1 center from v2.1/v2.2 or the target band center?
```

Initial preference: use the same formulaic center already receipted by the
cycle target, not a new center definition.

## Required Diagnostics

V2.3 must not be judged by max depth alone.

Required report metrics:

- entries
- max open
- max depth
- median depth if available
- p95 depth if available
- PF
- Sharpe
- Sortino
- Calmar
- MFE/MAE
- expectancy ADR
- Return/DD
- profitable weeks
- max losing-week streak
- target-close net
- session-flatten net
- blocked-add count
- blocked-add forward outcome if feasible
- allowed-add forward outcome if feasible

The most important diagnostic:

```text
Did blocked adds have worse forward outcomes than allowed adds?
```

If yes, v2.3 found bad-feed structure.

If no, v2.3 is another exposure reducer and should be rejected like v2.2.

## Success Threshold

Do not require final promotion targets yet. For the bounded v2.3 diagnostic,
success means:

- keep most of v2.1 return
- improve or preserve PF versus v2.1
- improve MFE/MAE versus v2.1
- reduce max depth without proportional entry collapse
- improve or preserve Return/DD in both 2019 and 2026
- reduce flatten loss without killing target-close profit

Reference anchors:

| Window | V2.1 account % | V2.1 PF | V2.1 Return/DD | V2.1 max depth |
|---|---:|---:|---:|---:|
| 2019 | `23.55` | `1.098` | `0.951` | `46` |
| 2026 | `10.76` | `1.070` | `1.065` | `83` |

## Stop Line

Gate 91 remains formulaic grid-geometry research only.

Do not add:

- Candidate B direction
- David side bias
- Katarakti trigger
- red-news logic
- MT5/live/app work
- promotion
- 2020/year-by-year expansion
- full matrix restart
- full seven-pair handshake

The next chat should review this v2.3 design as a fourth reviewer before any
implementation begins.

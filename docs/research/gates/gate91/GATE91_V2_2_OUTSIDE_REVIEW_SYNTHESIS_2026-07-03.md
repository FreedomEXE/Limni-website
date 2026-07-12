# Gate 91 v2.2 Outside Review Synthesis

Generated: 2026-07-03

## Verdict

`PASS_V2_2_REVIEW_SYNTHESIS__TERMINAL_HORIZON_TEST_DEFINED_NO_PROMOTION`

Outside reviews were compared after Gate 91 v2.1:

- Grok
- Gemini
- ChatGPT
- Codex outside review packet

The shared diagnosis is stable:

```text
V2.1 fixed part of the risk shape.
It did not create high-quality standalone grid geometry.
The next pure-geometry problem is unresolved adverse inventory near flatten.
```

## Current Evidence Base

Best current base row:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

Important 2026 comparison:

| Row | Account % | PF | Max DD % | Entries | Max open | Max depth |
|---|---:|---:|---:|---:|---:|---:|
| old v2 | `10.89` | `1.026` | `-39.82` | `64743` | `377` | `127` |
| v2.1 floor-pin | `10.76` | `1.070` | `-10.10` | `21065` | `187` | `83` |

Read:

```text
Floor-pin rejection passed.
Surplus quality was redundant in the bounded run.
The first convex add spacing was too blunt.
Standalone grid quality still fails.
```

## Review Consensus

### Grok

Recommended:

- time-to-flatten adverse-add gate
- MFE/reversion evidence since last fill
- milder conditional spacing
- premium versus ordinary geometry later

Useful read:

```text
Do not keep feeding adverse inventory late unless the path has shown evidence
that reversion is active.
```

### Gemini

Recommended:

- treat the leak as a flatten-tax problem
- consider time-decaying targets
- consider session velocity
- consider depth/log spacing

Useful read:

```text
Flatten is the main alpha erosion point.
```

Caution:

```text
Target decay can become disguised forced liquidation if tested before add-feed
causality is understood.
```

### ChatGPT / Codex Packet

Recommended:

```text
Gate 91 v2.2 =
v2.1 floor-pin base
+ target-before-flatten feasibility
+ basket green-close solvency
+ add-only-if-solvent rule
```

This is the cleanest next mathematical test because it directly asks:

```text
Can this basket still close green inside the center band before daily flatten?
```

## Accepted v2.2 Test Rows

Run four rows only:

1. Current base:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

2. Terminal-horizon add gate:

```text
triangle_formulaic_directionless_geometry_v2_floorpin_horizon
```

3. Basket solvency add gate:

```text
triangle_formulaic_directionless_geometry_v2_floorpin_solvency
```

4. Both:

```text
triangle_formulaic_directionless_geometry_v2_floorpin_horizon_solvency
```

## v2.2 Formulas

Keep v2.1 floor-pin eligibility:

```text
geometry_quality >= 1
and Q_bend / Q_floor >= 1.25
```

For each proposed adverse add, simulate the basket with the proposed add
included.

### Basket Solvency

For long baskets:

```text
basket_green_price = harmonic_average_entry + break_even_buffer
solvency_pass = basket_green_price <= target_high
```

For short baskets:

```text
basket_green_price = harmonic_average_entry - break_even_buffer
solvency_pass = basket_green_price >= target_low
```

### Required Reversion

Long:

```text
required_reversion_distance_adr =
  max(target_low, basket_green_price) - current_price
```

Short:

```text
required_reversion_distance_adr =
  current_price - min(target_high, basket_green_price)
```

Clamp at zero.

### Available Reversion Budget

```text
bend_speed_adr_per_min = B_cost / clean_session_minutes

available_reversion_budget_adr =
  bend_speed_adr_per_min
  * minutes_until_flatten
  * balance

available_reversion_budget_adr =
  max(available_reversion_budget_adr - Q_cost, 0)
```

### Terminal-Horizon Pass

```text
required_reversion_distance_adr <= available_reversion_budget_adr
```

### Reversion Feasibility Ratio

Receipt:

```text
RFR =
  required_reversion_distance_adr
  / max(available_reversion_budget_adr, epsilon)
```

If the idea is real, `RFR < 1` should separate better outcomes from `RFR > 1`.

## What Not To Do Yet

- Do not add Direction.
- Do not add Candidate B.
- Do not add David side bias.
- Do not add Katarakti.
- Do not use Gemini target decay as the first row.
- Do not promote.
- Do not start a broad matrix.

## Success Threshold For v2.2

Do not require final fund-manager targets yet. For this pure-geometry step,
use these bounded evidence goals:

```text
PF above 1.10 in both 2019 and 2026
MFE/MAE above 0.75, preferably near 1.0
max depth below 40, preferably below 30
max DD below 15% in both windows
flatten loss materially reduced
Return/DD above 1.25 in both windows
profitable weeks at or above v2.1
```

## Falsifier

If terminal-horizon feasibility does not separate good from bad inventory, then
directionless geometry may be near its standalone ceiling under daily flatten.
At that point, Direction and Katarakti can re-enter as separate evidence layers.

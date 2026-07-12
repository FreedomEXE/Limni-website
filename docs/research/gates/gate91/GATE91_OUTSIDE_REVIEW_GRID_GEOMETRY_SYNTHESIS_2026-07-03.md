# Gate 91 Outside Review Grid Geometry Synthesis

Generated: 2026-07-03

## Verdict

`PASS_OUTSIDE_REVIEW_SYNTHESIS__V2_GRID_GEOMETRY_DIRECTION_DEFINED_NO_REPLAY`

Four outside reviews were compared after the first Gate 91 directionless
diagnostic. The reviews were from ChatGPT, Grok, Gemini, and Claude.

The strongest shared read is:

```text
Gate 91 v1 measures movement shape.
Gate 91 v2 must measure cost-covering, center-returning, inventory-safe movement.
```

Do not solve the first v1 weakness by adding Direction or Katarakti back into
the first proof. The grid geometry layer must first improve its own economic
contract.

## Scope Boundary

This synthesis is grid-geometry research only.

Out of scope:

- Directional Algo: no Candidate B, no David side bias, no directional filter.
- Katarakti: no trigger/ignition rules, no sweep/rejection/displacement
  handshake as a required first-pass trigger.
- MT5/live/app work.
- Promotion.
- Red-news implementation.
- Year-by-year expansion or full matrix restart.

The three system layers remain:

| Layer | Role | Gate 91 v2 status |
|---|---|---|
| Directional Algo | chooses long, short, both, or no trade | intentionally excluded |
| Grid Geometry | spacing, target, add cadence, stop-feeding contract | active focus |
| Katarakti | ignition/trigger and premium confluence class | later layer |

## Current Evidence Anchor

The first Gate 91 scaffold used:

```text
Q = max(R / (2 + 2 * (1 - PE)), C)
C = 0.05 ADR
signal_event_brick = Q / 4
target = completed session midpoint
```

Bounded A/B evidence:

| Window | Protection | ADR units | Raw market % | Fixed-lot account % | PF | Max open | Max depth | Flatten net |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2019 all pairs open | baseline | `703.761268` | `496.537025` | `27.9885` | `1.107479` | `274` | `40` | `-19274.69` |
| 2019 all pairs open | pain stop-add | `313.917648` | `203.210786` | `6.9786` | `1.043660` | `114` | `24` | `-12697.75` |
| 2026 all pairs open | baseline | `117.366185` | `96.258846` | `-6.7906` | `0.961920` | `245` | `43` | `-13187.03` |
| 2026 all pairs open | pain stop-add | `65.055410` | `56.859643` | `-4.8150` | `0.953213` | `179` | `43` | `-8536.11` |

Read:

- The geometry harvested movement: ADR units were positive in 2019 and 2026.
- It did not convert movement into durable after-cost account return in 2026.
- Pain-first stop-add reduced churn and risk, but did not create the edge.
- The main failure is cost churn plus unresolved inventory into daily flatten.

## Four-Review Consensus

All four reviews converged on these points:

1. The current `Q` formula is too dependent on `R` and `PE` alone.
2. Low `PE` is not automatically good. It can be tradable reversion or dead
   broker-chop.
3. `0.05 ADR` is a placeholder cost floor, not an economic cost model.
4. The session midpoint is a fragile fair-value anchor.
5. Daily flatten must be priced into the geometry, because unresolved inventory
   is the dominant damage channel.
6. Stop-feeding must become inventory-aware rather than only a binary pain
   switch.
7. The next proof should diagnose geometry quality and flatten damage before
   adding Direction or Katarakti.

## Source-Specific Useful Ideas

### ChatGPT

Most useful contribution:

- Cost-adjusted bending path.
- Robust center instead of raw midpoint.
- Target band instead of exact center touch.
- Inventory-aware adverse spacing.

Strong candidate formula:

```text
P_cost = sum(max(abs(delta_price) / ADR - one_way_cost_ADR, 0))
D = abs(session_close - session_open) / ADR
B_cost = max(P_cost - D, 0)
```

Read: this is the cleanest v2 base because it asks whether there was real
two-way movement after cost.

### Grok

Most useful contribution:

- Central pivot comparator:

```text
pivot_center = (session_high + session_low + session_close) / 3
```

- Explicit warning that midpoint ignores settlement/close location.
- Useful inventory cap framing.

Caution:

Grok introduced many fixed constants. Those numbers should not become another
clamp ladder without structural proof.

### Gemini

Most useful contribution:

- Treat `PE` more as eligibility evidence than as the whole spacing engine.
- Prefer value-center anchors such as VWAP or anchored VWAP when reliable.
- Check distance-to-target against transaction costs before allowing a grid.

Caution:

Several Gemini suggestions are trigger-like, especially `price versus VWAP by
sigma` entry rules. Those belong closer to Katarakti/ignition than first-pass
grid geometry.

### Claude

Most useful contribution:

- Strong critique that `PE` is a path summary, not necessarily a spacing law.
- Strong critique that `PE > 0.35` is a hidden cliff.
- Emphasis on volatility-scaled spacing, structural cost floors, and continuous
  inventory control.
- Useful future diagnostics: variance ratio, Hurst, OU half-life, and
  volatility estimator comparisons.

Caution:

The full VR/Hurst/OU stack is too much for the immediate v2 pass. It should
remain a later statistical validation layer unless the simpler geometry cannot
separate good reversion from random chop.

## Accepted Design Direction

Gate 91 v2 should be compact:

```text
1. cost-adjusted bending path
2. robust reversion center
3. cost-aware Q and event brick
4. target band, not exact midpoint
5. geometry eligibility from balanced cost-adjusted movement
6. inventory-aware add spacing as a second-stage variant
```

The first v2 pass should avoid:

- PE-only spacing.
- Fixed David MA target.
- Candidate B direction dependency.
- Pure ATR spacing that ignores session structure.
- A long list of hard range/PE/depth thresholds.

## Recommended V2 Geometry Spec

### Inputs

Use only point-in-time data known before the grid decision.

```text
ADR
completed session high, low, open, close
completed session M1 close path
one_way_cost_ADR
round_trip_cost_ADR
current_volatility_ADR
```

If actual all-in execution cost is not yet available, the old `0.05 ADR` floor
may be retained only as a logged legacy fallback. It should not be treated as
the final cost law.

### Derived Movement

```text
R = (session_high - session_low) / ADR

P_raw = sum(abs(price_i - price_i_minus_1)) / ADR

D = abs(session_close - session_open) / ADR

PE = D / max(P_raw, epsilon)

P_cost =
  sum(max(abs(price_i - price_i_minus_1) / ADR - one_way_cost_ADR, 0))

B_cost = max(P_cost - D, 0)
```

Interpretation:

- `P_raw` is total path.
- `D` is net displacement.
- `P_cost` ignores movement too small to matter after cost.
- `B_cost` estimates cost-adjusted bending path, the actual raw material a
  directionless reversion grid needs.

### Cost Floor

```text
Q_cost = cost_multiple * round_trip_cost_ADR
```

The multiplier must be a structural gross-to-cost margin, not a weekly
optimization knob. The outside reviews clustered around `3x..5x`. If a numeric
first-pass value is required, use one predeclared value and receipt it rather
than sweeping a ladder.

### Robust Center Candidates

Primary first v2 center:

```text
median_center = median(M1 close prices inside completed session)
```

Comparison centers:

```text
midpoint_center = (session_high + session_low) / 2
pivot_center = (session_high + session_low + session_close) / 3
```

VWAP is a valid future comparator if reliable FX volume or a robust proxy is
available. Do not make VWAP a dependency until the data quality is proved.

### Grid Quantum

Recommended v2 base:

```text
N_effective = 1 + sqrt(B_cost / max(Q_cost, epsilon))

Q_bend = R / max(N_effective, epsilon)

Q = max(Q_cost, current_volatility_floor, Q_bend)
```

Where:

```text
current_volatility_floor = formulaic realized-volatility floor in ADR units
```

The exact volatility floor is an implementation detail for the next code pass,
but it should be derived from current or recently completed realized volatility,
not from a fixed MA period or a static ADR-event brick.

Why this is better than v1:

```text
v1 asks: was the path inefficient?
v2 asks: was there enough cost-adjusted two-way movement to justify a grid?
```

### Event Brick

```text
event_brick = max(Q / 4, Q_cost / 2)
```

This preserves the structural relationship between signal clock and grid
spacing while preventing event noise below the economic floor.

### Target Band

Do not require an exact center touch.

```text
target_band = max(Q / 4, Q_cost / 2)
```

Long cycle target:

```text
price >= center - target_band
and after_cost_basket_pnl > 0
```

Short cycle target:

```text
price <= center + target_band
and after_cost_basket_pnl > 0
```

This makes the target a profitable reversion zone, not a fragile single print.

### Geometry Eligibility

First-pass economic geometry score:

```text
time_above = fraction of completed-session closes above center
time_below = fraction of completed-session closes below center

balance = 1 - abs(time_above - time_below)

geometry_quality = (B_cost / max(Q, epsilon)) * balance
```

Interpretation:

```text
The session must contain balanced, cost-adjusted bending movement.
```

This is preferable to treating low `PE` as automatically harvestable.

### Entry Displacement

Still directionless:

```text
long start allowed when price <= center - Q
short start allowed when price >= center + Q
```

This is geometry, not directional prediction.

### Add Spacing

Stage 1 v2 should preserve the current risk baseline:

```text
daily flatten
pain_1q_stop_adds_before_profit_0_5q
```

This isolates whether the new geometry improves the structure before changing
the risk/add engine.

Stage 2 v2 should test one inventory-aware add variant:

```text
Q_next =
  Q
  * sqrt(1 + depth)
  * sqrt((MAE + Q_cost) / max(MFE + Q_cost, epsilon))
```

Interpretation:

- More depth widens spacing.
- Adverse movement without favorable proof widens spacing.
- Real favorable excursion keeps spacing closer to base.
- No Direction or Katarakti is introduced.

## Rejected Or Quarantined Ideas

Rejected for immediate v2:

- `Q = 0.5 * ATR(14)` as the whole geometry. It is too generic and discards the
  session-structure problem Gate 91 is trying to solve.
- Hard adoption of Grok's specific constants (`2.5`, `3.5`, `1.8`, `0.55`,
  `2.2`, `0.38`, `0.50`, `1.15`, `0.35`, max `4` adds) as final rules.
- `price is 2 sigma from VWAP` as a grid rule. That is a trigger/ignition
  concept and should be reserved for Katarakti.
- Full VR/Hurst/OU model stack in the first implementation pass.

Quarantine for later diagnostics:

- VWAP anchor if reliable volume/proxy data is available.
- Variance ratio / Hurst as statistical reversion-quality validation.
- OU half-life if target-before-flatten failure suggests session horizon
  mismatch.
- Hard max add count if dynamic add spacing fails to control inventory.

## Required Diagnostics Before Promotion Talk

The next evidence should not ask only whether account return improved. It
should ask whether the geometry failure mode changed.

Required diagnostics:

1. Cost ratio distribution:

```text
cost_ratio = round_trip_cost_ADR / Q
```

2. Geometry-quality deciles:

```text
geometry_quality
B_cost / Q
balance
PE
R
cost_ratio
```

3. Target-before-flatten survival:

```text
target_hit_before_flatten
time_to_target
time_to_flatten
```

4. Flatten-loss decomposition:

```text
target close profit
session-flatten loss
transaction-cost drag
open-inventory giveback
```

5. Anchor comparison:

```text
median center
midpoint center
pivot center
```

6. Inventory-control audit:

```text
depth
MAE
MFE
Q_next if dynamic spacing were active
would_dynamic_spacing_have_blocked_last_add
```

7. Cost stress:

```text
base cost
1.5x cost
2.0x cost
```

8. Entry perturbation:

```text
one event late
one M1 late
plus/minus one event brick
```

A real geometry edge should degrade gracefully. It should not depend on one
exact center print or one exact trigger timestamp.

## Falsification Standard

The v2 geometry direction is falsified if:

1. Higher `geometry_quality` does not produce better after-cost outcomes.
2. `B_cost` does not predict target-before-flatten survival.
3. Cost stress destroys the edge immediately.
4. Median/pivot centers do not outperform midpoint or random center in any
   useful way.
5. Dynamic spacing reduces entries but does not reduce flatten damage.
6. Positive ADR movement remains paired with negative fixed-lot account return
   because flatten losses still dominate.
7. The only profitable cells require a narrow constant combination with no
   structural explanation.

Most important falsifier:

```text
If geometry quality does not predict lower flatten damage, then the geometry is not real.
```

## Next Gate 91 Action

The next code/replay pass should implement a new activation id rather than
mutating the first scaffold:

```text
triangle_formulaic_directionless_geometry_v2
```

First implementation should include:

- cost-adjusted path receipts: `P_raw`, `P_cost`, `D`, `B_cost`
- cost floor receipt: `Q_cost`
- center receipt: median, plus midpoint/pivot comparators
- v2 `Q`
- cost-aware event brick
- target band
- geometry-quality receipt
- same daily flatten and pain-first stop-add baseline

Run sequence remains bounded:

1. one-pair smoke
2. 2019 A/B
3. 2026 A/B

No Direction, no Katarakti, no full matrix, no MT5/live/app work.

## Fund-Manager Read

Grid Geometry is the engine block. It should not know which way the fund wants
to lean, and it should not own the ignition trigger.

Its job is to answer:

```text
Where is fair value?
How far is price displaced?
How wide should spacing be after costs?
Where is reversion paid?
When is the basket no longer worth feeding?
```

Gate 91 v1 showed that the engine can find movement. Gate 91 v2 must prove that
the movement is economically tradable after cost, inventory, and flatten.

# Gate 91 Formulaic V2.1 Floor-Pin / Surplus / Convex Diagnostic

Generated: 2026-07-03

## Verdict

`PASS_V2_1_SELECTIVITY_EVIDENCE__FAIL_STANDALONE_TARGET_METRICS_NO_PROMOTION`

Gate 91 v2.1 confirms the outside-review direction was useful:

```text
Rejecting cost-floor-pinned geometry improves the live-shaped risk surface.
```

But v2.1 is not a finished standalone grid-geometry algorithm. It improves
selectivity and 2026 drawdown shape, but still fails the main institutional
quality targets: profit factor, Sharpe, Sortino, MFE/MAE, and expectancy.

The best current row is the v2.1 floor-pin / surplus family. The convex add
spacing row is too blunt in this first form.

## What Changed From V2

Old v2 traded whenever:

```text
geometry_quality >= 1
```

That allowed too many sessions where:

```text
Q = Q_floor
```

meaning the grid was mostly trading at the cost / volatility floor instead of
using a real market-structure quantum.

V2.1 adds three bounded rows:

### 1. Floor-Pin Rejection

Activation:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

Eligibility:

```text
geometry_quality >= 1
and Q_bend / Q_floor >= 1.25
```

Meaning:

```text
Do not trade a session unless the bend-derived quantum is meaningfully above
the minimum tradable floor.
```

### 2. Surplus Geometry Quality

Activation:

```text
triangle_formulaic_directionless_geometry_v2_surplus
```

Formula:

```text
surplus_bend = max(0, B_cost - 2 * Q_cost)
surplus_geometry_quality =
  (surplus_bend / Q)
  * balance
  * min(1, Q_bend / Q_floor)
```

Eligibility:

```text
surplus_geometry_quality >= 1
and Q_bend / Q_floor >= 1.25
```

In this bounded test, surplus is almost identical to floor-pin. That means the
floor-pin gate is doing nearly all of the first useful selectivity work.

### 3. Convex Adverse Add Spacing

Activation:

```text
triangle_formulaic_directionless_geometry_v2_surplus_convex
```

Next adverse add distance:

```text
Q_next =
  Q
  * sqrt(1 + depth)
  * sqrt((MAE + Q_cost) / max(MFE + Q_cost, epsilon))
```

The idea is right: stop adding every fixed `Q` when the basket is already
painful and not proving MFE. The first implementation is too defensive and
cuts too much harvest.

## Direction / Trigger Status

Still intentionally absent:

- No Candidate B.
- No David direction.
- No fixed MA bias.
- No Katarakti trigger.
- No red-news logic.
- No MT5/live/app work.

This was a pure Grid Geometry diagnostic.

## Smoke Result

Command surface:

- Pair: `AUDCHF`
- Window: `2019-04-14`, one week
- Bar path: `open`
- Target: `session_center_band_reversion`
- Protection: `baseline`

| Row | ADR units | Account % | PF | Entries | Max open | Max depth | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| old v2 | `6.443656` | `0.2822` | `3.468662` | `73` | `14` | `10` | `38.60` | `-10.38` |
| v2.1 floor-pin | `1.836110` | `0.0774` | `2.271787` | `28` | `5` | `4` | `13.73` | `-5.99` |
| v2.1 surplus | `1.836110` | `0.0774` | `2.271787` | `28` | `5` | `4` | `13.73` | `-5.99` |
| v2.1 surplus convex | `1.541461` | `0.0647` | `2.331252` | `24` | `3` | `2` | `11.24` | `-4.77` |

Validation: `54` rows, `0` failed.

## Old V2 vs New V2.1

### 2019 All Pairs, Open Path, Baseline Only

| Row | ADR units | Raw market % | Account % | PF | Weekly PF | Entries | Max open | Max depth | Max DD % | Return/DD | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| old v2 | `1934.799847` | `1262.318526` | `60.3858` | `1.096497` | `1.414973` | `95294` | `392` | `71` | `-45.8216` | `1.317846` | `54331.73` | `-48293.14` |
| v2.1 floor-pin | `728.107258` | `459.119667` | `23.5524` | `1.097770` | `1.393284` | `32772` | `277` | `46` | `-24.7650` | `0.951036` | `19306.69` | `-16951.45` |
| v2.1 surplus | `728.107258` | `459.119667` | `23.5524` | `1.097770` | `1.393284` | `32772` | `277` | `46` | `-24.7650` | `0.951036` | `19306.69` | `-16951.45` |
| v2.1 surplus convex | `315.053819` | `183.965385` | `5.8594` | `1.042522` | `1.210669` | `20371` | `109` | `7` | `-12.7944` | `0.457966` | `11682.48` | `-11096.53` |

### 2026 All Pairs, Open Path, Baseline Only

| Row | ADR units | Raw market % | Account % | PF | Weekly PF | Entries | Max open | Max depth | Max DD % | Return/DD | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| old v2 | `900.585056` | `624.802386` | `10.8944` | `1.026063` | `1.124442` | `64743` | `377` | `127` | `-39.8192` | `0.273597` | `32675.24` | `-31585.80` |
| v2.1 floor-pin | `496.655106` | `332.547785` | `10.7569` | `1.069909` | `1.335111` | `21065` | `187` | `83` | `-10.1006` | `1.064976` | `12388.39` | `-11312.70` |
| v2.1 surplus | `497.261796` | `332.803159` | `10.7747` | `1.070024` | `1.335663` | `21066` | `187` | `83` | `-10.0829` | `1.068611` | `12390.17` | `-11312.70` |
| v2.1 surplus convex | `230.202518` | `142.401480` | `2.6398` | `1.029770` | `1.166171` | `13267` | `75` | `9` | `-5.0729` | `0.520373` | `7610.78` | `-7346.79` |

## Fund-Manager Metric Targets

Metric notes:

- Sharpe, Sortino, and Calmar below are derived from weekly
  `equity_delta_usd` rows. They are diagnostic weekly-account ratios, not final
  broker/live portfolio ratios.
- `MFE/MAE` uses close-cycle/grid basket MFE and MAE, not individual fill-level
  trades.
- `Expectancy` uses average realized ADR per close-cycle/grid basket.
- Losing days are not present in these artifacts. Losing weeks are present and
  reported.

Target scale:

| Metric | Goal |
|---|---:|
| Profit factor | `1.5+` |
| Sharpe | `1.5+` |
| Sortino | `2.0+` |
| Calmar | `2.0+` |
| MFE/MAE | `2.0+` |
| Expectancy ADR / grid cycle | `1.0+` |
| Return/DD | `2.0+` |
| Profitable weeks | `65%+` |
| Max losing weeks in row | `<= 3` |

### 2019 Target Scorecard

| Row | PF | Sharpe | Sortino | Calmar | MFE/MAE | Expectancy | DD duration | Return/DD | Profitable weeks | Max losing weeks |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| old v2 | `1.096497` | `0.884684` | `0.745749` | `1.983276` | `0.616315` | `0.063023` | `15` | `1.317846` | `23/38` | `3` |
| v2.1 floor-pin | `1.097770` | `0.778916` | `0.704984` | `1.355321` | `0.641967` | `0.068787` | `21` | `0.951036` | `21/38` | `4` |
| v2.1 surplus | `1.097770` | `0.778916` | `0.704984` | `1.355321` | `0.641967` | `0.068787` | `21` | `0.951036` | `21/38` | `4` |
| v2.1 surplus convex | `1.042522` | `0.484069` | `0.457706` | `0.633373` | `0.596910` | `0.029764` | `26` | `0.457966` | `19/38` | `4` |

### 2026 Target Scorecard

| Row | PF | Sharpe | Sortino | Calmar | MFE/MAE | Expectancy | DD duration | Return/DD | Profitable weeks | Max losing weeks |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| old v2 | `1.026063` | `0.308931` | `0.276634` | `0.577000` | `0.550390` | `0.041502` | `13` | `0.273597` | `15/26` | `4` |
| v2.1 floor-pin | `1.069909` | `0.780145` | `0.879052` | `2.244511` | `0.591998` | `0.070218` | `13` | `1.064976` | `14/26` | `3` |
| v2.1 surplus | `1.070024` | `0.781383` | `0.880502` | `2.252362` | `0.592089` | `0.070304` | `13` | `1.068611` | `14/26` | `3` |
| v2.1 surplus convex | `1.029770` | `0.462268` | `0.483138` | `1.054483` | `0.589856` | `0.032547` | `13` | `0.520373` | `13/26` | `3` |

## Researcher Opinion

V2.1 is a real improvement, but not for the reason a surface optimizer would
usually chase. It did not create a high-PF grid. It proved that cost-floor
rejection is the correct next mathematical idea.

Best read:

```text
Keep floor-pin / surplus as the current geometry filter.
Do not keep convex adverse spacing in this first form.
```

Why:

- In 2026, floor-pin/surplus preserved almost all account return from old v2
  while cutting entries by about `67%`, max open by about `50%`, max drawdown
  by about `75%`, and commission by about `67%`.
- 2026 Calmar rose above the `2.0` goal for floor-pin/surplus.
- The same row still fails PF, Sharpe, Sortino, MFE/MAE, and expectancy.
- In 2019, floor-pin/surplus improved exposure but gave up too much of the old
  v2 return/DD shape.
- Convex spacing worked mechanically, but it over-protected. It cut 2026 max
  depth from `83` to `9`, but account return fell from about `10.77%` to
  `2.64%` and PF fell back near `1.03`.
- Surplus quality did not add meaningful selectivity beyond floor-pin in this
  bounded pass. It should stay as a receipt and later quality lever, not be
  mistaken for a proven second filter.

The primary remaining failure is still the same:

```text
Target closes are large, but flatten losses almost cancel them.
```

V2.1 reduced the size of that problem but did not solve it.

## Decision

Do not promote.

Do not add Direction or Katarakti yet.

Do not start a broad matrix.

The next bounded Gate 91 test should focus on session lifecycle / add timing:

1. Keep v2.1 floor-pin/surplus as the base geometry.
2. Test a formulaic no-new-adverse-add window near session end.
3. Test a formulaic minimum target/flatten edge condition.
4. Keep Candidate B, David, and Katarakti out until geometry can beat the
   current target metrics more cleanly.

## Artifacts

- v2.1 smoke:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v21-smoke-audchf-2019-1w/GATE91_FORMULAIC_V21_SMOKE_AUDCHF_2019_1W.md`
- v2.1 2019 bounded run:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v21-ab-2019-open/GATE91_FORMULAIC_V21_AB_2019_OPEN.md`
- v2.1 2026 bounded run:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v21-ab-2026-open/GATE91_FORMULAIC_V21_AB_2026_OPEN.md`
- Validation:
  - smoke: `54` rows, `0` failed
  - 2019: `54` rows, `0` failed
  - 2026: `54` rows, `0` failed

## Stop Line

Gate 91 remains formulaic grid-geometry research only. No MT5/live/app work,
no promotion, no red-news implementation, no 2020/year-by-year expansion, no
full matrix restart, no full seven-pair handshake gate, and no Candidate B
direction dependency.

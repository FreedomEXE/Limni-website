# Gate 91 v2.1 Outside Review Synthesis

Generated: 2026-07-03

## Verdict

`PASS_V2_1_REVIEW_SYNTHESIS__NEXT_TEST_ROWS_DEFINED_NO_REPLAY`

Three outside reviews were compared after the Gate 91 v2 diagnostic:

- Gemini
- Grok
- ChatGPT

The reviews converged on the same read:

```text
V2 proved movement exists.
V2 did not prove tradable standalone geometry.
V2.1 must prove selectivity.
```

## What V2 Proved

Useful:

- Cost-adjusted bending path is a better movement detector than PE/range alone.
- Median session center and target band find more reversion movement than exact
  midpoint targeting.
- 2026 baseline turned from red to green.

Not useful enough:

- Profit factor stayed near `1`.
- MFE/MAE stayed near `0.5..0.65`, far below the target.
- Entries and inventory depth exploded.
- Flatten damage still nearly offset target-close harvest.
- Pain-stop reduced exposure but did not preserve enough harvest.

## Consensus Failure Mode

All three reviews identified the same primary failure:

```text
Q is too often pinned near the economic floor.
```

When `Q` is pinned to the cost/volatility floor, the geometry can still pass
`geometry_quality >= 1`, but the trade may be only micro-reversion and churn.

The current v2 formula:

```text
N_effective = 1 + sqrt(B_cost / Q_cost)
Q_bend = R / N_effective
Q_floor = max(Q_cost, current_volatility_floor)
Q = max(Q_floor, Q_bend)
```

V2 did not separately require:

```text
Q_bend meaningfully above Q_floor
```

That is the next test.

## Rejected For Immediate v2.1

Do not start with:

- Directional Algo.
- Candidate B.
- David side bias.
- Katarakti trigger.
- Red news.
- Broad matrix.
- Gemini's generic `ADR_current / ADR_sma20 > 1.0` gate.
- Hard abort at `2.5Q`.
- Fixed log add ladder as the primary rule.
- Full Grok multi-filter stack all at once.

Those may become later diagnostics, but they are not the cleanest first answer.

## Accepted v2.1 Test Rows

Run four rows only:

1. Current v2 baseline reference:

```text
triangle_formulaic_directionless_geometry_v2
```

2. V2 plus floor-pin rejection:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
eligible = geometry_quality >= 1
and Q_bend >= 1.25 * Q_floor
```

3. V2 plus surplus geometry quality:

```text
triangle_formulaic_directionless_geometry_v2_surplus
surplus_bend = max(0, B_cost - 2 * Q_cost)
surplus_geometry_quality =
  (surplus_bend / Q)
  * balance
  * min(1, Q_bend / Q_floor)

eligible =
  surplus_geometry_quality >= 1
  and Q_bend >= 1.25 * Q_floor
```

4. V2 plus surplus geometry quality plus convex adverse add spacing:

```text
triangle_formulaic_directionless_geometry_v2_surplus_convex

Q_next =
  Q
  * sqrt(1 + depth)
  * sqrt((MAE + Q_cost) / max(MFE + Q_cost, epsilon))
```

Optional later row only if flatten damage remains:

```text
no adverse adds in final 25% of session lifecycle
```

## Target Improvement

The next test does not need to maximize return. It needs to improve shape:

```text
entries down 40..70%
max depth cut by at least 50%
flatten loss materially reduced
PF above 1.15 before Direction/Katarakti
MFE/MAE above 1.0 first, then later toward 2.0
return/DD improves
2026 stays green or near-flat with much lower risk
```

## Stop Line

Gate 91 v2.1 remains directionless grid-geometry research only. Do not open
Direction, Candidate B, David bias, Katarakti, MT5/live/app work, promotion,
red-news implementation, broad matrices, or year-by-year expansion.

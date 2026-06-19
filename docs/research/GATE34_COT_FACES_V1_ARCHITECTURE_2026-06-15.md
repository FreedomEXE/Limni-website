# Gate 34 COT Faces v1 Architecture

Generated: 2026-06-15

## Purpose

This is the backbone spec for the first full COT composite source model.

The premise changed: Dealer and Commercial should not be treated only as
separate standalone systems. COT should be modeled as a single source family
with multiple participant faces, quality context, and regime context.

This document is intentionally research-only. It does not promote a live source,
change ADR Grid, change Pair Fill Cap, modify release canon, or change runtime
strategy behavior.

## Source Boundary

Name for first composite rule:

`cot_faces_v1_forced`

The rule must:

- emit a direction for every selected FX pair row;
- emit source tier and reason for every row;
- support a fast-pass basket before full 28-pair qualification;
- preserve the later requirement that final qualification must cover all 28 FX
  pairs;
- keep source logic separate from exit logic.

## Fast-Pass Basket

Use this 10-pair basket before full 28-pair sweeps:

```txt
EURUSD
GBPUSD
USDJPY
USDCHF
AUDUSD
USDCAD
AUDCAD
EURJPY
GBPCHF
NZDJPY
```

Why this basket:

- it covers the major FX currencies;
- it includes the USD spine without being only USD;
- it includes crosses, so the model must compare non-USD COT structure;
- it is much faster than full 28-pair path sweeps.

The fast-pass basket is a screening tool, not final qualification.

## Validation Order

Use outside-in year validation:

1. Clean 2019 and current 2026.
2. Clean 2020 and clean 2025.
3. Clean 2021 and clean 2024.
4. Clean 2022 and clean 2023.

Do not change weights after the first pair of years unless the result exposes a
clear design flaw. The point is to test the premise before curve-fitting.

## COT Faces

Each participant face can provide position level and current weekly change:

| Face | Position Level | Weekly Change |
|---|---|---|
| Dealer | `dealer_net / open_interest` | `dealer_delta_net / open_interest` |
| Commercial | `commercial_net / open_interest` | `commercial_delta_net / open_interest` |
| Non-commercial | `noncomm_net / open_interest` | `noncomm_delta_net / open_interest` |
| Non-reportable | `nonrept_net / open_interest` | `nonrept_delta_net / open_interest` |
| Asset manager | `asset_mgr_net / open_interest` | `asset_mgr_delta_net / open_interest` |
| Leveraged money | `lev_money_net / open_interest` | `lev_money_delta_net / open_interest` |

For the first pass, use current weekly deltas only. Do not add 4-week or 8-week
persistence yet.

## Role Separation

Do not treat every COT field as an equal directional vote.

### Directional Evidence

These can vote direction:

- participant `net / open_interest`;
- participant `delta_net / open_interest`;
- base currency score versus quote currency score.

### Quality Evidence

These should qualify confidence, not vote direction by themselves:

- Dealer spread cleanliness;
- non-commercial spread cleanliness;
- trader-count imbalance;
- concentration fields.

### Regime Evidence

These explain when a signal might be safer or weaker:

- `oi_delta / open_interest`;
- open interest expanding with the signal;
- open interest contracting against the signal;
- concentration extremes;
- broad alignment or conflict across participant faces.

## First-Pass Weights

Start with deliberately simple weights.

Position level:

```txt
dealer_net_oi       1.50
commercial_net_oi   1.00
noncomm_net_oi      0.75
nonrept_net_oi      0.50
asset_mgr_net_oi    0.50
lev_money_net_oi    0.50
```

Current weekly change:

```txt
dealer_delta_oi       1.00
commercial_delta_oi   0.75
noncomm_delta_oi      0.50
nonrept_delta_oi      0.25
asset_mgr_delta_oi    0.35
lev_money_delta_oi    0.35
```

Quality multipliers:

```txt
dealer spread clean        +0.15 confidence
dealer spread dirty        -0.15 confidence
noncomm spread clean       +0.10 confidence
noncomm spread dirty       -0.10 confidence
OI expands with direction  +0.10 confidence
OI contracts against       -0.10 confidence
high concentration         -0.05 confidence
```

The first implementation may store this as reason-tier metadata rather than
position sizing. The output direction remains forced long/short for each tested
pair.

## Pair Decision

For each currency:

```txt
currency_score = weighted_directional_face_score * confidence_multiplier
```

For each pair:

```txt
pair_score = base_currency_score - quote_currency_score
pair_score > 0 => LONG
pair_score < 0 => SHORT
```

Exact ties must be forced by an explicit deterministic tiebreaker and recorded
in the row reason.

## Reason Tiers

The first rule should emit tiers like:

- `cot_faces_broad_alignment`
- `cot_faces_dealer_commercial_confirmed`
- `cot_faces_dealer_noncomm_commercial_conflict`
- `cot_faces_dealer_noncomm_confirmed`
- `cot_faces_dealer_leads_commercial_conflicts`
- `cot_faces_speculative_crowding_warning`
- `cot_faces_oi_confirmed`
- `cot_faces_low_confidence_forced`
- `cot_faces_tie_forced`

`cot_faces_dealer_noncomm_commercial_conflict` is a metadata-only distinction:
Dealer and Non-commercial agree with the final pair direction, while Commercial
opposes it. Direction scoring is unchanged, but later analysis must not read
that tier as broad COT agreement.

Later analysis should compare tier contribution. A COT model is not mature until
we know which tiers carry edge and which tiers drag.

## First Fast Test

Use:

- fast-pass 10-pair basket;
- clean 2019 and current 2026;
- week-close;
- market-week `TP 1.0x / SL 2.0x`;
- current source exclusions where applicable.

Pass criteria:

- improves return/DD versus current/recent source baselines;
- weekly profit factor above `1.0`;
- does not rely on one pair or one week;
- high-confidence tiers perform better than low-confidence forced tiers;
- keeps every tested pair row explainable with source reasons;
- survives both 2019 and 2026 before expanding to 2020/2025.

## Important Constraint

The fast basket is only a speed screen. The source model must still be designed
so full qualification can emit all 28 FX pair rows every selected week.

# Gate 107 - Revma State-Signal Harvest Harness Architecture

Date: 2026-07-09

Status: OPEN as architecture/research contract. No EA implementation has been
started in this document.

## Purpose

Build a clean Revma research harness where:

- Revma remains mean-reversion.
- Revma validity comes from the Revma state signal, not q-anchor location.
- q-anchor bucket is metadata only.
- q stochastic is birth/add/close metadata only.
- both adverse and favorable adds are traded and tagged.
- individual grid TP can harvest winners independently.
- account TP/HWM remains a separate portfolio cleanup layer.
- birth metadata persists by `grid_key` for restart safety.
- receipts are enough for offline attribution.
- tester speed must not degrade.

## Architecture Decision

Revma remains mean-reversion only, but mean-reversion is now defined by the
Revma state signal. The q line / q anchor is no longer the determining factor
for whether a state signal is valid. q-anchor location and q stochastic are
research metadata used later to determine which birth/add/close buckets had
edge.

The research harness should not decide early that only adverse adds, only
buy-below-q, or only sell-above-q cases are valid. It should trade the state
signal and preserve enough metadata for later attribution.

## Harvest Model

Individual grid TP is the harvest layer.

Account TP / HWM is the portfolio cleanup layer.

Example:

```text
grid TP = 0.01%
account TP/HWM target = 1.00%
50 independent grids harvest about 0.50%
losing grids remain open
winning symbols can rearm and harvest again
account-level cleanup closes all remaining inventory only when its target or
cleanup condition is reached
```

This avoids forcing profitable grids to stay open until unrelated losers
resolve.

## Add Model

Both add types are active in the research harness:

- adverse add
- favorable add

For long grids:

- adverse add: price moves below prior grid low by spacing.
- favorable add: price moves above prior grid high by spacing.

For short grids:

- adverse add: price moves above prior grid high by spacing.
- favorable add: price moves below prior grid low by spacing.

No configurable add-policy modes are opened in Gate 107. Do not add
`RecoveryOnly`, `HybridQuarantine`, `NoAdds`, or `FavorableOnly` inputs.

## Birth Metadata Contract

Minimum required birth metadata:

```text
run_id
grid_key
symbol
direction
lane_id
variant_id
grid_family
system_id
formula_id
formula_hash
source_m1_time
birth_time
birth_q
birth_q_pips
birth_q_profile
birth_q_profile_id
birth_anchor
birth_price
birth_anchor_distance_q
birth_anchor_bucket
birth_q_stochastic_raw
birth_q_stochastic_bucket
```

Birth anchor buckets:

```text
LONG_ABOVE_Q_ANCHOR
LONG_BELOW_Q_ANCHOR
SHORT_ABOVE_Q_ANCHOR
SHORT_BELOW_Q_ANCHOR
UNKNOWN_Q_ANCHOR_LOCATION
```

## Q Stochastic Metadata

Use the existing Revma/q stochastic only. Do not invent a new stochastic
formula and do not turn stochastic into a live filter in Gate 107.

Suggested buckets:

```text
STOCH_0
STOCH_0_5
STOCH_5_10
STOCH_10_20
STOCH_20_40
STOCH_40_60
STOCH_60_80
STOCH_80_90
STOCH_90_95
STOCH_95_100
STOCH_100
STOCH_UNKNOWN
```

Exact `0` and exact `100` should be preserved if the raw value allows it.

Optional only if already available cheaply:

```text
birth_q_stochastic_d
birth_extreme_state
birth_extreme_age_events
birth_trend_state
birth_raw_score
birth_trend_score
birth_exhaustion_score
birth_confidence
```

## Add Metadata Contract

Add receipts/state should include:

```text
add_type
add_sequence
adverse_add_count
favorable_add_count
add_price
add_q
add_q_stochastic_raw
add_q_stochastic_bucket
current_anchor_bucket
basket_age_minutes
position_count_before
lots_before
avg_entry_before
min_entry_before
max_entry_before
grid_floating_pnl_before
net_open_money_after_fees_before
```

## Grid Close / TP Metadata

Close receipts/state should include:

```text
close_reason
grid_tp_q
grid_tp_money
grid_tp_price
estimated_close_fee
net_open_money_after_fees
final_or_preclose_grid_pnl
position_count
lots
birth_time
time_to_close_minutes
birth_anchor_bucket
birth_q_stochastic_bucket
close_q_stochastic_raw
close_q_stochastic_bucket
```

`grid_tp_price` and close stochastic fields are required only when available
cheaply and safely.

## Persistence Requirement

Birth metadata must be persisted by `grid_key` and reloaded on EA init.

Magic/grid key can rebuild identity, but it cannot rebuild birth q,
stochastic, or anchor context. Without persistence, restart tests are not
trustworthy.

Persist only on lifecycle events:

- birth
- add
- TP sync
- grid close
- restart state load
- stale state cleanup

No per-tick persistence and no online helped/hurt attribution.

## Speed Contract

Gate 107 must not materially degrade tester speed.

Allowed:

- lifecycle-event receipts.
- cached grid state in memory by `grid_key`.
- bounded loops over open positions/open grids.
- current-chart mode remains one-symbol only.
- FX28 work is bounded to active symbols/open grids.

Forbidden:

- per-tick metadata writes.
- repeated spacing-not-reached receipts.
- repeated all-history M1 scans.
- screenshots by default.
- heavy chart objects.
- expensive offline attribution inside the EA.

## Stop Line

No optimization, no promotion, no stochastic filter, no q-anchor filter, no
quarantine, no recovery-only mode, no Candidate B/HWM work.

Implementation requires a separate Gate 107 code pass after this architecture
contract is accepted.

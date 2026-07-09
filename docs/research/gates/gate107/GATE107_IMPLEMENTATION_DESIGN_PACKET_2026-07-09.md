# Gate 107 - Revma State-Signal Harvest Harness Implementation Design Packet

Date: 2026-07-09

Status: DESIGN ONLY. No EA source code was changed for this packet.

Branch inspected: `codex/gate88-mt5-lifecycle-protection-controls`

HEAD inspected: `8885f4661c8235730902c7fa206b765124e9300f`

## Objective

Gate 107 should build a Revma research harness where the Revma state signal is
the trade-validity source, q-anchor location and q stochastic are metadata, both
adverse and favorable adds are observed/traded, individual grid TP can harvest
winners independently, and birth context survives EA restart.

This packet is a cautious implementation map. It does not promote Revma, change
Revma formula behavior yet, optimize parameters, run MT5 tests, or reopen
Candidate B/HWM research.

## Current Code Truth

### Signal validity still depends on q-anchor location

`automation/mt5/Experts/Include/Signals/RevmaSignalState.mqh` builds
`LP_RevmaSignal` from the pair-direction state, then calls
`LP_RevmaClassifySleeve(...)`. If classification fails, the signal is invalid
with `mean_reversion_setup_required`.

Relevant surfaces:

- `RevmaSignalState.mqh:267` `BuildSignalFromResult(...)`
- `RevmaSignalState.mqh:310` call to `LP_RevmaClassifySleeve(...)`
- `RevmaSignalState.mqh:320` invalidates otherwise-valid state direction as
  `mean_reversion_setup_required`
- `RevmaTypes.mqh:284` `LP_RevmaClassifySleeve(...)`
- `RevmaTypes.mqh:307` current mean-reversion check is long-below-anchor or
  short-above-anchor only

Gate 107 must change this boundary if accepted: q-anchor relation becomes a
bucket, not a validity filter.

### q stochastic already exists cheaply

The q stochastic is already computed in the Revma signal path:

- `RevmaSignalState.mqh:242` `BoundedStoch(...)`
- `RevmaSignalState.mqh:392` assigns `point.stoch`
- `RevmaSignalState.mqh:290` assigns `signal.stoch = direction.stoch`

The grid sleeve already emits raw stochastic in lifecycle metadata:

- `RevmaGridSleeve.mqh:170` stores birth `stoch` in memory
- `RevmaGridSleeve.mqh:214` emits `birth_stoch`
- `RevmaGridSleeve.mqh:253` emits `entry_stoch`
- `RevmaGridSleeve.mqh:279` emits `current_stoch`

Missing: explicit `birth_q_stochastic_raw`, bucket labels, add/close bucket
labels, and persisted restart-safe birth metadata.

### Birth metadata is memory-only

`LP_RevmaGridSleeve` already has `LP_RevmaGridBirthSnapshot`, but it is only
held in `m_births[]`:

- `RevmaGridSleeve.mqh:14` birth snapshot struct
- `RevmaGridSleeve.mqh:84` in-memory `m_births[]`
- `RevmaGridSleeve.mqh:138` `RememberBirth(...)`
- `RevmaGridSleeve.mqh:186` `FindBirth(...)`

After EA restart, open positions can be reconstructed from magic numbers, but
birth q, q stochastic, anchor bucket, source M1 time, and locked add metadata
cannot be reconstructed reliably.

This is not theoretical: individual grid TP and broker TP sync both require
birth q:

- `RevmaGridSleeve.mqh:789` grid exit path looks up birth snapshot
- `RevmaGridSleeve.mqh:1035` broker TP sync path looks up birth snapshot
- if `FindBirth(...)` fails, those paths skip the grid rather than harvest it

Gate 107 must persist birth state by `grid_key` before restart tests are
trustworthy.

### Magic/grid key restores identity only

`MagicCodec.mqh` encodes symbol, lane, variant, direction, and grid family.
That is enough to rebuild grid identity and close scope, but not birth context.

This matches the architecture concern from outside review: magic can rebuild
identity; it cannot rebuild birth q/stochastic/anchor context.

### Existing grid lookup is too coarse for the new harness question

`GridBook.mqh` exposes `FindSymbolLaneGrid(symbol_id, lane_id, row)`, which
returns the first open Revma grid for that symbol/lane:

- `GridBook.mqh:264` `FindSymbolLaneGrid(...)`
- `RevmaGridSleeve.mqh:1100` uses it before add/birth decisions
- `Engine.mqh:337` uses it for lifecycle reentry gate state

This is acceptable for the current one-active-grid-per-symbol/lane behavior.
It is not enough if Gate 107 wants simultaneous long and short grids, multiple
active grid families per symbol/lane, or immediate rearm while an opposite-side
loser remains open.

Decision required before code: Gate 107 should choose one of these:

1. Keep one active Revma grid per symbol/lane for the first harness pass.
2. Allow one active grid per symbol/lane/direction.
3. Allow multiple active grid families per symbol/lane/direction.

Option 1 is the smallest safe implementation. Options 2 or 3 require a wider
grid selection and lifecycle-gate redesign.

### Existing add model is adverse-only

`FrozenAddHit(...)` only supports the birth-frozen policy:

- long reversion grids add lower from `min_entry_price`
- short reversion grids add higher from `max_entry_price`

Relevant surface:

- `RevmaGridSleeve.mqh:456` `FrozenAddHit(...)`

Gate 107's required harness needs adverse and favorable adds. That requires a
new add decision layer that checks both sides and tags the selected add as
`adverse` or `favorable`, instead of treating add policy as a single frozen
direction.

### Independent grid TP exists conceptually, but has two blockers

Current grid-level close and broker TP sync are exact-grid scoped:

- `TradeRouter.mqh:394` TP sync filters positions by exact plan magic
- `TradeRouter.mqh:555` grid close filters positions by exact plan magic
- `RiskArbiter.mqh:170` rebuilds plan magic from intent identity/grid family

That supports independent grid harvesting in principle.

Blockers:

1. Grid exits and broker TP sync skip when birth snapshot is missing.
2. Engine currently skips Revma grid exits and TP sync while portfolio
   stop/take-profit guard is blocking new entries:
   - `Engine.mqh:646` grid exits only run when `!stop_take_profit_block_new_entries`
   - `Engine.mqh:661` broker TP sync only runs when
     `!stop_take_profit_block_new_entries && revma_grid_exit_intents <= 0`

For Gate 107, account cleanup/HWM block-new-risk should not suppress individual
winner harvesting. The harvest layer must remain able to close profitable grids
unless an explicit close-execution safety rule says otherwise.

### Grid tickets are not populated in inventory summaries

`LP_GridInventoryRow` has a `tickets` field and receipts print it, but
`GridBook.mqh` does not append ticket IDs during accumulation:

- `GridBook.mqh:30` `tickets` field
- `GridBook.mqh:60` reset to empty
- `GridBook.mqh:94` selected ticket is passed to `AccumulateSelectedPosition`
- `GridBook.mqh:220` summaries print `tickets`

This is a metadata defect, not necessarily a close-safety defect, because close
execution filters by magic and symbol. But for Gate 107 research receipts, empty
ticket lists reduce auditability and should be fixed with the metadata pass.

## Proposed Implementation Sequence

### Step 1 - Metadata helpers only

Add small helper functions for:

- anchor bucket:
  - `LONG_ABOVE_Q_ANCHOR`
  - `LONG_BELOW_Q_ANCHOR`
  - `SHORT_ABOVE_Q_ANCHOR`
  - `SHORT_BELOW_Q_ANCHOR`
  - `UNKNOWN_Q_ANCHOR_LOCATION`
- q stochastic bucket:
  - `STOCH_0`
  - `STOCH_0_5`
  - `STOCH_5_10`
  - `STOCH_10_20`
  - `STOCH_20_40`
  - `STOCH_40_60`
  - `STOCH_60_80`
  - `STOCH_80_90`
  - `STOCH_90_95`
  - `STOCH_95_100`
  - `STOCH_100`
  - `STOCH_UNKNOWN`

Likely file: `automation/mt5/Experts/Include/Strategies/RevmaTypes.mqh`.

This should not change trade behavior.

### Step 2 - Persist birth snapshots by grid_key

Add a compact Revma grid state store that writes lifecycle records only when
state changes:

- birth
- add
- TP sync
- grid close intent / close observed
- restart load
- stale cleanup

Likely file: new small include under
`automation/mt5/Experts/Include/Strategies/Revma/`, for example
`RevmaGridStateStore.mqh`.

The store should persist enough to reload `LP_RevmaGridBirthSnapshot` by
`grid_key` on EA init. It must not write per tick.

Minimum fields:

- `run_id`
- `grid_key`
- `symbol`
- `direction`
- `lane_id`
- `variant_id`
- `grid_family`
- `system_id`
- `formula_id`
- `formula_hash`
- `source_m1_time`
- `birth_time`
- `birth_q`
- `birth_q_pips`
- `birth_q_profile`
- `birth_q_profile_id`
- `birth_anchor`
- `birth_price`
- `birth_anchor_distance_q`
- `birth_anchor_bucket`
- `birth_q_stochastic_raw`
- `birth_q_stochastic_bucket`

Stop condition: if a birth snapshot exists on disk but formula/config hash does
not match the active run contract, fail closed for that grid and emit a receipt.

### Step 3 - Make q-anchor relation metadata-only

Replace the current `LP_RevmaClassifySleeve(...)` validity dependency with a
state-signal sleeve assignment that:

- requires valid Revma state direction
- preserves anchor relation for metadata
- assigns the Revma mean-reversion sleeve from state validity
- does not reject long-above-anchor or short-below-anchor births

This requires a formula/hash update because current `LP_RevmaFormulaHash()`
payload explicitly says:

```text
birth_context=direction_plus_anchor_relation_mean_reversion_only
long_below=reversion_add_lower
short_above=reversion_add_higher
```

Gate 107 should not reuse the old formula hash after this behavioral change.

### Step 4 - Add adverse and favorable add tagging

Replace single frozen add policy with two checks:

- adverse add:
  - long: price <= min entry - spacing
  - short: price >= max entry + spacing
- favorable add:
  - long: price >= max entry + spacing
  - short: price <= min entry - spacing

Emit metadata:

- `add_type`
- `add_sequence`
- `adverse_add_count`
- `favorable_add_count`
- `add_price`
- `add_q`
- `add_q_stochastic_raw`
- `add_q_stochastic_bucket`
- `current_anchor_bucket`
- position/lots/entry/PnL before add

Do not add a live switch such as `RecoveryOnly`, `FavorableOnly`, or
`HybridQuarantine` in Gate 107.

### Step 5 - Preserve independent grid TP during portfolio block states

Separate "block new risk" from "let existing winners harvest":

- block births and adds when account/HWM says no new entries
- keep grid TP evaluation and broker TP sync eligible for existing grids
- keep account close execution separate from grid close execution

This is required to support the architecture:

```text
individual grid TP = harvest layer
account TP/HWM = portfolio cleanup layer
```

### Step 6 - Lock Gate 107A grid concurrency

Gate 107A uses the smallest safe concurrency contract:

```text
one active Revma grid per symbol/lane
```

Reason: this preserves the existing lifecycle gate and avoids hiding a larger
same-symbol long/short rearm architecture change inside the
metadata/persistence pass.

Same-symbol opposite-grid concurrency is deferred to Gate 107B or later. That
later gate must explicitly answer whether allowing a new opposite-direction grid
while a same-symbol loser remains open improves survival or only accelerates
inventory rot.

Gate 107A should still record a bounded event-level receipt when a valid birth
candidate is blocked only because the one-grid symbol/lane contract is active.
This receipt must not be emitted every tick or every bar. It should emit only on
a meaningful birth-candidate event and should include:

```text
birth_candidate_blocked_active_grid
symbol
lane_id
candidate_direction
active_grid_key
active_grid_direction
candidate_q_anchor_bucket
candidate_q_stochastic_bucket
active_grid_age_minutes
active_grid_floating_pnl
reason=ACTIVE_GRID_SYMBOL_LANE_CONTRACT
```

This gives Gate 107B evidence without taking the concurrency risk in Gate 107A.

### Step 7 - Fill grid ticket metadata

Append selected ticket IDs in `LP_GridBook::AccumulateSelectedPosition(...)`.

This should be a small metadata-only fix and helps receipt auditability.

## Files Likely Touched In Code Pass

Expected:

- `automation/mt5/Experts/Include/Strategies/RevmaTypes.mqh`
- `automation/mt5/Experts/Include/Signals/RevmaSignalState.mqh`
- `automation/mt5/Experts/Include/Strategies/RevmaGridSleeve.mqh`
- `automation/mt5/Experts/Include/Strategies/Revma/RevmaGridProtectionManager.mqh`
- `automation/mt5/Experts/Include/Portfolio/GridBook.mqh`
- `automation/mt5/Experts/Include/Core/Engine.mqh`
- `automation/mt5/Experts/Include/Core/BuildInfo.mqh`
- possibly `automation/mt5/Experts/Include/Strategies/Revma/RevmaGridStateStore.mqh`

Avoid unless concurrency is expanded:

- broad `RiskArbiter` rewrites
- broad `TradeRouter` rewrites
- account/HWM formula work
- Candidate B/regime overlays
- deposit-load governor implementation

## Recommended Stop Points

Stop before code if any of these are unresolved:

1. Disk persistence location/file naming is not accepted.
2. Formula/hash bump wording is not accepted.
3. Freedom reopens same-symbol winner rearm while loser remains open in the
   first Gate 107 implementation.

Stop during code if:

1. Restart persistence requires per-tick writes.
2. Grid close/TP sync cannot stay exact-grid scoped.
3. A change would require MT5 test execution by Codex.
4. Existing HWM/account cleanup behavior must be rewritten to proceed.

## Design Recommendation

Proceed in a narrow Gate 107A code pass only after accepting this design:

```text
Gate 107A - Revma State-Signal Metadata and Restart-Safe Birth Store
```

Scope:

- q-anchor relation becomes metadata-only.
- q stochastic raw and bucket metadata added to birth/add/close receipts.
- birth snapshots persist by `grid_key`.
- individual grid TP remains exact-grid scoped and restart-safe.
- both adverse/favorable adds are tagged.
- no optimization, no filters, no deposit-load governor, no HWM/Candidate B.

Locked Gate 107A concurrency:

```text
one active grid per symbol/lane
```

Reason: it is the smallest safe harness pass. Same-symbol multi-grid rearm is a
separate architecture change and must not be hidden inside metadata work.

Non-negotiable harvest separation:

```text
Account/HWM/block-new-entry logic must not suppress existing grid exits or
broker TP sync.
```

If this remains coupled, Gate 107A evidence can be false because profitable
grids may fail to harvest for architecture reasons unrelated to Revma.

## Verification Boundary

No MT5 tests, Strategy Tester runs, shard runners, smoke runners, benchmarks,
or optimizations were run for this packet.

Allowed next verification after code, if Freedom approves implementation:

- compile/sync only by Codex
- MT5 test execution by Freedom only
- Codex reviews Freedom-produced reports/receipts

# Gate 107A - Revma State Harvest Harness Contract

Date: 2026-07-09

Status: APPROVED ARCHITECTURE CONTRACT. Implementation not started in this
document.

## Contract

Gate 107A is a metadata, persistence, and harvest-separation gate.

Required:

- One active Revma grid per symbol/lane.
- Revma state signal is tradable regardless of q-anchor location.
- q-anchor bucket is metadata only.
- q-stochastic bucket is metadata only.
- Both adverse and favorable adds are allowed and tagged.
- Birth metadata persists by `grid_key`.
- Independent grid TP closes only the exact grid.
- Account/HWM/block-new-entry states must not suppress existing grid exits or
  broker TP sync.
- Same-symbol opposite-grid concurrency is not allowed yet.
- No optimization and no promotion.

## Deferred

Same-symbol long/short rearm is deferred to Gate 107B or later.

That later gate must explicitly answer:

```text
Does allowing a new opposite-direction grid while a same-symbol loser remains
open improve survival, or just create faster inventory rot?
```

## Bounded Blocked-Birth Receipt

Gate 107A should record a bounded event-level receipt when a valid birth
candidate is blocked by the one-active-grid symbol/lane contract.

Do not emit this every tick or every bar. Emit only on a meaningful
birth-candidate event.

Required fields:

```text
receipt_status=birth_candidate_blocked_active_grid
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

## Non-Negotiable Harvest Rule

Account/HWM/block-new-entry logic must not suppress individual grid exits or
broker TP sync.

If profitable grids fail to harvest because portfolio-level block-new-entry
logic suppresses exit/TP sync evaluation, Gate 107A evidence is invalid.

## Stop Line

Do not include:

- same-symbol opposite-grid concurrency.
- Candidate B/regime overlay work.
- HWM formula work.
- deposit-load governor implementation.
- stochastic filter.
- q-anchor filter.
- quarantine/recovery-only modes.
- parameter optimization.
- promotion or live-readiness claims.


# Gate 108 - RevMA Adaptive Grid Discovery v1 Architecture

Date: 2026-07-10

Status: **APPROVED ARCHITECTURE. IMPLEMENTATION CLOSED UNTIL GATE 107C-R
RUNTIME VALIDATION PASSES AND FREEDOM EXPLICITLY OPENS GATE 108 CODE.**

## Decision

The next RevMA research system is a three-universe, event-driven discovery
harness:

```text
R = REAL_EXECUTION_ENVELOPE_V1
U = SHADOW_RAW_COUNT_UNCAPPED_V1
C = SHADOW_SIGNED_CENTER_SUPPORT_V1
```

- `R` may place MT5 trades and is limited to one `0.01`-lot birth atom plus
  one optional `0.01`-lot add atom per grid.
- `U` is a complete deterministic model-feasible, broker-free alternative
  RevMA portfolio with no arbitrary atom-count maximum.
- `C` is identical to `U`, except that center-aligned births permanently lose
  permission for future adverse adds when signed center support crosses from
  positive to non-positive.

The two-atom real limit is an execution and tester-speed envelope. It is not an
economic claim, a candidate adaptive formula, or evidence that deeper atoms
have no value.

The shadow portfolios prevent that temporary real limit from destroying the
evidence needed to discover a market-adaptive add rule.

## Gate sequencing and current stop line

Gate 107C-R remains the active gate. Its implementation, static review,
compile, and terminal-sync proof are complete, but Freedom's controlled
runtime telemetry validation remains open.

The required Gate 107C-R run uses:

```text
ReceiptMode=CompactLongRun
OutputFolder=AUTO
```

It must validate controlled birth, add, reject, close-latch, account-close,
artifact, source-identity, contamination, and PnL-reconciliation truth. It has
no profitability interpretation.

Reference:
`docs/research/gates/gate107/GATE107CR_REVMA_RESEARCH_INTEGRITY_CORRECTION_2026-07-09.md`.

Gate 108 source work may begin only after:

1. Freedom produces the Gate 107C-R controlled runtime output.
2. The output is reviewed and Gate 107C-R is explicitly accepted.
3. Freedom freezes `CapitalBudgetFraction` in the controlled profile.
4. Freedom explicitly opens the Gate 108 implementation pass.

Codex must not run Strategy Tester, smoke runners, shard runners, benchmarks,
optimization, or any other MT5 backtest automation. Freedom owns every MT5
runtime test.

## Objective

Build the smallest RevMA prototype that can answer all of these questions in
one coherent long-run evidence set:

1. Does local after-cost RevMA harvesting survive without deep real averaging?
2. What profit did deeper virtual atoms add?
3. What liability, margin, and capital-time did those atoms require?
4. Does loss of signed center support identify destructive adverse additions?
5. Does path geometry identify failures that the center estimate misses?
6. Which primitive variables consistently separate valuable deeper atoms from
   destructive ones across symbols and years?
7. Can harvest-funded portfolio cleanup preserve the frozen cycle reference
   after costs?
8. Can the six-year FX28 test complete at usable speed?

The gate collects evidence for a later adaptive formula. It does not fit that
formula in advance.

## Non-goals

Gate 108 does not authorize:

- parameter optimization or a grid/TP/SL sweep;
- a fitted or weighted `NextAtomValue` score;
- stochastic entry filtering;
- anchor-side exclusion;
- centerline-driven real trading or forced liquidation;
- several center thresholds, q meshes, hard stops, or re-entry modes;
- q/state-signal redesign;
- centerline-window optimization;
- pair or year exclusions;
- Candidate B, HWM, Kyma, Katarakti, or unrelated strategy work;
- promotion, live-readiness, or profitability guarantees;
- a restart-safety claim for centerline authority;
- broad `Engine.mqh` rearchitecture;
- another monolithic expansion of `RevmaGridSleeve.mqh`.

## Research foundations and transfer boundary

The saved literature supports the following shapes, not direct RevMA trading
equations:

- local reversible movement must overcome net directional displacement;
- marginal inventory burden should rise progressively with inventory;
- a changing reference-price estimate may indicate changing expected edge;
- volatility, age, costs, liquidity, margin, and concentration belong on the
  liability side of an add decision.

The Chakraborty-Kearns identity `(K - z^2) / 2` is exact only for its idealized
symmetric unit-ladder model. Gate 108 uses `K` and `z` as path diagnostics, not
as RevMA PnL, TP, or direct add authority.

The Avellaneda-Stoikov and Fodra-Labadie inventory structures motivate a
progressively increasing marginal-inventory feature. They do not transfer
their passive limit-order, known-process, or terminal-liquidation assumptions
into this directional MT5 grid.

Repo reference:
`docs/literature/notes/gate100a-literature-to-alpha-formula-distillation-2026-07-07.md`.

Primary references:

- https://www.cis.upenn.edu/~mkearns/papers/marketmaking.pdf
- https://people.orie.cornell.edu/sfs33/LimitOrderBook.pdf
- https://arxiv.org/abs/1206.4810

Every literature-derived mechanism remains a hypothesis until reproduced on
Limni data with deterministic receipts.

## Shared immutable definitions

### Atom

```text
AtomLots = 0.01
BirthAtoms = 1
```

No theoretical fractional size may be rounded up. Every real or virtual atom
uses the broker minimum/step-validated `0.01` lot size.

### Observation clock

Birth, add, local-harvest, shadow, and formulaic account decisions operate only
on a strictly new completed M1 observation.

Close latches may continue executing on later engine steps until flat without
requiring a new strategy signal.

### Frozen birth geometry

For every branch grid, freeze:

```text
P0       = closed-M1 signal/decision price
P_stress_ref = executable quote proxy used before admission
P_fill   = actual or virtual executable fill price, stored separately
C0       = birth center estimate
q0       = birth q
d        = +1 long, -1 short
signal identity and formula/source hashes
birth anchor/stochastic buckets as metadata
```

`P0` is the structural reference. `P_fill` and weighted entry own execution and
liquidation economics. `P_stress_ref` owns pre-admission q-cash estimation.
Moving average entry must never move the center-support boundary.

Before a branch birth can be admitted, require finite positive `P0`, `q0`,
`P_stress_ref`, and `A_g_candidate`; a finite positive `C0`; a valid direction;
and a positive broker tick size. Missing or non-finite center state is
`CENTER_NOT_AVAILABLE`, never a center-misaligned classification. Invalid
price/q/cell geometry rejects the branch birth before any division or trading
authority is evaluated.

### Discovery mesh

```text
DiscoveryCellRaw = 0.10 * q0
DiscoveryCellTicks = ceil(DiscoveryCellRaw / BrokerTickSize)
DiscoveryCell = DiscoveryCellTicks * BrokerTickSize
MeshId = DISCOVERY_MESH_V1
```

`0.10q` is a frozen v1 observation lattice retained for continuity with the
current research. Outward tick quantization ensures that the executable mesh
is observable and is never smaller than the raw formula. The quantization rule
is formula-hashed. The mesh is not final grid canon and must not become an
optimizable MT5 input in this gate.

### Money quantum

Derive account-currency precision from the account/broker contract:

```text
MoneyQuantum = 10 ^ (-AccountCurrencyDigits)
```

For an ordinary two-decimal account currency, `MoneyQuantum = 0.01`.

All economic boundary comparisons use integer minor-currency units rather than
raw floating-point comparisons:

```text
positive realized/estimated gain -> floor(value / MoneyQuantum)
negative liability               -> floor(value / MoneyQuantum)
positive budget                   -> floor(value / MoneyQuantum)
actual equity for floor proof     -> floor(value / MoneyQuantum)
frozen reference equity           -> ceil(value / MoneyQuantum)
```

Mathematical `floor` makes a negative liability conservatively more negative.
The quantization rule is shared and formula-hashed; it is not an economic
epsilon or optimization input.

## Direction-specific q-cash stress

For each grid, freeze:

```text
A_g_candidate = absolute estimated account-currency loss from one adverse q0
                move from P_stress_ref for one 0.01-lot atom

A_g = post-fill frozen q-cash stress reconciled from P_fill
```

Use broker-real profit calculation where available:

- long: `P_stress_ref -> P_stress_ref - q0` before admission, then
  `P_fill -> P_fill - q0` after fill;
- short: `P_stress_ref -> P_stress_ref + q0` before admission, then
  `P_fill -> P_fill + q0` after fill.

Admission uses `A_g_candidate`. After a confirmed real or virtual fill,
recalculate and freeze `A_g` from `P_fill`, then reconcile the assigned
reservation. If fill-based reservation exceeds the pre-admission estimate:

- set `reservation_overrun=true` and record the difference;
- replace the candidate estimate with the fill-based reservation;
- block later new exposure in that branch while portfolio reservation exceeds
  `B`;
- do not retroactively erase the executed fill or silently change `B`;
- keep hard-risk authority separate.

Record both valuations, the valuation method, account currency, volume
minimum/step, and formula revision. Missing or non-positive valuation is a
birth/fill invariant failure. Do not assume positive and negative one-q values
are identical.

`A_g` is a one-q stress unit. It is not a maximum-loss estimate.

## Frozen account-cycle mandate

At a confirmed fully flat managed-RevMA boundary:

```text
E_ref = actual or branch-virtual account equity
CapitalBudgetFraction = 0.10
B     = E_ref * CapitalBudgetFraction
H     = 0
```

The capital-budget fraction is a declared risk mandate, not an optimized alpha
parameter. Freedom froze the exact value `0.10` on 2026-07-10. It is part of
the controlled profile and Gate 108 formula hash, is not exposed as an
optimization input, and must not be varied in a Gate 108 budget ladder. Early
capacity exhaustion or hard-risk liquidation is valid economic evidence and
must not cause the mandate to be enlarged. No implementation chat may infer a
replacement value from TP, historic drawdown, account size, another strategy
setting, or later prop-firm deployment limits.

External trades, deposits, withdrawals, and non-RevMA PnL must be absent or
explicitly separated. Otherwise the affected cycle is invalid.

Gate 108 uses a RevMA-only account-cycle contract. Every non-RevMA strategy
must be disabled and absent from the controlled account/test. Preflight must
verify zero TrendFollow/Strict, external, manual, malformed-magic, deposit, and
withdrawal contamination. If the current real close API can address other
managed lanes, the implementation must either add an exact RevMA-only selector
or fail closed unless those lanes are proven absent; it may not absorb or close
their PnL under Gate 108.

### Reservation

Real branch:

```text
CandidateGridReservation_R = 2 * A_g_candidate
GridReservation_R = 2 * A_g after fill reconciliation
```

The complete two-atom reservation is assigned at accepted birth and remains
until confirmed flat.

Shadow branches:

```text
ReservedAtoms_shadow = max(2, PeakAdmittedAtomCount)
CandidateGridReservation_shadow = ReservedAtoms_shadow * A_g_candidate
GridReservation_shadow = ReservedAtoms_shadow * A_g after fill reconciliation
```

- Birth reserves two atoms so initial branch admission is comparable with `R`.
- Atom two consumes the already assigned reservation.
- Every newly admitted peak atom above two requires one additional `A_g` of
  branch portfolio reservation.
- Partial close execution cannot reduce `PeakAdmittedAtomCount` or reservation.
- Reservation never shrinks before the branch grid is confirmed flat.

Admission requires:

```text
BranchPortfolioReservation + IncrementalCandidateReservation <= B
```

This is count-uncapped but not capital-unbounded. Candidates rejected after
capital or broker feasibility fails remain evidence rows; they must not be
presented as model-feasible trades on a USD 1,000 account.

### Deterministic allocation

When multiple exposure candidates compete on one completed-M1 batch:

1. `BeginClosedM1Batch` for the branch;
2. observe all eligible symbols and build every valid candidate without
   committing any;
3. calculate incremental reservation;
4. sort smallest incremental reservation first;
5. break exact ties by canonical symbol ID and deterministic candidate ID;
6. `SortAndAllocate` until branch capacity is exhausted;
7. `CommitTransitions` only after allocation is complete;
8. `EndClosedM1Batch` and reconcile the branch batch hash.

This selection is formula-versioned and reported because it favors lower
q-cash symbols. Results must show candidate, acceptance, rejection, reserved
q-cash, and realized outcome by symbol and currency.

Immediate symbol-by-symbol commit is forbidden because it makes canonical
universe iteration order an undeclared capacity selector.

## Common lifecycle ordering

All three universes use the same lifecycle ordering and differ only where this
document explicitly says they differ.

Close authority precedence:

```text
account_risk
account_cleanup
grid_harvest
ordinary birth/add activity
```

Close authority and terminal attribution are separate:

```text
origin_terminal_reason
  = immutable first grid/account reason attached to the affected grid

active_portfolio_close_authority
  = none | account_cleanup | account_risk
```

- A grid's existing `grid_harvest`/grid terminal reason is never overwritten.
- Account cleanup may take execution ownership of remaining managed inventory
  while preserving every grid's original terminal reason.
- During cleanup, a newly satisfied hard-risk condition escalates active
  portfolio authority to `account_risk`; authority never de-escalates.
- Escalation changes who owns remaining close work, not historical attribution.
- All owners/latches continue until their exact branch inventory is confirmed
  flat.

On an ordinary completed-M1 decision:

1. update the shared market/signal snapshot once;
2. schedule `U` and `C` for every eligible shared observation regardless of
   real-branch capacity, cleanup, close ownership, or execution enablement;
3. update each branch's marked inventory and cycle state;
4. continue any existing close owner;
5. evaluate hard risk and cleanup;
6. evaluate local harvest;
7. only when no close owner exists, build birth/add candidates;
8. allocate capacity with the branch two-pass batch scheduler;
9. commit real or virtual fills only after branch-specific execution success.

### Excursion and local harvest

Mark `excursion_completed` after price has completed at least one
`DiscoveryCell` away from `P0` in either direction.

```text
GridRealizedToDate =
    sum attributed DEAL_PROFIT
  + sum attributed DEAL_SWAP
  + sum attributed DEAL_COMMISSION
  + sum attributed DEAL_FEE

GridOpenMark =
    current open price PnL
  + broker-posted open-position swap not already present in deal history

EstimatedRemainingCloseCosts =
    formula-declared remaining exit commission and fee estimate

EstimatedGridLiquidationPnL =
    GridRealizedToDate
  + GridOpenMark
  - EstimatedRemainingCloseCosts
```

Spread is represented by executable bid/ask entry and liquidation prices; it
must not be deducted a second time. Do not invent historical slippage or impact
precision. Any additional close-cost model must be separately sourced,
formula-identified, and shared by `R/U/C`.

For a grid with a partially executed close latch, realized close deals remain
inside `EstimatedGridLiquidationPnL` until the grid is confirmed flat. On flat,
the fully reconciled grid result moves to its terminal-owner ledger exactly
once.

Local harvest becomes eligible only when:

```text
excursion_completed
and EstimatedGridLiquidationPnL >= MoneyQuantum
```

Harvest is evaluated before add permission. Once eligible, latch
`grid_harvest`, block all later adds for that grid, preserve close ownership,
and continue until confirmed flat.

### Add semantics and jump parity

The current EA emits at most one add intent for a grid on one completed-M1
evaluation. Gate 108 preserves that behavior in all branches.

Atom-admission identity is:

```text
branch_id + branch_grid_id + source_m1_time
```

That identity may admit at most one atom. During missing-bar catch-up, shadows
may consume only the same externally exposed decision observations available to
`R`; they must not trade every internally reconstructed signal bar unless `R`
is explicitly evaluated on those identical decision points. Duplicate identity
is an invariant failure, not another add opportunity.

For each branch grid:

- compare the current completed-M1 decision price with one spacing beyond the
  branch grid's current minimum and maximum executed entry;
- when an adverse or favorable threshold is reached and harvest is not
  eligible, create at most one atom candidate;
- use the branch's executable market-price proxy for the virtual fill;
- classify the candidate as `adverse` or `favorable`;
- never backfill several virtual atoms merely because one M1 close jumped
  across several discovery cells.

Path diagnostics may count every completed cell boundary crossed by the jump.
Trade admission may not. Record `completed_cells_crossed` and
`unfilled_jump_cells` so the two concepts cannot be confused.

This distinction preserves current formula parity and prevents a jump from
creating a different, slower ladder strategy.

### Portfolio harvest ledger

Per branch:

```text
H = cumulative realized after-cost PnL from local grid_harvest closures
    since the branch cycle began

R_nonharvest = cumulative reconciled after-cost PnL from fully closed
               account_cleanup or account_risk inventory in the active cycle

L = sum EstimatedGridLiquidationPnL for every not-yet-flat branch grid

EstimatedManagedCyclePnL = H + R_nonharvest + L
```

`H` excludes cleanup, hard-risk, manual/external, and unexplained PnL.
Manual/external or unexplained PnL invalidates the cycle. Cleanup and hard-risk
triggers are evaluated before a portfolio close starts, when `R_nonharvest=0`;
`R_nonharvest` then preserves exact marked-cycle accounting during partial
account liquidation and any cleanup-to-risk escalation.

### Harvest-funded garbage collection

Trigger branch portfolio cleanup only when:

```text
H > 0
L < 0
H + L >= 0
```

All terms in this trigger use the shared conservative integer minor-unit
quantization. Raw doubles never decide the boundary.

The cleanup owner blocks new exposure and closes all managed branch inventory
until flat. Confirmed flat equity must satisfy:

```text
actual_or_virtual_equity >= E_ref
```

Otherwise set `cleanup_shortfall=true` and classify the economically clean
branch as `VALID_GATE108_DISCOVERY_FALSIFIED`. Missing, contaminated, or
unreconciled shortfall evidence is invalid. Never silently lower `E_ref` or
apply a tolerance beyond the declared minor-unit quantization.

### Hard risk

Trigger branch account risk only when:

```text
H + L <= -B
```

The pre-latch comparison uses integer minor units. During an active cleanup,
escalation to hard risk uses `H + R_nonharvest + L <= -B` so realized partial
cleanup cannot disappear from the cycle mark.

Latch `account_risk`, block all new exposure, liquidate managed branch
inventory until flat, preserve the original cycle loss, and start a new cycle
only after confirmed flat.

Reservation stress and hard cycle loss intentionally share one declared
capital mandate in v1, but their economic meanings remain distinct in reports.

### Re-entry

After local profitable harvest, the symbol may rebirth on the earliest valid
completed-M1 observation strictly later than both the close trigger and
confirmed flat inventory. No direction change is required.

After account cleanup or hard risk, every affected symbol must observe a fresh
direction/sleeve/variant identity transition before branch rebirth.

Each shadow owns its own flat, cycle, capacity, cleanup, hard-risk, and re-entry
state after divergence. A shadow may not follow later real-branch births or
closes merely for convenience.

## Universe R - bounded real execution

Formula ID:

```text
REAL_EXECUTION_ENVELOPE_V1
```

Authority:

- may place real MT5 orders through the existing router only;
- one `0.01` birth atom;
- one optional `0.01` add atom;
- maximum two executed atoms / `0.02` lots per grid;
- no third atom or recovery exception;
- add may be adverse or favorable;
- centerline, stochastic, anchor bucket, `K/z`, and inventory-shape features
  have zero real trading authority.

A real grid exceeding two atoms is a formula-invariant failure.

The real branch exists to prove bounded execution, harvest, cleanup, hard risk,
re-entry, reconciliation, and speed. Its standalone result must never be
summarized as proof that two atoms are economically sufficient.

## Universe U - raw count-uncapped shadow portfolio

Formula ID:

```text
SHADOW_RAW_COUNT_UNCAPPED_V1
```

`U` is a complete deterministic model-feasible, broker-free alternative
portfolio under the frozen fill/cost/margin proxy contract:

- same state-signal births as the real formula;
- independent branch admission, capacity, grids, fills, closes, cycles, and
  re-entry;
- no arbitrary atom-count maximum;
- at most one atom candidate per grid per completed M1;
- both adverse and favorable additions with harvest precedence;
- bid/ask-consistent fill proxy;
- spread, commission, swap, weighted entry, liquidation PnL, margin,
  reservation, cleanup, hard risk, and concentration accounting;
- no MT5 order, position, ticket, TP synchronization, or broker position scan;
- no influence on `R` or `C`.

`U` estimates what deeper count-uncapped averaging earned and what capital and
time the frozen model required. It is not broker-execution proof after branch
divergence; partial fills, rejection, slippage, historical swap, and margin are
only as reliable as the reconciled proxy contract.

It is not unlimited financing.

Infeasibility behavior is frozen as follows:

- `R` capacity/risk rejection before routing is a valid blocked candidate.
- Any `R` no-money or broker rejection after routing makes the run
  `formula_clean=false`, preserving Gate 107C-R semantics.
- `U/C` reservation or estimated-margin rejection blocks that candidate only,
  records the first and latest infeasibility, and may reconsider a later
  candidate if branch capacity recovers and no close authority is active.
- An unavailable/non-finite cost, margin, or valuation model invalidates that
  shadow branch; it is not an ordinary rejection.
- `U/C` hard-risk authority liquidates and resets according to the common
  lifecycle.
- Gate 108 does not continue a shadow portfolio after modeled insolvency.
  Shared market/path diagnostics may continue, but no post-insolvency virtual
  trade or PnL may enter survivability claims.

## Universe C - signed-center-support shadow portfolio

Formula ID:

```text
SHADOW_SIGNED_CENTER_SUPPORT_V1
```

`C` is identical to `U` except for one authority applied only to
center-aligned births.

### Center estimate boundary

The current RevMA center is a causal empirical median of up to the latest 55
completed synthetic q-event prices. It is a `CenterEstimate`, not proven fair
value or a conditional expected future price.

Gate 108 tests the existing evolving-q center policy. Because q changes the
spacing and cadence of events entering that median, center migration may partly
reflect a sampling-regime change rather than movement of a fixed estimator.
Gate 108 does not build a frozen-q duplicate center. It must attribute center
outcomes by `current_q/q0`, q profile/revision, center-update count, q-event
cadence, and time/events since the center last changed.

Define:

```text
Support0_q = d * (C0 - P0) / q0
Supportt_q = d * (Ct - P0) / q0
Revisiont_q = d * (Ct - C0) / q0
```

`Revisiont_q` is directed center revision. It must not be mislabeled center
support.

The authority sign uses integer broker ticks:

```text
P0_support_ticks = round(P0 / BrokerTickSize)
C0_ticks         = round(C0 / BrokerTickSize)
Cprevious_ticks  = round(Cprevious / BrokerTickSize)
Ccurrent_ticks   = round(Ccurrent / BrokerTickSize)

Support0Sign        = sign(d * (C0_ticks - P0_support_ticks))
SupportPreviousSign = sign(d * (Cprevious_ticks - P0_support_ticks))
SupportCurrentSign  = sign(d * (Ccurrent_ticks - P0_support_ticks))
```

The q-valued fields remain telemetry; integer ticks decide the crossing.

For center-aligned births only:

```text
Support0Sign > 0
and SupportPreviousSign > 0
and SupportCurrentSign <= 0

=> latch adverse_shadow_adds_frozen = true
```

The sign comparison uses broker tick-normalized prices. It does not use an
epsilon with economic authority.

The latch:

- is irreversible for that branch grid;
- blocks future adverse adds only;
- leaves favorable adds governed by the common lifecycle;
- keeps existing inventory alive;
- does not close the grid;
- does not trigger cleanup or hard risk;
- does not affect `R` or `U`.

For center-misaligned births:

```text
Support0Sign <= 0
center_latch_applicability = NOT_APPLICABLE_V1
centerline authority = metadata only
```

Long-above-center and short-below-center outcomes remain separate in all
reporting. Gate 108 does not apply the older absolute-displacement mirrored
boundary to them.

If `Ct` is missing or non-finite after a valid birth, record
`CENTER_NOT_AVAILABLE`; do not latch, do not reclassify the grid as
misaligned, and do not give center policy authority on that observation.

The explicit causal question is:

> Does withdrawing adverse-add permission when original signed center support
> disappears avoid more liability than profitable recovery it destroys?

### Counterfactual attribution boundary

`U` and `C` share a deterministic `shared_origin_id` only when they admit the
same birth from identical pre-divergence state. A shared
`opportunity_id = shared_origin_id + symbol + source_m1_time + candidate_type`
may be assigned only while the relevant pre-candidate states still match.

Report three different objects without collapsing them:

1. `U_atom_ex_post_contribution`: descriptive after-cost contribution of the
   U atom corresponding to the first matched opportunity blocked by C;
2. `U_vs_C_lifecycle_delta`: whole-grid and whole-portfolio outcome difference
   after divergence;
3. `matched_causal_opportunity`: only an opportunity whose pre-candidate state,
   market snapshot, and candidate identity were identical.

After U/C state diverges, later fills, capacity, cleanup, close, and rebirth
paths are not one-atom causal matches. Do not label a later U loss as
`avoided_liability` or a later U gain as `blocked_profit` at atom level. Use
descriptive U contribution and whole-lifecycle branch deltas.

### Restart boundary

The center estimate is causal during uninterrupted deterministic replay but is
not restart-invariant under finite bootstrap profiles. Gate 108 therefore:

- permits center support to control `C` only;
- requires the six-year discovery run to be contiguous;
- records source hash, q profile, initial-history boundary, q-day count, event
  count, and reconstruction epoch;
- makes no live restart-safety claim.

Before center support receives real authority, a later gate must either persist
complete signal state or define an explicitly bounded reconstruction window
that reproduces identically after restart. Either choice requires a new formula
version and its own parity evidence.

## Path geometry diagnostics

Path geometry and trade placement are separate.

Freeze integer tick geometry:

```text
tick_size = broker tick size
h_ticks   = DiscoveryCellTicks
P0_ticks  = round(P0 / tick_size)
Pt_ticks  = round(Pt / tick_size)
```

Define `Pt` as the same closed-M1 structural decision-price series used for
`P0`; bid, ask, executable fill, and weighted entry never enter path geometry.
At completed-M1 cadence:

```text
completed_cell_index_t =
  sign(Pt_ticks - P0_ticks)
  * floor(abs(Pt_ticks - P0_ticks) / h_ticks)

K_cells += abs(completed_cell_index_t - completed_cell_index_previous)
z_cells  = completed_cell_index_t

ck_idealized_score = K_cells - z_cells^2
reversible_path     = K_cells - abs(z_cells)
trend_efficiency    = abs(z_cells) / max(K_cells, 1)
```

Also maintain primitive counts:

```text
completed_cell_crossings
matched_reversal_crossings
adverse_frontier_expansions
favorable_frontier_expansions
new_extreme_count
time_since_last_reversal
time_since_last_positive_liquidation_opportunity
maximum_single_observation_cell_jump
```

Every crossed completed-cell boundary in a closed-M1 jump contributes to path
geometry. This is not an intrabar claim; closed M1 does not establish the order
of high/low movements inside the bar.

`ck_idealized_score` is paper-specific metadata. It is not PnL, scale-free
economic surplus, or trading authority.

## Inventory and cost diagnostics

For an equal-atom candidate within a grid:

```text
n_before_candidate = current atom count before the proposed atom
RawMarginalQuadraticIncrement = 2*n_before_candidate + 1
FrozenQCashExposure = n_before_candidate * A_g

MarginalSquaredQCashExposure =
  ((n_before_candidate + 1) * A_g)^2
  - (n_before_candidate * A_g)^2
```

Raw `2*n_before_candidate+1` is comparable only for equal atoms under the same
frozen q-cash value. Cross-symbol economic comparison uses the squared q-cash
increment.

Also maintain:

```text
weighted entry and after-cost break-even
spread_cost_q
commission
accrued swap
estimated liquidation cost
grid age
time since last add
capital-time
free-margin burden
currency concentration
current_q / q0
center update/event age
```

These fields remain diagnostics. Gate 108 may not combine them into a fitted
weighted add score.

## Speed architecture

Tester speed is a formula acceptance boundary, not a later cleanup task.

### Fixed branch topology

Use bounded branch state:

```text
shadow_grid[2][28]
shadow_portfolio[2]
```

There is at most one active virtual RevMA grid per symbol per shadow branch.
No shadow cohort may remain attached to a real grid after branch divergence.

The existing market/signal/center snapshot is built once and consumed by all
branches. Shadows must not rebuild q or center state.

### Aggregate arithmetic state

Each shadow grid maintains incremental aggregate state such as:

```text
active and deterministic branch grid ID
symbol, direction, formula identity
P0, P_fill, C0, q0, A_g, spacing
atom count and total lots
weighted entry sum
minimum/maximum executed entry
adverse/favorable add counts
last add time
excursion and center-latch state
center update count and first/last update time/event index
cumulative signed/absolute center revision
center regression sums (x, y, x2, xy)
minimum/maximum signed support and time since last center change
commission and swap estimates
open/realized after-cost PnL
worst/best grid PnL
K, z and frontier/reversal primitives
reservation, margin, capital-time
close owner/reason/times
rolling deterministic event hash
```

Each shadow portfolio maintains:

```text
cycle ID, E_ref, B, H, R_nonharvest, L
portfolio reservation and margin
cleanup and hard-risk latch state
realized cycle PnL
maximum liability/margin/concentration
first infeasibility
formula validity and reconciliation hash
```

Computing `L` across at most 28 grids per branch on completed M1 is bounded.

### Transition ledger

Maintain lifecycle and cell geometry in fixed aggregate state. A multi-cell
jump updates `K`, `z`, crossing, frontier, and jump counters arithmetically; it
must not create one event object or row per crossed cell.

Atom admissions and lifecycle-owner transitions use a dedicated fixed-size
write buffer that batch-streams to one discovery-transition artifact. Never
retain the complete lifecycle path in memory and never route high-depth atom
rows through the general receipt writer.

Buffer row count, flush batch size, byte guard, and artifact schema are
formula-hashed implementation constants rather than user inputs. Open, write,
flush, or deterministic guard failure invalidates the branch/run; it never
silently drops or caps evidence.

Per-atom contribution and depth analysis is derived offline from timestamped
atom/lifecycle transition rows plus aggregate grid/cycle summaries. No
historical atom is updated or scanned on every M1.

### Receipt modes

Tiny audit mode may emit every branch transition through the dedicated audit
artifact.

Long-run ordinary receipts persist only:

- branch birth;
- first divergence from `R`;
- center-support latch;
- first capital/margin/broker infeasibility;
- grid harvest/close;
- account cleanup/hard-risk latch and completion;
- branch cycle close;
- final grid, symbol, cycle, top-offender, and reconciliation rows.

Every atom admission still enters the dedicated batch-streamed discovery
transition artifact. Annual and rolling-12-month analysis is generated offline
from timestamped transition/lifecycle artifacts; the EA must not retain the
whole run in memory to calculate those reports.

Do not write per tick, unchanged per M1, repeated account-history scans, fake
ticket lists, or per-add persistence rewrites.

If a memory, event-buffer, byte, or resource guard is reached, mark the
branch/run invalid. Never silently cap an allegedly count-uncapped shadow.

## Module ownership

Implementation must remain thin and reviewable.

Expected ownership shape, subject to live source inspection:

```text
Strategies/RevmaGridSleeve.mqh
  real intent orchestration and shared snapshot handoff only

Strategies/Revma/RevmaDiscoveryTypes.mqh
  branch IDs, immutable contracts, aggregate state

Strategies/Revma/RevmaPathGeometry.mqh
  policy-neutral cell/path primitives

Strategies/Revma/RevmaCenterSupportPolicy.mqh
  signed-support metadata and C-branch latch only

Strategies/Revma/RevmaShadowPortfolio.mqh
  U/C grids, capacity, lifecycle, cleanup, hard risk, re-entry

Strategies/Revma/RevmaDiscoveryTelemetry.mqh
  buffered transition ledger and final summaries
```

Do not duplicate broker routing, q/state construction, or the real position
index. Do not put shadow trade APIs in `TradeRouter.mqh`. `Engine.mqh` may
schedule/orchestrate but must not own strategy formulas.

If live inspection shows a smaller clean file boundary, use it and record the
reason. Do not collapse the system into one new monolith.

## Required evidence sequence

### Prerequisite - Gate 107C-R closure

Freedom runs the already-defined controlled telemetry validation. Required:

- all expected artifacts exist;
- executed identities and PnL reconcile;
- close owners/latches reach flat;
- source revision is exact;
- no broker contamination;
- runtime timing summaries exist.

No profitability interpretation.

### Gate 108A - static implementation and compile

Required source/static proof:

- branch/formula IDs are explicit and hashed;
- `CapitalBudgetFraction` is explicitly frozen, valid, and profile-pinned;
- `R` cannot exceed two atoms;
- shadows cannot call MT5 trade APIs;
- one add per branch grid per completed M1;
- atom identity is idempotent by branch/grid/source-M1;
- each branch uses two-pass build/sort/allocate/commit scheduling;
- U/C scheduling is independent of R-only blocks and close ownership;
- harvest precedes add;
- branch states are independent after divergence;
- center support affects aligned `C` adverse adds only;
- misaligned center births remain observational;
- no per-cell object expansion or per-tick/per-M1 receipt fan-out;
- dedicated transition buffering is fixed-size, batch-streamed, and hashed;
- controlled account ownership is RevMA-only;
- resource-guard failure invalidates rather than caps;
- repository and configured terminal compiles are `0 errors, 0 warnings`;
- source/profile hashes reconcile.

Codex may implement, compile, and sync only after the gate is explicitly
opened. Codex must not run MT5 runtime evidence.

### Gate 108B - Freedom-owned tiny mechanics and parity audit

First prove on a deliberately small controlled window:

```text
R never exceeds two atoms
U/C use no broker positions
branch births and fills are deterministic
one observation cannot create multiple atoms
favorable/adverse classifications match current semantics
U and C match before their first authorized divergence
C latches only on aligned positive-to-nonpositive support loss
cleanup/risk/re-entry remain independent by branch
all branch ledgers reconcile
runtime timing and output size remain usable
```

Shadow execution estimates must be reconciled against real execution on a
short, bounded parity surface. At minimum, compare the common pre-divergence
birth/add fills, weighted entry, costs, marked PnL, grid close time, and account
state. If a tester-only deeper parity harness is added, it must be impossible
to activate in live execution and must not become a production optimization
input.

No six-year result is valid before this parity surface passes.

### Gate 108C - Freedom-owned short performance projection

Compare the same short window with discovery shadows disabled/enabled and
report:

```text
closed-M1 cycles
wall time
cycles per second
RevMA evaluation time
shadow update time
receipt flush time
output rows and bytes by artifact
projected six-year wall time
```

If the projected long run is operationally unusable, stop and repair the
bounded arithmetic or receipt path. Do not redesign strategy formulas inside
the speed correction.

### Gate 108D - one contiguous six-year FX28 run

After mechanics, parity, and performance acceptance, Freedom runs one
contiguous six-year FX28 test. It is not an optimization ladder.

The same run must produce:

- whole-period and calendar-year results;
- rolling 12-month results;
- branch, symbol, bucket, and account-cycle attribution;
- local harvest and cleanup funding;
- deeper-atom profit versus liability;
- matched U-atom ex-post contribution plus whole-lifecycle U-versus-C deltas;
- path geometry and frontier attribution;
- tail grids and first infeasibility;
- final flat/unresolved inventory truth;
- formula-clean, contamination, and reconciliation status;
- runtime/output-size proof.

## Evidence fields

Persist policy-neutral primitives wherever possible and derive ratios offline.

Minimum event primitives:

```text
run/source/config/formula/branch identities
branch grid/cycle/candidate/shared-origin/opportunity IDs
symbol, direction, birth bucket, event time/type
P0, P_stress_ref, P_fill, candidate/current price
C0, previous/current center
q0, current q, current_q/q0, q profile/revision, q-event cadence
A_g_candidate, A_g, discovery-cell ticks/price
support tick values/signs, Support0_q, Supportt_q, Revisiont_q,
latch/applicability
center-update count/times/event indices and regression sums
cumulative signed/absolute revision, support min/max, center staleness
previous/current completed-cell index
K_cells, z_cells
crossing, reversal, frontier, jump counts
n_before_candidate, peak/current atoms, lots, weighted entry sum
adverse/favorable counts
reservation, reservation overrun, q-cash, margin, concentration
commission, swap, liquidation cost
H, R_nonharvest, L, B, E_ref and integer minor-unit forms
decision, rejection, close owner/reason
event/reconciliation hashes
```

Derived offline:

```text
K - z^2
reversible path
trend efficiency
reversal/frontier rates
center slope and erosion ratios from emitted sufficient statistics
2*n_before_candidate + 1
marginal squared q-cash exposure
capital-time
U atom ex-post contribution for genuinely matched opportunities
whole-lifecycle and whole-portfolio U-versus-C deltas
annual and rolling-window comparisons
```

Final lifecycle summaries must include:

```text
realized and marked after-cost PnL
peak atoms, lots, reservation, q-cash, margin, MAE and age
local harvest, cleanup and hard-risk owner/count/PnL
cleanup funding and shortfall
first infeasibility
center latch and adds blocked afterward
final flat/unresolved status
broker contamination
formula-clean and reconciliation status
runtime and output-size totals
```

## Result classifications

### `INVALID_GATE108_EVIDENCE`

Use when any required evidence is untrustworthy, including:

- Gate 107C-R prerequisite not accepted;
- unset/invalid/unpinned `CapitalBudgetFraction`;
- branch identity, fill, PnL, or cycle reconciliation failure;
- shadow/real pre-divergence parity failure;
- broker contamination;
- real no-money/broker rejection or non-RevMA account contamination;
- unavailable/non-finite shadow fill, cost, margin, or q-cash model;
- missing, contaminated, or unreconciled cleanup-shortfall evidence;
- real grid above two atoms;
- shadow broker trade activity;
- multiple atoms created by one branch grid observation;
- duplicate branch/grid/source-M1 admission identity;
- per-cell object/receipt expansion from one price jump;
- center authority applied to a misaligned birth or non-adverse add;
- branch state following another branch after divergence;
- silent shadow cap/resource exhaustion;
- missing terminal inventory truth;
- missing runtime/output evidence.

### `VALID_GATE108_DISCOVERY_FALSIFIED`

Mechanics and evidence are clean, but the tested lifecycle fails to preserve
capital after costs, produces a correctly measured cleanup shortfall,
repeatedly exhausts the declared mandate without adequate harvest, or neither
shadow supplies a credible path to a better adaptive rule.

This falsifies Discovery v1's tested formula shapes, not all RevMA systems.

### `VALID_GATE108_DISCOVERY_INFORMATIVE`

Mechanics and evidence are clean and the run identifies stable, interpretable
marginal-add relationships, even if no branch is yet economically promotable.

### `VALID_GATE108_ADAPTIVE_CANDIDATE`

Use only when mechanics are clean and the evidence shows a simple candidate
relationship that is reasonably stable across symbols, calendar years, and
rolling 12-month windows; improves liability/cleanup outcomes after costs; and
does not merely hide losses through infeasibility or unresolved terminal
inventory.

This classification opens a later equation-compression gate. It is not strategy
promotion or live readiness.

## Later formula target

Gate 108 may inform, but may not implement, a later structure such as:

```text
allow next atom only when:

empirically validated signed-center support/convergence value remains positive
and reversible movement still dominates path debt
and marginal frozen q-cash risk is affordable
and portfolio cleanup capacity remains intact
```

The exact operational definitions must be compressed from Gate 108 evidence,
not invented or fitted before the run.

## Hard stop

Stop after producing the Gate 108 architecture and handoff.

Do not implement Gate 108, mutate EA source, compile, sync terminals, or run any
MT5 test until Gate 107C-R runtime validation is accepted and Freedom explicitly
opens the implementation pass.

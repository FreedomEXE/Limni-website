# Gate 109 FX28 Cycle-Start Invariant Decomposition — 2026-07-12

## Status

The `AppendTransition()` cycle-start preflight is now ordered and fail-closed.
The cycle-start event-shape and transition-state paths expose the first
violated subcondition. This is a compile-verified diagnostic/contract repair;
no Strategy Tester smoke, backtest, benchmark, optimization, or runtime
functional claim was made in this work.

## Runtime evidence boundary

The preserved Common Files artifact is:

```text
LimniPortfolioEA/ARCHIVE/Gate108/gate108_G108A_2025_01_01_00_00_00_R300234625_completion.csv
```

It proves:

```text
invalid_reason=transition_row_invariant_failure
transition_attempted_rows=0
transition_committed_rows=0
```

The companion run event order is `cohort_ready`, then the fatal invariant,
with the R cycle-start operation first in `ProcessDiscoveryCompletedM1Batch()`.
The rejected row was never serialized, so that historical artifact cannot
distinguish the ten inner preflight conditions. It is also an EA `1.037`
runtime with source bundle `03ba4004c81f`; it is not a runtime receipt for
`d477800` (`1.038`, `c46d482c8b6b`) or this repair (`1.039`).

Therefore the exact historical runtime subcondition is not recoverable from
the available receipt. The source-level static reconstruction of the freshly
initialized R cycle-start row has no false condition; a guessed economic or
state repair would be unjustified and could weaken the invariant.

## Ordered validation contract

`AppendTransition()` now checks, in its previous short-circuit order:

1. telemetry initialized, then telemetry valid;
2. row valid, then event time;
3. run/source/profile/config/formula identity;
4. symbol range, then zero sequence/event/reconciliation hashes;
5. ASCII fields in their existing order;
6. event shape;
7. cohort linkage;
8. transition state;
9. candidate identity;
10. opportunity identity.

Each failed check latches one canonical reason and returns immediately. The
old `transition_row_invariant_failure` preflight reason is no longer emitted
by this path.

For `LP_REVMA_TELEMETRY_CYCLE_START`, the event-shape helper decomposes the
existing checks through the exact cycle-start return, including numeric
finiteness, budget derivation, non-grid fields, zero inventory, terminal hash
absence, `OPEN` decision, and non-empty reason. The state helper decomposes
the cycle-start branch through source ordering, logical event ordering, cycle
identity, prior-cycle closure, U/C linkage where relevant, and causal state.

The cycle-start row is seeded by `SeedTransitionRow()`, which resets candidate
and opportunity identity to zero. `aggregate_branch_event` is explicitly false
for cycle-start, so cohort linkage is non-applicable. Candidate and opportunity
identity calculations remain guarded for nonzero fields; for a valid seeded
cycle-start row both checks are vacuous, while malformed nonzero identities
remain fail-closed.

## Static root-cause result

For the first R cycle-start after reset:

- telemetry state is initialized and valid;
- `SeedTransitionRow()` supplies valid row state and all run/profile/hash
  identity fields from the same telemetry object;
- `EmitDiscoveryCycleStart()` supplies branch R, cycle/account `1`, a positive
  minute-aligned source time, event time at or after that source, `symbol_id=-1`,
  `OPEN`, and a non-empty reason;
- the real portfolio supplies the same positive equity and budget values used
  by `LP_RevmaDiscoveryCapitalBudgetMinor()`;
- sequence and event/reconciliation hashes are zero before materialization;
- the reset numeric fields are finite and zero-safe;
- reset transition state has no prior source, logical event, terminal boundary,
  sealed branch, open grid, or pending causal state.

Thus the statically proven root cause of the observed failure surface is loss
of first-failure provenance in the compound preflight. The underlying runtime
row/state mismatch that caused the historical `transition_row_invariant_failure`
is not present in the persisted evidence and is intentionally not guessed.
The smallest safe correction is the ordered decomposition that preserves the
original invariant set and makes the next runtime-owned receipt actionable.

## Preservation proof

- Revma signal and Q code were not changed.
- Birth/add/close economics, R/U/C policies, budget, atom sizing, the R
  two-atom limit, cohort identity, telemetry hash materialization/chaining,
  risk, routing, and formula-boundary audit were not changed.
- State is still applied only after row validation, hash construction, guard
  checks, and buffer/resource checks succeed.
- The non-cycle `ValidateTransitionState()` acceptance path is unchanged.
- The cycle-start helper is limited to conditions that can affect a
  cycle-start row; downstream candidate/grid branches are non-applicable after
  the existing cycle-start shape contract has passed.

## Compile and identity evidence

```text
artifact=canonical-compile-20260712-cycle-start-invariant
terminal=94497
ea_version=1.039
compile_result=Result: 0 errors, 0 warnings, 55216 ms elapsed
compiler_process_exit_code=1 (MetaEditor wrapper; result line is clean)
source_bundle=sha256:86bb1b6a48f3d55ea340fcb3e790431f97882f19582e6383c6fa486c22ac98e8
source_count=54
repo_ex5_sha256=4CAB024119BFA48CFBF2EB7E4EC5B843C1B3B4FDFD5B0A38B8FF6B72EF59111C
terminal_ex5_sha256=4CAB024119BFA48CFBF2EB7E4EC5B843C1B3B4FDFD5B0A38B8FF6B72EF59111C
repo_terminal_ex5_byte_identical=true
strategy_tester_run=false
backtest_run=false
optimization_run=false
benchmark_run=false
```

Functional FX28 acceptance remains a Freedom-owned runtime gate. No claim that
this commit alone repairs the underlying runtime mismatch is made until the
next permitted runtime evidence identifies the canonical subreason.

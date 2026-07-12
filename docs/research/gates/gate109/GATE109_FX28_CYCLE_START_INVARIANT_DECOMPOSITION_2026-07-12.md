# Gate 109 FX28 Cycle-Start Invariant Decomposition — 2026-07-12

## Status

The `AppendTransition()` cycle-start preflight is ordered and fail-closed.
The v1.039 runtime receipt identified the first violated subcondition. v1.040
repairs the row-reset state that caused it and is compile-verified. No
Strategy Tester smoke, backtest, benchmark, optimization, or runtime
functional rerun was performed by Codex.

## Fresh runtime evidence — v1.039

The newly produced Common Files artifact is:

```text
LimniPortfolioEA/LPEA_2025_01_01_00_00_00_R308208000/
```

Its identity is `Limni Portfolio EA v1.039 [86bb1b6a48f3]`, and its first
blocker is:

```text
discovery_cycle_start_R_failed:transition_cycle_start_event_shape_grid_terminal_reason_present
```

The corresponding `events.csv` records `cohort_ready` followed by the fatal
invariant, and `completion.csv` records `total_signals=0`, `births=0`,
`adds=0`, `closes=0`, `route_attempts=0`, and `broker_mutations=0`. The Gate108
telemetry completion receipt records the same canonical reason while its
transition and summary files remain header-only. This is a pre-trade telemetry
abort, not an economic rejection or broker-routing result.

## Runtime evidence boundary

The earlier preserved Common Files artifact is:

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
`d477800` (`1.038`, `c46d482c8b6b`) or this repair (`1.040`).

Therefore the exact subcondition for that historical v1.037 receipt is not
recoverable from the rejected-row artifact. The fresh v1.039 receipt now names
the first failed predicate and allows a bounded state-level repair.

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

For the fresh v1.039 R cycle-start:

- preflight conditions 1–5 passed, because the ordered path reached condition
  6;
- condition 6, `LP_RevmaTelemetryEventShapeValid(row)`, failed its exact
  cycle-start subcondition `row.grid_terminal_reason != ""`;
- the canonical reason was
  `transition_cycle_start_event_shape_grid_terminal_reason_present`;
- cohort linkage, candidate identity, and opportunity identity were
  non-applicable for this row: `aggregate_branch_event` is false for
  `LP_REVMA_TELEMETRY_CYCLE_START`, and the seeded candidate/opportunity IDs
  are zero;
- no transition state or economic admission was reached, which is consistent
  with the zero-trade receipt.

The static call path proves the state mismatch. `SeedTransitionRow()` calls
`LP_ResetRevmaDiscoveryTransitionRow()`. That reset calls `ZeroMemory(row)` and
explicitly clears `decision` and `reason`, but did not explicitly clear the
`grid_terminal_reason` string. The cycle-start emitter does not assign that
field before `AppendTransition()`. Runtime therefore observed a non-empty
terminal reason on a non-terminal cycle-start row, violating the existing
shape invariant.

The smallest repair is the single explicit reset assignment
`row.grid_terminal_reason = ""`. The invariant remains fail-closed and
unchanged; the row now satisfies the state contract it was intended to satisfy
after reset.

## Preservation proof

- Revma signal and Q code were not changed.
- Birth/add/close economics, R/U/C policies, budget, atom sizing, the R
  two-atom limit, cohort identity, telemetry hash materialization/chaining,
  risk, routing, and formula-boundary audit were not changed.
- State is still applied only after row validation, hash construction, guard
  checks, and buffer/resource checks succeed.
- The non-cycle `ValidateTransitionState()` acceptance path is unchanged.
- The cycle-start event-shape invariant is unchanged; only the reset now
  deterministically clears its terminal-reason field.
- The cycle-start helper is limited to conditions that can affect a
  cycle-start row; downstream candidate/grid branches are non-applicable after
  the existing cycle-start shape contract has passed.

## Compile and identity evidence

```text
artifact=canonical-compile-20260712-cycle-start-reset-repair-rerun
terminal=94497
ea_version=1.040
compile_result=Result: 0 errors, 0 warnings, 308537 ms elapsed
compiler_process_exit_code=1 (MetaEditor wrapper; result line is clean)
source_bundle=sha256:fcf7755692871e7df3972a268a501685a5f75314652944fde2a367b76cd8d51e
source_count=54
version_contract_precompile=PASS
version_contract_postcompile=PASS
repo_ex5_sha256=92C5D28B2755797B6C6C4AA96B06BF6220C8DB09CC39BD4CEA45D86D43C77F9C
terminal_ex5_sha256=92C5D28B2755797B6C6C4AA96B06BF6220C8DB09CC39BD4CEA45D86D43C77F9C
repo_terminal_ex5_byte_identical=true
strategy_tester_run=false
backtest_run=false
optimization_run=false
benchmark_run=false
```

The preceding bounded compile invocation in
`canonical-compile-20260712-cycle-start-reset-repair` reached the same clean
`code generated` result but its five-minute caller timeout expired before the
wrapper receipt was written. The `-rerun` artifact above is the authoritative
complete receipt.

Functional FX28 acceptance remains a Freedom-owned runtime gate. Codex did not
run the v1.040 tester; the next runtime receipt must confirm that cycle-start
telemetry passes and discovery reaches the normal signal/admission path.

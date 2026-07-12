# Gate109 FX28 Discovery-Start Repair — 2026-07-12

## Status

Bounded reason-propagation repair and Revma formula-boundary audit. The repair
does not change Revma economics, Q, center support, birth/add/close rules,
local harvest, account cleanup, lot sizing, or execution authority.

## Archived diagnosis

The failed Gate108 completion artifact was:

```text
LimniPortfolioEA/ARCHIVE/Gate108/gate108_G108A_2025_01_01_00_00_00_R300234625_completion.csv
```

Its final row recorded:

```text
complete=0
invalid_reason=transition_row_invariant_failure
transition_attempted_rows=0
transition_committed_rows=0
summary_rows=0
```

The associated mandatory Common Files run recorded:

```text
active_systems=Revma
universe_mode=FX28 Portfolio
initial_equity=1000.00
cohort_ready ... source_m1=2024.12.31 23:58:00 ... symbols=28
total_signals=0
births=0
adds=0
closes=0
route_attempts=0
broker_mutations=0
```

The transition and summary artifacts contained headers only. Cohort formation,
same-timestamp validation, and completed-M1 snapshot validation therefore
passed before the first transition append was attempted. No marking, candidate
construction, allocation, risk, routing, or fill stage was reached.

## Exact failed operand and invariant

The first failing operand was:

```text
R cycle-start telemetry -> SeedTransitionRow -> AppendTransition
```

The exact preserved inner reason is:

```text
transition_row_invariant_failure
```

This is the telemetry writer’s row/state invariant, not a no-candidate result
and not an economic rejection. The completion row’s zero attempted transition
count proves that the failure occurred before the writer incremented its
attempted-row counter. `CacheDiscoveryCohort()` does not append a transition;
its successful registration is therefore consistent with the artifact. The
explicit source order is Cache, R read, U read, C read, R cycle start, U cycle
start, C cycle start. With the telemetry reason and zero attempted rows, R is
the first failing transition operation.

The retained artifact does not serialize the rejected row’s field values, so
it cannot distinguish the internal `AppendTransition()` subpredicate beyond
the writer’s exact invariant reason. The source trace proves the invariant
boundary that must remain enforced: seeded identity fields, event shape,
branch/cycle sequencing, point-in-time ordering, causal state, and identity
hash checks. This repair preserves those checks and exposes the writer reason
at the stage and branch that failed on the next runtime-owned smoke.

## Root cause

The root cause of the Gate109 failure report was loss of first-failure
provenance at the sleeve boundary:

1. Seven operations were evaluated in one short-circuit expression.
2. `CacheDiscoveryCohort()` and `EmitDiscoveryCycleStart()` returned only
   `false`, even when the telemetry writer already held a precise reason.
3. `InvalidateDiscovery()` then latched
   `discovery_cycle_start_or_cohort_cache_failed` as the sleeve reason.
4. `DiscoveryTelemetryInvalidReason()` returned that generic sleeve reason
   before the R/U/C or telemetry reason.

The telemetry invariant itself was not weakened or bypassed. The source-level
subpredicate remains a runtime-owned follow-up because the old rejected row
was never persisted.

## Repair

The seven-operation expression is now sequential and fail-closed in the
original order:

```text
discovery_cohort_cache_failed:<inner_reason>
discovery_R_portfolio_state_unavailable:<inner_reason>
discovery_U_portfolio_state_unavailable:<inner_reason>
discovery_C_portfolio_state_unavailable:<inner_reason>
discovery_cycle_start_R_failed:<inner_reason>
discovery_cycle_start_U_failed:<inner_reason>
discovery_cycle_start_C_failed:<inner_reason>
```

`CacheDiscoveryCohort()` returns the exact telemetry reason from
`RegisterCompletedM1CohortIdentity()`. `EmitDiscoveryCycleStart()` returns the
exact reason from `SeedTransitionRow()` or `AppendTransition()`. The telemetry
writer now also latches `transition_line_guard_failed` when its line guard
rejects a materialized transition without an existing reason.

`InvalidateDiscovery()` preserves the first non-empty sleeve reason. The
invalid-reason accessor still recognizes the old generic wrapper and falls
through to R/U/C/telemetry evidence, while repaired stage-specific reasons
remain the public first-failure value.

## Point-in-time and fail-closed preservation

- Cohort count, uniqueness, timestamp alignment, snapshot validation, and
  cohort identity registration are unchanged.
- R, U, and C portfolio reads remain mandatory and ordered.
- Cycle-start telemetry remains mandatory and ordered R then U then C.
- Transition row shape, identity hashes, timestamp monotonicity, branch-cycle
  rules, causal state, and writer hash chains remain unchanged.
- Any failed operation still invalidates discovery and stops research; the
  system does not continue as an ordinary no-candidate run.
- No backtest/tester execution was performed by Codex.

## Formula audit

The companion [Revma formula boundary audit](REVMA_FORMULA_BOUNDARY_AUDIT_2026-07-12.md)
classifies the current formula, runtime observations, broker constraints,
controlled profile, safety caps, and hidden assumptions. The primary findings
are:

- `$1,000` is correctly treated as observed account equity in the run, but the
  implementation still hardcodes USD and two currency digits in the Gate108
  valuation contract.
- Exact `0.01` atoms, `1/10` capital budget, `0.10q` mesh, FX28, Q Medium/
  50,000 bars, ten-point slippage, ten-minute intent expiry, and the two-atom R
  envelope are explicit Gate108 controls, not universal account-size claims.
- Broker contract values, account digits, costs, swap, margin, and current
  prices are runtime/environment inputs and are not all represented in the
  ordinary config hash or run manifest.
- The current discovery formula hash conflates economic formula, profile,
  source/build, telemetry, and execution-containment identities.
- A derived minimum-equity and broker-valid lot-sizing contract remains a
  separate normalization gate; no threshold or sizing rule was chosen here.

## Build identity

```text
ea_version=1.038
build_gate=Gate109Fx28DiscoveryStartRepair
build_scope=phase-fx28-discovery-start-reason-propagation-v1
source_bundle_algorithm=sha256-canonical-local-include-closure-v1
source_bundle_id=sha256:c46d482c8b6b1628f210928d451fd6576f63797969d4962a61634efe09bddd96
source_count=54
```

Canonical compile artifact:

```text
artifact_dir=docs/research/gates/gate109/artifacts/canonical-compile-20260712-discovery-start-repair
terminal=94497
compile_invocations=1
compile_result=Result: 0 errors, 0 warnings, 54465 ms elapsed, cpu='X64 Regular'
compiler_process_exit_code=1
compile_errors=0
compile_warnings=0
repo_ex5_sha256=7ED5C01D8696AB67DFBCBC125CBFC2608820A35D65192A5CDE38C6018B2E85D1
terminal_ex5_sha256=7ED5C01D8696AB67DFBCBC125CBFC2608820A35D65192A5CDE38C6018B2E85D1
repo_terminal_ex5_byte_identical=true
```

The MetaEditor process returned exit code `1` even though its compile log and
canonical result line are `0 errors, 0 warnings`; the canonical script accepted
the compiler from the result line and completed all post-compile identity
checks. No Strategy Tester, backtest, benchmark, or optimization was run.

The final handoff records the commit SHA, upstream equality, and clean-tree
state after the commit/push gate.

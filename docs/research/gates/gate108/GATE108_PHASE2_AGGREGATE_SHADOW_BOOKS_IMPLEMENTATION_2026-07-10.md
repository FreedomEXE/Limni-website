# Gate 108 Phase 2 - Aggregate U/C Shadow Books

Date: 2026-07-10

Status: **IMPLEMENTED FOR OUTSIDER SOURCE REVIEW. NOT GATE 108A OR RUNTIME
ACCEPTANCE.**

## Scope

Phase 2 adds the broker-free aggregate state and deterministic admission
machinery for the U and C discovery branches. It does not yet add signed-center
C authority, transition telemetry, R-envelope changes, or completed-M1 Engine
scheduling.

Owned source:

- `automation/mt5/Experts/Include/Strategies/Revma/RevmaShadowPortfolio.mqh`
- `automation/mt5/Experts/Include/Strategies/Revma/RevmaDiscoveryTypes.mqh`
- `automation/mt5/Experts/Include/Strategies/RevmaGridSleeve.mqh`

## Implemented invariants

- Fixed topology is `shadow_grid[2][28]` plus `shadow_portfolio[2]`.
- U and C own separate grids, portfolio ledgers, candidates, close authority,
  flat state, invalidation state, and batch hashes.
- The module has no TradeRouter, broker-order, position, history, receipt,
  file-writing, symbol-info, or account-info dependency.
- Each branch batch must call build-all, deterministic sort/allocation,
  commit, then end/reconcile.
- Sort order is smallest incremental reservation, canonical symbol ID, then
  deterministic candidate identity.
- Admission identity is branch/grid/source-M1/formula hashed.
- At most one candidate per symbol and identity can enter one branch batch.
- Birth/add lifecycle mismatch and repeated source-M1 admission invalidate the
  branch rather than silently skipping or reducing depth.
- Capacity rejection is recorded as a deterministic decision; arithmetic or
  resource failure invalidates the branch.
- Money state is signed integer account-currency minor units. Raw doubles do
  not decide capital capacity, cleanup, or hard-risk thresholds.
- Portfolio reservation must reconcile exactly to the sum of grid
  reservations after commits and closes.
- Branch equity is derived from `E_ref + H + R_nonharvest + L` with checked
  integer arithmetic.
- Cleanup authority uses `H > 0`, `L < 0`, and `H + L >= 0`.
- Hard-risk authority uses `H + L <= -B` and may escalate cleanup authority.
- Flat completion checks cleanup shortfall against the unchanged `E_ref`.

## Static isolation proof

The Phase 2 shadow module was searched for:

```text
TradeRouter CTrade OrderSend Position History Receipt FileWrite
SymbolInfo AccountInfo
```

Result: no matches.

## Repository compile

Artifact:
`docs/research/gates/gate108/artifacts/gate108-phase2-repo-compile-20260710/`

```text
Result: 0 errors, 0 warnings, 467050 ms elapsed, cpu='X64 Regular'
```

The Phase 1 final compile was `215878 ms`; Phase 2 is approximately 2.16 times
slower to compile. This is materially worse and is disclosed for review. It is
not Strategy Tester throughput or artifact-volume evidence. No terminal sync,
terminal compile, Strategy Tester, smoke/shard runner, benchmark, optimization,
or other MT5 runtime automation was executed.

## Review questions

1. Does the fixed U/C ownership boundary remain sufficiently isolated?
2. Is the two-pass allocation/commit state machine fail-closed enough before
   Engine integration?
3. Is the integer ledger ownership adequate for Phase 3 signed-center policy?
4. Does the compile-time increase require source-shape correction now, or may
   it remain a recorded non-runtime observation until later integration?

## Stop line

Stop for outsider review. Do not open Phase 3, mutate R, add telemetry, sync
terminals, or run MT5 runtime evidence from this packet.

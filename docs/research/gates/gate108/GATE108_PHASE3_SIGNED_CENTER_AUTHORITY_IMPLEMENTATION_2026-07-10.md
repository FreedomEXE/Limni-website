# Gate 108 Phase 3 - Signed-Center C Authority

Date: 2026-07-10

Status: **IMPLEMENTED FOR OUTSIDER SOURCE REVIEW. NOT GATE 108A OR RUNTIME
ACCEPTANCE.**

## Scope

Phase 3 adds the single frozen signed-center authority to C. It does not add
telemetry, mutate R, schedule Engine decisions, sync terminals, or execute MT5
runtime evidence.

Owned source:

- `automation/mt5/Experts/Include/Strategies/Revma/RevmaCenterSupportPolicy.mqh`
- `automation/mt5/Experts/Include/Strategies/Revma/RevmaShadowPortfolio.mqh`
- `automation/mt5/Experts/Include/Strategies/Revma/RevmaDiscoveryTypes.mqh`

## Authority contract

The policy freezes integer broker-tick support around structural birth price
`P0`:

```text
SupportSign = sign(direction * (center_ticks - P0_ticks))
```

Only a center-aligned C birth with `Support0Sign > 0` is applicable. Its first
observed transition from positive support to non-positive support permanently
latches future adverse C adds off.

The latch does not:

- close or resize existing inventory;
- block favorable adds;
- control a center-misaligned birth;
- affect U or R;
- trigger cleanup or hard risk;
- reclassify after a missing center observation.

## Counterfactual boundary

- U and C must be initialized through one matched initialization call.
- Both branch batches must be open and fully built before allocation.
- Pre-candidate economic-state hashes exclude branch label and center metadata.
- A non-zero matched opportunity ID is accepted only when the opposite branch
  has the same shared origin, symbol, source-M1, candidate type, and economic
  state hash.
- After divergence, later candidates may carry no matched opportunity ID and
  cannot be mislabeled one-atom causal matches.
- Center rejection changes only C policy metadata and the deterministic
  rejection decision. Inventory, PnL, reservation, capacity, and admission
  identity are unchanged.

## Fail-closed cases

The branch/run is invalidated for missing initialized C center state on an add,
invalid candidate type, unauthorized policy-rejection shape, false matched
opportunity, mismatched branch batch, invalid tick geometry, or lifecycle/state
disagreement.

A missing or non-finite center after a valid birth is not an invalidation. It
records `CENTER_NOT_AVAILABLE`, does not latch, and preserves the original
aligned/misaligned applicability classification.

## Static isolation

Searches found no TradeRouter, CTrade, OrderSend, position, history, receipt,
file-write, or account-info dependency in the center policy or shadow book.

## Compile and size tracking

```text
Phase 1: 215878 ms
Phase 2: 467050 ms; EX5 614004 bytes
Phase 3: 378418 ms; EX5 614142 bytes
```

Phase 3 compile time improved approximately 19% from Phase 2. EX5 increased by
`138` bytes. Phase 3 did not produce another comparable multiplication or
compile instability.

Repository compile receipt:

```text
Result: 0 errors, 0 warnings, 378418 ms elapsed, cpu='X64 Regular'
```

No terminal sync, terminal compile, Strategy Tester, smoke/shard runner,
benchmark, optimization, or other MT5 runtime automation was executed.

## Stop line

Stop for outsider review from a committed, pushed, clean tree. Do not open
Phase 4 buffered telemetry or mutate R until this source boundary is accepted.

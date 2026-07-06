# Gate 99U - Strategy-Ready Skeleton

Date: 2026-07-06

## Scope

Gate 99U completes the non-alpha execution skeleton required before the first
strategy lane is implemented.

No strategy entry logic was added. No alpha rule was added. Strategy evaluation
remains disabled by default. The change turns valid future strategy intents into
auditable trade plans, then keeps actual open and close execution behind
separate explicit kill switches.

## Changed Files

- `automation/mt5/Experts/Include/Core/BuildInfo.mqh`
- `automation/mt5/Experts/Include/Core/Config.mqh`
- `automation/mt5/Experts/Include/Core/Types.mqh`
- `automation/mt5/Experts/Include/Execution/TradeRouter.mqh`
- `automation/mt5/Experts/Include/Portfolio/RiskArbiter.mqh`
- `automation/mt5/Experts/Include/Receipts/RunManifest.mqh`
- `automation/mt5/Experts/Limni/LimniPortfolioEA.ex5`

## New Inputs

```text
EnableCloseExecution = false
EnableAccountCloseExecution = false
MaxClosePositionsPerStep = 10
```

`EnableCloseExecution` is required before any close-grid or reduce-grid request
can route to `CTrade`.

`EnableAccountCloseExecution` is an additional independent switch for
account-level managed-position close-all plans. It is not enough to enable close
execution generally.

`MaxClosePositionsPerStep` caps how many matching managed positions the router
may attempt to close in one engine step.

## Risk-To-Plan Contract

`RiskArbiter.mqh` now provides a strategy-agnostic approval path for future
intents after validation and existing portfolio guards pass.

Validation currently rejects:

```text
unknown intent actions
missing or non-tradable symbols, except account close-all
open intents without direction or lots
reduce intents without direction, lots, or grid key
close-grid intents without direction or grid key
expired intents
open intents while portfolio recovery is locked
open intents rejected by the currency exposure guard
```

Approved intents become `LP_TradePlan` records with:

```text
decision id
intent id
symbol id and symbol
lane and variant
action
direction
lots
slippage
Limni magic
Limni comment
executable flag
```

This is infrastructure only. The system still has no production strategy lane
emitting real intents.

## Close Execution Contract

`TradeRouter.mqh` now routes approved close/reduce plans through one execution
surface:

```text
LP_INTENT_REDUCE_GRID
LP_INTENT_CLOSE_GRID
LP_INTENT_CLOSE_ALL_EA
```

The router:

```text
requires EnableCloseExecution
requires EnableAccountCloseExecution for CLOSE_ALL_EA
honors the existing trading barriers
honors dry-run mode
matches only Limni-managed magic numbers
matches exact plan magic for grid close/reduce actions
caps attempts with MaxClosePositionsPerStep
sets plan magic and slippage on CTrade before close attempts
writes request/result receipts for disabled, blocked, scanned, and attempted closes
```

Open-order routing remains separately guarded by `EnableOpenOrderRouting=false`
and `MaxSingleOrderLots=1.0` from Gate 99T.

## Remaining Barriers

Real order execution still requires the full chain:

```text
EnableTrading=true
ExecutionMode allowing execution
AllowLiveTrading=true outside tester mode
terminal trade permission
EnableOpenOrderRouting=true for opens
EnableCloseExecution=true for close/reduce
EnableAccountCloseExecution=true for close-all
symbol lot min/max/step validation
max single order lots validation
max close positions per step validation
```

## Deliberately Not Implemented

```text
strategy alpha
trend lane entry logic
reversal lane entry logic
grid add policy
grid exit policy
harvest-governor liquidation policy
emergency liquidation policy
live-readiness claim
promotion claim
canonical backtest evidence
```

## Verification

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99u-strategy-ready-skeleton-2026-07-06/`

Compile logs:

- `repo-LimniPortfolioEA-compile-log.txt`
- `active-LimniPortfolioEA-compile-log.txt`

Compile summary:

- `compile-results.txt`

Source hash parity:

- `source-hashes.txt`

Both repo and active-terminal compiles report:

```text
Result: 0 errors, 0 warnings
```

Repo and active-terminal source hashes match for the EA source and changed
include files. MetaEditor returned process exit code `1` while writing clean
logs, matching the known local MT5 compile pattern in this repo.

## Review Notes

This gate is the skeleton review point before strategy implementation. The
review should focus on the contract boundaries:

```text
strategies emit intents only
risk validates and produces plans
execution owns CTrade only
open execution and close execution have independent switches
account close-all has an additional switch
currency exposure guard only gates additive/open exposure
portfolio recovery lock blocks new opens but does not block risk-approved exits
receipts prove every rejected, blocked, dry-run, scan, and send path
```

After external review, the next implementation gate should be the first
strategy lane only if its exact signal semantics have been approved.

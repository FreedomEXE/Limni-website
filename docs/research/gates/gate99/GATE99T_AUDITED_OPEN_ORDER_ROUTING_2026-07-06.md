# Gate 99T - Audited Open-Order Routing

Date: 2026-07-06

## Scope

Gate 99T makes the execution boundary real for future approved open-order
plans, while preserving the current zero-strategy state.

No strategy lane was implemented. No risk approval path was opened. The risk
arbiter still rejects intents after guard checks. No close-grid, reduce-grid,
winddown, close-all, or emergency liquidation execution was implemented.

## Changed Files

- `automation/mt5/Experts/Include/Core/BuildInfo.mqh`
- `automation/mt5/Experts/Include/Core/Config.mqh`
- `automation/mt5/Experts/Include/Core/Types.mqh`
- `automation/mt5/Experts/Include/Execution/TradeRouter.mqh`
- `automation/mt5/Experts/Include/Receipts/RunManifest.mqh`
- `automation/mt5/Experts/Limni/LimniPortfolioEA.ex5`

## Execution Barrier

New input:

```text
EnableOpenOrderRouting = false
```

This is a second explicit kill switch. Even if `EnableTrading=true` and
`ExecutionMode` is permissive, open-order routing remains disabled unless this
input is also enabled.

New input:

```text
MaxSingleOrderLots = 1.0
```

The router rejects any plan above this cap before attempting an order.

## Router Contract

`TradeRouter.mqh` now:

```text
keeps CTrade ownership isolated inside the execution layer
distinguishes open actions from close/reduce actions
refuses close/reduce actions with a receipt
normalizes lots against symbol min/max/step
enforces MaxSingleOrderLots
logs dry/blocked/open-routing-disabled requests
sets magic number and slippage before a send
routes future approved long plans through Buy()
routes future approved short plans through Sell()
receipts result retcode, order, deal, volume, and price
```

Current strategy state remains safe because there is still no approved strategy
lane and no executable trade plans are produced.

## Deliberately Not Implemented

```text
close-grid execution
reduce-grid execution
portfolio winddown execution
account close-all execution
emergency liquidation execution
strategy entry approval
live-readiness claim
```

Those require separate review because close execution is account-destructive if
implemented carelessly.

## Verification

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99t-audited-open-order-routing-2026-07-06/`

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

MetaEditor returned process exit code `1` while writing clean logs, matching the
known local MT5 compile pattern in this repo.

## Review Notes

The reviewer should check that open-order routing has enough independent
barriers:

```text
EnableTrading
ExecutionMode
AllowLiveTrading for non-tester live routing
terminal trade permission
EnableOpenOrderRouting
MaxSingleOrderLots
symbol min/max/step validation
```

The next infrastructure gate should not silently add close-all behavior. Close
execution needs its own contract, receipt surface, and kill switch.

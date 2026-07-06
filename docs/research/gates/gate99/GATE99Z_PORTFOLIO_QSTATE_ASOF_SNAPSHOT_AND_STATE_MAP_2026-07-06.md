# Gate 99Z - Portfolio QState As-Of Snapshot And Limni State Map

Date: 2026-07-06

## Scope

Gate 99Z responds to the Gate 99Y review blockers:

```text
1. EA q-state currency scoring could mix per-symbol source_m1_time values.
2. The visual indicator surface was fragmented and drift-prone.
```

This pass implements only:

```text
EA all-28 closed-M1 portfolio q-state snapshot
Limni State Map viewer without Katarakti display
repo and active-terminal compile/source proof
```

Katarakti visual review and signal redesign remain parked. No MT5 performance
backtest, live-readiness claim, promotion claim, live-trading switch, or
Katarakti redesign was made.

## EA Portfolio Q-State Snapshot Contract

`LimniPortfolioEA` no longer applies currency q-state over cached mixed-time
symbol snapshots.

The EA now attempts one portfolio q-state snapshot after a closed-M1 bar event:

```text
build all 28 pair features fresh from LimniQStateCore
require every pair to have the same closed-M1 source time
fail closed if any pair is missing, stale, invalid, or mismatched
apply currency scoring only after the all-28 snapshot is valid
run PortfolioIntentSelector only after that valid portfolio snapshot
```

New receipt coverage:

```text
portfolio_q_state
q_state.portfolio_asof_m1_time
q_state.portfolio_valid_pair_count
q_state.portfolio_snapshot_hash
signal.portfolio_asof_m1_time
signal.portfolio_snapshot_hash
engine_step.portfolio_qstate_asof
engine_step.portfolio_qstate_hash
```

`fail_closed` portfolio snapshots clear signal availability so stale accepted
signals cannot feed the selector.

## Limni State Map

New indicator:

```text
automation/mt5/Indicators/Limni/StateMap.mq5
```

Display name:

```text
Limni State Map
```

The viewer currently includes:

```text
Price Anchor from LimniLRMGStackCore
Trend State as an optional color-coded anchor overlay
Stochastic as a panel value
QState Direction from LimniQStateCore using all-28 same-as-of validation
```

The panel deliberately separates an executable direction from the q-state
reason:

```text
LONG / SHORT only when q-state is STRONG_LONG / STRONG_SHORT
NO TRADE when q-state is valid but weak, neutral, or stress/no-new-risk
FAIL CLOSED when all-28 data/as-of validation fails
```

This prevents valid `neutral_no_trade` / `weak_*_hold_only` states and
data-validation failures such as `mixed_source_m1_time` from looking identical.

Katarakti is deliberately excluded from `StateMap.mq5` in this gate.

The old standalone indicators were not archived in this pass because they are
still useful comparison targets until State Map visual parity is manually
confirmed.

## Changed Files

```text
automation/mt5/Experts/Include/Core/BuildInfo.mqh
automation/mt5/Experts/Include/Core/Engine.mqh
automation/mt5/Experts/Include/Core/Types.mqh
automation/mt5/Experts/Include/Receipts/ReceiptTypes.mqh
automation/mt5/Experts/Include/Signals/LrmgState.mqh
automation/mt5/Experts/Include/Signals/SignalSnapshot.mqh
automation/mt5/Experts/Limni/LimniPortfolioEA.ex5
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/StateMap.ex5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99z-portfolio-qstate-asof-snapshot-2026-07-06/
```

Compile logs:

```text
repo-LimniPortfolioEA-compile-log.txt
repo-StateMap-compile-log.txt
active-LimniPortfolioEA-compile-log.txt
active-StateMap-compile-log.txt
```

All four compile logs report:

```text
Result: 0 errors, 0 warnings
```

MetaEditor returned process exit code `1`, matching the known local clean-log
pattern for this repo lane.

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal source hashes match for the changed `.mq5/.mqh`
sources. Compiled `.ex5` hashes differ between terminal compilers and are not
used as source-parity proof.

## Required Manual Checks

Before any MT5 performance backtest claim:

```text
1. Attach Limni State Map to M1, M5, M15, and H1 for the same symbol.
2. Confirm the panel q-state keeps the same portfolio_asof_m1_time and decision
   across chart timeframes.
3. Run an EA tester smoke and compare q_state receipt fields against the State
   Map panel details for the same symbol/time.
4. Compare State Map Price Anchor / Trend / Stochastic against the old
   standalone indicators.
5. Only after that, decide whether old indicators should be archived or wrapped.
```

Katarakti remains excluded until the EA and State Map parity checks pass.

## Verdict

```text
PASS_GATE99Z_EA_PORTFOLIO_QSTATE_ASOF_SNAPSHOT_AND_STATE_MAP_COMPILES_NO_KATARAKTI_NO_BACKTEST_CLAIM
```

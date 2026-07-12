# Gate 99Y - QState Direction Invariance And EA/Indicator Parity

Date: 2026-07-06

## Scope

Gate 99Y fixes the pre-backtest q-state visual defect:

```text
QStateDirection must not change when the chart timeframe changes.
QStateDirection must not expose strategy formula knobs.
The EA and indicator must use one shared q-state formula core.
```

No live trading was enabled. No live-readiness claim, promotion claim,
canonical backtest claim, or `LimniBeta` mutation was made.

## Shared Formula Core

New shared core:

```text
automation/mt5/Indicators/Include/LimniQStateCore.mqh
```

Both surfaces now call this core:

```text
LimniPortfolioEA
QStateDirection.mq5
```

The core owns:

```text
formula_id
formula_hash
closed-M1 source loading
rolling z-score normalization
pair q-state feature scoring
currency score direction finalization
state / trade direction / reason_code mapping
```

## Frozen Formula Constants

Formula contract:

```text
formula_id = g99w-qstate-v001
source_timeframe = closed PERIOD_M1 only
QSTATE_V001_ROLLING_WINDOW_M1 = 1440
QSTATE_V001_MIN_HISTORY_M1 = 2880
QSTATE_V001_Z_CLIP = 3.0
QSTATE_V001_WEAK_THRESHOLD = 0.25
QSTATE_V001_STRONG_THRESHOLD = 1.00
QSTATE_V001_MAX_SPREAD_COST_Q = 0.25
```

The formula constants are not MT5 inputs.

## Formula Inputs

The shared core computes from:

```text
symbol
latest closed M1 time
closed M1 rate window
q
anchor
trend persistence
anchor displacement
event direction persistence
range position
sweep / reclaim state
spread_cost_q
rolling normalization window
```

The component values are rolling z-normalized and clipped before the pair score
is assembled. Spread cost is then applied in q units.

## Output Contract

Shared output fields:

```text
pair_q_score
base_currency_score
quote_currency_score
pair_direction_score
state
trade_direction
confidence
reason_code
formula_id
formula_hash
source_m1_time
```

State values:

```text
STRONG_LONG
WEAK_LONG
NEUTRAL
WEAK_SHORT
STRONG_SHORT
STRESS / NO_NEW_RISK
```

Trade direction is deliberately stricter than state:

```text
STRONG_LONG  -> LONG
STRONG_SHORT -> SHORT
all other states -> NONE
```

That keeps weak states as hold-only / no-new-risk states for this first lane.

## Indicator Contract

Updated viewer:

```text
automation/mt5/Indicators/Limni/QStateDirection.mq5
```

The indicator no longer exposes strategy formula inputs:

```text
BrokerSymbolSuffix
ScaleLookbackDays
WeakThreshold
StrongThreshold
MaxSpreadCostQ
```

Allowed inputs are visual-only:

```text
ShowLabels
ShowBackground
LabelFontSize
LabelRightPadding
LabelTopPadding
LongColor
ShortColor
NoTradeColor
StressColor
BackgroundColor
ShowDetails
ShowDebugComment
```

The chart timeframe can affect only when MT5 redraws the indicator. It no
longer affects q-state source data or formula semantics.

## EA Receipt Contract

`q_state` receipts now include:

```text
formula_id
formula_hash
source_m1_time
confidence
reason_code
```

Run manifest summaries also record the q-state formula id, hash, source
timeframe, rolling window, minimum history, and z-clip value.

## Q-State Execution Controls

The following remain MT5 inputs because they are execution/risk controls, not
formula controls:

```text
EnableQStateTrendVariant
QStateFixedLots
QStateGridSpacingQ
QStateGridCap
QStateIntentExpiryMinutes
QStateReentryNextDayAfterHarvest
```

Default execution barriers remain disabled:

```text
ExecutionMode = LP_EXECUTION_DISABLED
EnableTrading = false
AllowLiveTrading = false
EnableStrategyEvaluation = false
EnableOpenOrderRouting = false
EnableCloseExecution = false
EnableAccountCloseExecution = false
```

## Changed Files

```text
automation/mt5/Experts/Include/Core/BuildInfo.mqh
automation/mt5/Experts/Include/Core/Config.mqh
automation/mt5/Experts/Include/Core/Engine.mqh
automation/mt5/Experts/Include/Core/Types.mqh
automation/mt5/Experts/Include/Receipts/RunManifest.mqh
automation/mt5/Experts/Include/Signals/LrmgState.mqh
automation/mt5/Experts/Include/Signals/SignalSnapshot.mqh
automation/mt5/Experts/Include/Strategies/TrendFollowLane.mqh
automation/mt5/Indicators/Include/LimniQStateCore.mqh
automation/mt5/Indicators/Limni/QStateDirection.mq5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99y-qstate-direction-invariance-parity-2026-07-06/
```

Compile logs:

```text
repo-LimniPortfolioEA-compile-log.txt
repo-QStateDirection-compile-log.txt
active-LimniPortfolioEA-compile-log.txt
active-QStateDirection-compile-log.txt
```

All four compiles report:

```text
Result: 0 errors, 0 warnings
```

Compile summary:

```text
compile-results.txt
```

Source parity:

```text
source-hashes.txt
```

All installed repo and active-terminal Gate 99Y source hashes match.

## Required Manual MT5 Checks Before Backtest Trust

Gate 99Y compile/source proof shows the code contract is in place. It does not
replace MT5 chart review.

Before treating any MT5 backtest as meaningful:

```text
1. Attach QStateDirection to the same symbol on M1, M5, M15, and H1.
2. Confirm all four chart timeframes show the same decision for the same latest closed M1 time.
3. Enable ShowDetails and record formula_id, formula_hash, source_m1_time, pair_direction_score, state, confidence, and reason_code.
4. Run the EA tester smoke and compare the q_state receipt for that symbol/time against the indicator details.
```

## Verdict

```text
PASS_GATE99Y_QSTATE_DIRECTION_INVARIANCE_PARITY_COMPILES_NO_LIVE_CLAIM_NO_BACKTEST_CLAIM
```

## Review Freeze

After Gate 99Y, feature work is frozen until code review passes.

Allowed work while review is pending:

```text
compile verification
source-hash verification
documentation / handoff updates
push / branch hygiene
answering reviewer questions
```

Not allowed while review is pending:

```text
new strategy variants
new q-state semantics
new execution behavior
new Katarakti redesign
live-trading enablement
backtest-performance claims
promotion claims
```

## Next Action

Freedom should visually check QStateDirection invariance across M1/M5/M15/H1
and compare indicator details against the EA `q_state` receipt before running
or trusting the first strategy backtest.

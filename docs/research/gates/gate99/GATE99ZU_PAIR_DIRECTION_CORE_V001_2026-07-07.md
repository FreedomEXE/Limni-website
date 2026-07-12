# Gate 99ZU - Pair Direction Core v001

Date: 2026-07-07

## Scope

Shared chart-symbol pair-direction core plus StateMap display integration only.

Frozen areas:

```text
EA trading behavior
q-state formula semantics
strategy thresholds
Katarakti
backtests
live trading
portfolio/correlation/risk display in StateMap
all-28 q-state in StateMap
```

## Problem

Gate 99ZS made StateMap direction visible, but that label was still derived
from the current LRMG/David trend state. That made `DIRECTION` too close to the
centerline state and not suitable as the future EA-facing pair direction.

The important contract for this gate is not raw-score sophistication. The
important contract is that `confirmed_direction` is deterministic, stable, and
shared between the visual indicator and future EA code.

## Architecture Contract

New shared pure core:

```text
automation/mt5/Indicators/Include/LimniPairDirectionCore.mqh
```

The core:

```text
uses only closed-M1 chart-symbol LRMG stack arrays
does not use chart objects or panel state
does not read or write Common Files
does not depend on portfolio/all-28 state
does not call trade APIs
replays history from oldest to newest so reloads/timeframe switches reproduce the same result from the same source stack
```

StateMap includes this core and displays `confirmed_direction` as:

```text
DIRECTION: LONG
DIRECTION: SHORT
```

The existing LRMG/David centerline state remains separately labelled:

```text
TREND: UP / DOWN / NEUTRAL
```

## Formula Identity

```text
formula_id: g99zu-pair-direction-v001
formula_hash: 2125347990034264618
```

Formula hash payload:

```text
g99zu-pair-direction-v001|closed_m1_stack_only|forced_long_short_for_valid_data|confirm_events=5|min_flip_score=0.25|weights=trend_0_50,reversion_0_50|trend=state_0_65,momentum_0_35|reversion=anchor_0_70,stoch_0_30|decision_samples=trend_anchor_trigger_or_q_move
```

## Result Contract

`LimniPairDirectionResult` exposes:

```text
valid
formula_id
formula_hash
asof_m1_time
raw_direction
confirmed_direction
pending_direction
pending_count
raw_score
trend_score
reversion_score
confidence
q
q_pips
anchor
anchor_distance_q
stoch
trend_state
reason_code
```

StateMap only uses the simple dashboard fields by default. Internals are
available for receipts/debug/future EA parity.

## v001 Feature Components

Trend evidence:

```text
trend_state_score = sign of LRMG/David trend state
momentum_score = q-normalized price movement from the previous deterministic decision sample
trend_score = 0.65 * trend_state_score + 0.35 * momentum_score
```

Reversion evidence:

```text
anchor_distance_q = (price - anchor) / q
anchor_reversion = -clamp(anchor_distance_q / 2, -1, 1)
stoch_reversion = -clamp((stoch - 50) / 50, -1, 1)
reversion_score = 0.70 * anchor_reversion + 0.30 * stoch_reversion
```

Raw score:

```text
raw_score = 0.50 * trend_score + 0.50 * reversion_score
```

This lets direction differ from centerline location:

```text
above anchor can still confirm SHORT when reversion pressure wins
below anchor can still confirm LONG when reversion pressure wins
trend evidence can still keep above-anchor LONG or below-anchor SHORT
```

## Forced Direction

For valid samples:

```text
raw_score > 0 => raw_direction = LONG
raw_score < 0 => raw_direction = SHORT
raw_score == 0 => previous raw direction, else trend state, else anchor-distance sign
```

`NEUTRAL` is not a weak-signal state in this core. Neutral/waiting display means
invalid or unavailable data.

## Stability Rules

`confirmed_direction` is computed by replaying the stack from oldest valid
sample to latest valid sample.

Decision samples are deterministic closed-M1 stack samples selected when any of
these are true:

```text
first valid sample
latest valid sample
LRMG/David trend state changed
Katarakti/LRMG trigger is nonzero in the existing stack data
anchor line moved by at least 0.05q
price moved at least 1q from the prior decision sample
```

Latch constants:

```text
LIMNI_PAIR_DIRECTION_CONFIRM_EVENTS = 5
LIMNI_PAIR_DIRECTION_MIN_FLIP_SCORE = 0.25
```

Flip rule:

```text
raw direction can move often
confirmed direction flips only after 5 opposite decision samples
each opposite sample must meet abs(raw_score) >= 0.25
reload/timeframe switch replays the same stack and reproduces the same confirmed direction
```

## Dashboard Meaning

StateMap now means:

```text
DIRECTION = confirmed pair direction from LimniPairDirectionCore
TREND = existing LRMG/David centerline state
Q SIZE = latest q in pips
STOCHASTIC = latest LRMG stochastic value
ANCHOR = latest LRMG anchor/centerline value
DATA/BARS/q-days/AS-OF = visual stack diagnostics
```

## Changed Files

```text
automation/mt5/Indicators/Include/LimniPairDirectionCore.mqh
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/StateMap.ex5
```

`Stochastic.mq5` was not touched.

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zu-pair-direction-core-v001-2026-07-07/
```

Compile logs:

```text
repo-StateMap-compile-log.txt
active-StateMap-compile-log.txt
compile-results.txt
metaeditor-exit-codes.txt
```

Compile result lines:

```text
repo StateMap: Result: 0 errors, 0 warnings, 5713 msec elapsed, cpu='X64 Regular'
active StateMap: Result: 0 errors, 0 warnings, 5616 msec elapsed, cpu='X64 Regular'
```

MetaEditor returned exit code `1` for both compiles, matching the known local
clean-log pattern. The `Result: 0 errors, 0 warnings` lines are the proof
surface.

Static scan:

```text
static-scan-results.txt
```

Expected scan results include:

```text
StateMap includes_pair_direction_core=True
StateMap direction_uses_confirmed_core=True
PairDirection formula_id=g99zu-pair-direction-v001
PairDirection formula_hash=2125347990034264618
PairDirection confirm_events=5
PairDirection min_flip_score=0.25
PairDirection has_replay_function=True
PairDirection no_chart_objects=True
PairDirection no_common_files=True
PairDirection no_trade_calls=True
Stochastic source_untouched_by_gate99zu=True
```

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal hashes match for:

```text
StateMap.mq5
LimniPairDirectionCore.mqh
```

## Manual Acceptance

Codex did not perform a chart screenshot acceptance pass. Manual MT5 visual
acceptance should check `AUDCHF H1` and at least one other pair/timeframe:

```text
StateMap renders
Stochastic renders
DIRECTION shows LONG or SHORT, not VISUAL ONLY
DIRECTION is not simply a synonym for price above/below centerline
Q SIZE remains displayed in pips
BARS and q-days remain visible
TREND remains visible and separate from DIRECTION
Reloading or switching M1/M5/M15/H1 does not cause random direction flicker
Direction changes only when historical replay confirms a flip
```

## Future EA Contract

Future EA backtests must consume `LimniPairDirectionCore.mqh` directly and must
not duplicate the formula or latch logic in a separate EA-only implementation.

This gate deliberately does not wire the EA strategy or make any backtest,
performance, promotion, or live-trading claim.

## Known Limitations

The result is deterministic for the same closed-M1 stack input. If broker M1
history coverage, `VisualMaxM1Bars`, or available source history differs, the
replayed result can differ because the input history differs. Future EA parity
must lock the same source-history contract before comparing results.

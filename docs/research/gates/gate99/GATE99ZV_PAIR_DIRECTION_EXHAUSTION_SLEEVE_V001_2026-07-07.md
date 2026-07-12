# Gate 99ZV - Pair Direction Exhaustion Sleeve v001

Date: 2026-07-07

## Scope

Shared chart-symbol pair-direction core refinement plus StateMap version bump
only.

Frozen areas:

```text
EA trading behavior
q-state portfolio semantics
strategy thresholds outside the shared visual direction formula
Katarakti
backtests
live trading
portfolio/correlation/risk display in StateMap
all-28 q-state in StateMap
```

## Purpose

Gate 99ZU made `confirmed_direction` deterministic, stable, and shared. The
weak point was the raw formula: anchor distance and stochastic extremes could
push the reversion side immediately.

Gate 99ZV keeps the 99ZU replay and five-event latch, but changes the reversal
evidence into an exhaustion sleeve. An extreme does not mean reversal by itself.
Reversal pressure is only emitted after an active upper/lower extreme has at
least two failure signals.

## Formula Identity

```text
formula_id: g99zv-pair-direction-exhaustion-v001
formula_hash: 8337305153952970193
```

Formula hash payload:

```text
g99zv-pair-direction-exhaustion-v001|closed_m1_stack_only|forced_long_short_for_valid_data|confirm_events=5|min_flip_score=0.25|weights=trend_0_60,exhaustion_0_90|trend=state_0_65,momentum_0_35|exhaustion=extreme_plus_2_failures|extreme_stoch=95_5|reclaim_stoch=90_10|min_extreme_q=1_00|failed_extension_q=0_25|momentum_decay_q=0_25|decision_samples=trend_anchor_trigger_or_q_move
```

## Exhaustion Sleeve

The shared core now tracks a deterministic event-level extreme state during
oldest-to-newest replay:

```text
upper extreme: anchor_distance_q >= +1.0 and stochastic >= 95
lower extreme: anchor_distance_q <= -1.0 and stochastic <= 5
```

The extreme remains active until:

```text
price returns near anchor: abs(anchor_distance_q) <= 0.20
the opposite extreme starts
the active extreme ages past 55 decision events
```

Failure signals:

```text
failed_extension: price gives back at least 0.25q from the active max extension
stoch_reclaim: stochastic reclaims below 90 from upper, or above 10 from lower
event_momentum_decay: decision-event momentum decays by at least 0.25q or crosses zero
```

Exhaustion score stays `0` unless at least two failure signals are true.

Signed exhaustion:

```text
upper exhaustion => negative score
lower exhaustion => positive score
```

Trend evidence is unchanged:

```text
trend_score = 0.65 * trend_state_score + 0.35 * momentum_score
```

Raw score:

```text
raw_score = 0.60 * trend_score + 0.90 * exhaustion_score
```

The 99ZU latch is unchanged:

```text
confirmed_direction flips only after 5 opposite deterministic decision samples
each opposite sample must meet abs(raw_score) >= 0.25
```

## Result Contract Additions

`LimniPairDirectionResult` now also exposes:

```text
exhaustion_score
extreme_state
extreme_age_events
max_extension_q
failed_extension
stoch_reclaim
event_momentum_decay
setup_type
```

`reversion_score` remains populated as an alias of `exhaustion_score` for
backward-compatible debug consumers.

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
docs/research/gates/gate99/artifacts/gate99zv-pair-direction-exhaustion-sleeve-v001-2026-07-07/
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
repo StateMap: Result: 0 errors, 0 warnings, 6601 msec elapsed, cpu='X64 Regular'
active StateMap: Result: 0 errors, 0 warnings, 5493 msec elapsed, cpu='X64 Regular'
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
StateMap version_1_63=True
StateMap includes_pair_direction_core=True
StateMap direction_uses_confirmed_core=True
PairDirection formula_id=True
PairDirection formula_hash_expected=8337305153952970193
PairDirection confirm_events_5=True
PairDirection min_flip_score_0_25=True
PairDirection has_extreme_tracker=True
PairDirection exhaustion_requires_two_failures=True
PairDirection old_anchor_reversion_removed=True
PairDirection old_stoch_reversion_removed=True
PairDirection no_common_files=True
PairDirection no_trade_calls=True
PairDirection no_chart_objects=True
Stochastic source_untouched_by_gate99zv=True
```

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal source hashes match for:

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
DIRECTION remains stable across reload/timeframe switches for the same source stack
extreme stochastic/anchor alone does not imply a confirmed reversal
Q SIZE remains displayed in pips
BARS and q-days remain visible
TREND remains visible and separate from DIRECTION
AS-OF remains Toronto time
```

## Boundary

This gate does not wire the EA strategy, grid mechanics, Katarakti, q-state
portfolio semantics, backtests, promotion, or live trading.

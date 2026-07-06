# Gate 99Z - State Map Cleanup Review Ready

Date: 2026-07-06

## Scope

This follow-up cleans the visual stack after the initial Gate 99Z EA and
StateMap pass.

Implemented:

```text
StateMap panel polish
StateMap settings simplified to one default surface
PriceAnchor, TrendState, and QStateDirection archived
Stochastic kept active as the separate oscillator view
Katarakti left parked for later review
repo and active-terminal StateMap compile proof
```

Not implemented:

```text
q-state threshold changes
q-state persistence or hysteresis
Katarakti redesign
strategy variants
live trading
MT5 performance backtest claims
```

## Active Indicator Stack

Active visual files:

```text
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/Stochastic.mq5
```

Parked for later review:

```text
automation/mt5/Indicators/Limni/Katarakti.mq5
```

Archived standalone viewers:

```text
archive/automation/mt5/Indicators/Limni/PriceAnchor.mq5
archive/automation/mt5/Indicators/Limni/TrendState.mq5
archive/automation/mt5/Indicators/Limni/QStateDirection.mq5
```

The matching active-terminal copies were moved out of `MQL5/Indicators/Limni`
into:

```text
MQL5/Indicators/Archive/Limni/
```

`StateMap.mq5` now has no visual feature toggles. It always renders the shared
LRMG price anchor/state overlay, q-state decision, and stochastic summary panel.

## State Map Panel

The panel now uses fixed chart objects instead of a single multiline label:

```text
title: LIMNI STATE MAP
state: LONG / SHORT / NO TRADE / FAIL CLOSED
meta: score, confidence, closed-M1 as-of time
context: trend, stochastic, anchor
sync: reason, copied bars, q-day count
```

This is a presentation-only cleanup. `LimniQStateCore.mqh` still owns the frozen
q-state formula, formula ID/hash, closed-M1 loading, z-score normalization, and
state mapping.

## Open Architecture Question

Manual chart review showed StateMap can move into `NO TRADE` often. This was
not tuned in this cleanup because it affects first-strategy architecture:

```text
Can q-state be used as an entry gate only?
Does a live basket need state persistence / hysteresis before close or no-new-risk actions?
Should LONG/SHORT require one threshold while exit/no-new-risk uses a separate hold threshold?
Should a state change require N closed-M1 confirmations?
How should any persistence rule be receipted so EA and StateMap remain auditable?
```

This question is intentionally left for outside review before any strategy
implementation or backtest claim.

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99z-state-map-cleanup-2026-07-06/
```

Compile proof:

```text
repo-StateMap-compile-log.txt
active-StateMap-compile-log.txt
compile-results.txt
```

Both repo and active-terminal StateMap compiles report:

```text
Result: 0 errors, 0 warnings
```

Source/ex5 hashes:

```text
source-hashes.txt
```

Repo and active-terminal `StateMap.mq5` hashes match.

## Verdict

```text
PASS_GATE99Z_STATE_MAP_CLEANUP_REVIEW_READY_NO_QSTATE_SEMANTIC_CHANGE_NO_BACKTEST_CLAIM
```

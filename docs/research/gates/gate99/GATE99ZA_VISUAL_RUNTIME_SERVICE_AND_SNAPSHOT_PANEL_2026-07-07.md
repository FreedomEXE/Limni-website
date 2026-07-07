# Gate 99ZA - Visual Runtime Service And Snapshot Panel

Date: 2026-07-07

## Scope

Gate 99ZA responds to the repo-verification review that found the Gate 99Z
runtime patch still left full LRMG/q-state rebuilds inside visible indicators.

Implemented only:

```text
non-trading Limni visual runtime service
Common Files stack/q-state snapshot contract
StateMap snapshot reader
Stochastic snapshot reader
fixed 280x195 CPanel/CLabel StateMap panel
repo and active-terminal compile/source proof
```

Not implemented:

```text
EA behavior change
q-state threshold change
q-state persistence / hysteresis
Katarakti redesign
live-trading enablement
MT5 performance backtest
promotion or live-readiness claim
```

## Runtime Boundary

New service:

```text
automation/mt5/Services/Limni/LimniVisualRuntimeService.mq5
```

New shared snapshot contract:

```text
automation/mt5/Indicators/Include/LimniVisualRuntimeSnapshot.mqh
```

The service writes terminal Common Files snapshots under:

```text
LimniVisualRuntime/
```

Snapshot types:

```text
stack_<symbol>_s<scale>.csv
qstate_<symbol>.csv
```

`StateMap.mq5` and `Stochastic.mq5` now read these snapshots and project only
the chart window / changed-bar area. They no longer call:

```text
CopyRates
LimniLoadCachedStackSeries
LimniQStateBuildPairFeatures
```

`StateMap.mq5` also no longer builds all-28 portfolio q-state inside
`OnCalculate`; it reads the chart symbol q-state snapshot written by the
service.

Portfolio q-state snapshots are derived from the service stack snapshots using
the existing formula constants and state mapping. The formula ID/hash remain
owned by `LimniQStateCore.mqh`.

Important limitation: this gate centralizes the rebuild/snapshot boundary and
removes heavy work from visible indicators. It does not claim a fully
state-incremental LRMG core engine or any measured MT5 runtime improvement. If
the service itself becomes too heavy, the next gate should move exact
closed-M1 append state inside the service/core, not back into indicators.

## Panel Change

`StateMap.mq5` now uses direct standard controls only:

```text
CPanel
CLabel
```

`CAppDialog` was removed to avoid wrapper/chrome bleed.

The panel is fixed:

```text
width  280
height 195
bg     C'24,28,38'
```

Rows:

```text
M1 / SCORE
CONF / TREND
REASON / STOCH
ANCHOR / BARS
```

The panel hard-clips long reason text and updates labels only when the displayed
signature changes. No `ChartRedraw` path was added.

## Changed Files

```text
automation/mt5/Indicators/Include/LimniVisualRuntimeSnapshot.mqh
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/Stochastic.mq5
automation/mt5/Services/Limni/LimniVisualRuntimeService.mq5
```

Active terminal install paths:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Include\LimniVisualRuntimeSnapshot.mqh
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Limni\StateMap.mq5
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Limni\Stochastic.mq5
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Services\Limni\LimniVisualRuntimeService.mq5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99za-visual-runtime-service-2026-07-07/
```

Compile logs:

```text
repo-StateMap-compile-log.txt
active-StateMap-compile-log.txt
repo-Stochastic-compile-log.txt
active-Stochastic-compile-log.txt
repo-LimniVisualRuntimeService-compile-log.txt
active-LimniVisualRuntimeService-compile-log.txt
compile-results.txt
```

All six compile logs report:

```text
Result: 0 errors, 0 warnings
```

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal hashes match for:

```text
StateMap.mq5
Stochastic.mq5
LimniVisualRuntimeSnapshot.mqh
LimniVisualRuntimeService.mq5
```

Static scan of the active indicators found no remaining:

```text
CAppDialog
LimniLoadCachedStackSeries
LimniQStateBuildPairFeatures
CopyRates
ChartRedraw
```

## Required Manual Checks

Before any performance claim or strategy follow-up:

```text
1. Start LimniVisualRuntimeService in the active terminal.
2. Confirm Common Files/LimniVisualRuntime/ writes stack and qstate snapshots.
3. Attach StateMap and Stochastic to the same symbol and confirm they render
   from snapshots without fail-closed service-missing messages.
4. Visually inspect the fixed 280x195 StateMap panel for wrapper bleed,
   unreadable text, and overlapping stats on normal chart sizes.
5. Compare StateMap displayed q-state fields against service qstate snapshot
   fields for the same symbol/as-of.
```

## Verdict

```text
PASS_GATE99ZA_VISUAL_RUNTIME_SERVICE_SNAPSHOT_PANEL_COMPILES_NO_QSTATE_SEMANTIC_CHANGE_NO_BACKTEST_CLAIM
```

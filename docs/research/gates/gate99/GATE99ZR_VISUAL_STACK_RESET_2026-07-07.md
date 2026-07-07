# Gate 99ZR - Visual Stack Reset

Date: 2026-07-07

## Problem

Gate 99Z through Gate 99ZG3 overpatched the MT5 visual indicators. `StateMap`
and `Stochastic` had accumulated service snapshot reads/writes, Common Files
fallbacks, q-state status handling, and brittle recovery branches in the
critical render path. Manual MT5 checks still showed blank or stale visuals,
`BARS 0`, `q-days 0`, `ANCHOR n/a`, `STOCHASTIC n/a`, and unstable panel state.

Gate 99ZR resets the active visual path to a simple pair-state viewer contract:

```text
closed M1 chart-symbol source only
direct shared LRMG stack builder
projection onto the current chart timeframe
no portfolio/all-28/q-state dependency
no Common Files/runtime-service dependency
```

## Visual Architecture Contract

`LimniLRMGStackCore.mqh` now owns the active visual stack loader:

```text
LimniLoadVisualStackSeries()
```

That helper:

```text
loads only the current chart symbol
uses closed M1 bars only
supports VisualMaxM1Bars
keeps 0 as all available closed M1 history
uses latest N closed M1 bars when VisualMaxM1Bars > 0
builds LRMG stack data through LimniBuildStackSeries()
returns exact failure reason strings
builds into temporary arrays so failed rebuilds do not erase the caller's last good source arrays
```

`Stochastic.mq5` now:

```text
includes LimniLRMGStackCore.mqh directly
uses LimniLoadVisualStackSeries()
projects source_stoch onto chart bars
draws the separate-window oscillator line
has VisualMaxM1Bars input
has no q-state, all-28, Common Files, service snapshot, or panel dependency
```

`StateMap.mq5` now:

```text
includes LimniLRMGStackCore.mqh directly
uses LimniLoadVisualStackSeries()
projects the anchor/state line onto chart bars
renders a fixed right-side panel
shows pair visual status, as-of, q value, q-days, trend, stochastic, anchor, and bars
uses PAIR SIGNAL = VISUAL ONLY because no clean pair-only alpha formula was opened in this gate
has VisualMaxM1Bars input
has no q-state, all-28, Common Files, service snapshot, or drag-state dependency
```

## Removed Or Parked Active Paths

Removed from active `StateMap` / `Stochastic` rendering:

```text
LimniVisualRuntimeSnapshot.mqh include
LimniVisualBuildStackSnapshot calls
LimniVisualReadStackSnapshot calls
LimniVisualWriteStackSnapshot calls
q-state snapshot reads
q-state panel state
all-28 q-state fallback/build/write paths
StateMap drag-state handling
Common Files dependency for visual acceptance
runtime service dependency for visual acceptance
```

The runtime snapshot/service files are not deleted in this gate. They are simply
not part of the active `StateMap` / `Stochastic` render path.

## Changed Files

```text
automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/StateMap.ex5
automation/mt5/Indicators/Limni/Stochastic.mq5
automation/mt5/Indicators/Limni/Stochastic.ex5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zr-visual-stack-reset-2026-07-07/
```

Compile logs:

```text
repo-StateMap-compile-log.txt
repo-Stochastic-compile-log.txt
active-StateMap-compile-log.txt
active-Stochastic-compile-log.txt
compile-results.txt
metaeditor-exit-codes.txt
```

All four compile logs report:

```text
Result: 0 errors, 0 warnings
```

MetaEditor returned exit code `1` for each compile, matching the known local
clean-log pattern. The compile result lines are the proof surface.

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal source hashes match for:

```text
LimniLRMGStackCore.mqh
StateMap.mq5
Stochastic.mq5
```

Static scan:

```text
static-scan-results.txt
```

Expected scan results include:

```text
StateMap no_visual_runtime_include=True
Stochastic no_visual_runtime_include=True
StateMap no_LimniVisual_calls=True
Stochastic no_LimniVisual_calls=True
StateMap no_qstate_calls=True
Stochastic no_qstate_calls=True
StateMap has_VisualMaxM1Bars=True
Stochastic has_VisualMaxM1Bars=True
StateMap uses_direct_visual_loader=True
Stochastic uses_direct_visual_loader=True
EA files changed=False
Katarakti files changed=False
```

## No Claims

Not opened in this gate:

```text
EA trading behavior
q-state formula semantics
threshold tuning
q tuning
persistence or hysteresis
strategy logic
Katarakti redesign
LimniBeta product path
live trading
backtest/performance/promotion claim
```

## Manual MT5 Acceptance Stop Line

Compile success is not visual acceptance.

Manual check on `AUDCHF` or `NZDCAD`:

```text
Attach Limni/Stochastic and Limni/StateMap on M1.
Confirm Stochastic line visible.
Confirm StateMap center/anchor line visible.
Confirm StateMap state color visible.
Confirm StateMap panel fixed to the right.
Confirm BARS > 0.
Confirm q-days > 0.
Confirm ANCHOR is not n/a.
Confirm STOCHASTIC is not n/a.
Switch to M5, M15, and H1.
Confirm indicators may reproject but do not permanently blank.
Confirm underlying M1 source status remains populated.
Confirm panel remains pinned right.
Confirm anchor/stoch/trend remain populated.
```

Verdict:

```text
COMPILE_INSTALL_PASS_MANUAL_VISUAL_ACCEPTANCE_PENDING
```

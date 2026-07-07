# Gate 99ZC - State Map Draggable Grid Panel

Date: 2026-07-07

## Scope

Gate 99ZC repairs the StateMap panel architecture after Freedom rejected the
fixed-position panel as insufficient.

Implemented only:

```text
custom object-based StateMap panel
draggable header / title / state band
minimize / expand button
six separated data blocks
repo and active-terminal StateMap compile/source proof
```

Not implemented:

```text
q-state semantic change
threshold / persistence / hysteresis tuning
EA behavior change
Katarakti redesign
live-trading enablement
MT5 performance backtest or promotion claim
```

## Panel Architecture

`StateMap.mq5` no longer uses:

```text
CAppDialog
CPanel
CLabel
```

The panel is now drawn with chart objects:

```text
OBJ_RECTANGLE_LABEL
OBJ_LABEL
OBJ_BUTTON
```

Movement uses:

```text
CHARTEVENT_OBJECT_DRAG
```

Minimize/expand uses:

```text
CHARTEVENT_OBJECT_CLICK
```

No `ChartRedraw` path was added.

## Layout

Full panel:

```text
width  404
height 252
header 48
blocks 2 columns x 3 rows
```

Blocks:

```text
Q-STATE
SCORE / CONF
MOMENTUM
ANCHOR
STACK
REASON
```

Minimized panel:

```text
width  404
height 48
header only
```

The panel defaults to top-right. Dragging the header/title/state band stores a
session-local panel position and clamps it inside the chart window.

## Changed Files

```text
automation/mt5/Indicators/Limni/StateMap.mq5
```

Active terminal install path:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Limni\StateMap.mq5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zc-state-map-draggable-grid-panel-2026-07-07/
```

Compile logs:

```text
repo-StateMap-compile-log.txt
active-StateMap-compile-log.txt
compile-results.txt
```

Both compile logs report:

```text
Result: 0 errors, 0 warnings
```

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal source hashes match for `StateMap.mq5`.

Static scan:

```text
static-scan-results.txt
```

Expected scan results:

```text
CAppDialog=False
CPanel=False
CLabel=False
OBJ_BUTTON=True
CHARTEVENT_OBJECT_DRAG=True
CHARTEVENT_OBJECT_CLICK=True
ChartRedraw=False
```

## Manual Visual Check

Before external review:

```text
1. Attach only Limni/StateMap for the one-indicator review surface.
2. Confirm center line and embedded stochastic visual still render.
3. Confirm the panel shows separated blocks with readable text.
4. Drag the header/title/state band and confirm the whole panel relocates.
5. Click the header button and confirm minimize/expand works.
```

## Verdict

```text
COMPILE_INSTALL_PASS_MANUAL_DRAG_MINIMIZE_VISUAL_ACCEPTANCE_PENDING
```

# Gate 99ZD - State Map Panel And Stochastic Line Repair

Date: 2026-07-07

## Scope

Gate 99ZD repairs the visible defects Freedom identified in the Gate 99ZC
manual screenshot:

```text
stochastic strip rendered as bars instead of a stochastic line
panel text overlapped the header and adjacent fields
visible panel exposed implementation/debug labels such as VISUAL ONLY and local fallback
score/confidence displayed as misleading zero values while q-state was pending
```

Implemented only:

```text
larger readable StateMap grid panel
clean chart-facing field labels
stochastic oscillator line strip with 20/80 levels
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

## Panel Repair

The panel remains custom object-based and draggable/minimizable.

Full panel:

```text
width  460
height 370
header 68
blocks 2 columns x 4 rows
```

Visible blocks:

```text
SIGNAL
AS-OF
SCORE
CONFIDENCE
TREND
STOCHASTIC
ANCHOR
BARS
```

Visible mapping for pending q-state:

```text
VISUAL ONLY -> SYNCING
score/confidence -> n/a
status -> q-state pending
```

The visible panel no longer prints:

```text
local fallback
stale fallback
g_stack_source
raw qstate snapshot error text
```

Those remain internal diagnostics only.

## Stochastic Repair

The embedded stochastic object strip now renders:

```text
20 level
50 level
80 level
step-line oscillator path
point markers
latest value label
```

The previous histogram-style vertical bars were removed.
The strip is anchored bottom-left independently from the top-right panel so a
larger panel does not push the oscillator off-screen.

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
docs/research/gates/gate99/artifacts/gate99zd-state-map-panel-and-stochastic-line-repair-2026-07-07/
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
panel_prints_visual_only=False
panel_prints_local_fallback=False
panel_prints_g_stack_source=False
stochastic_histogram_Seg_prefix=False
stochastic_line_prefix=True
```

## Manual Visual Check

Before external review:

```text
1. Attach only Limni/StateMap.
2. Confirm center line renders.
3. Confirm stochastic appears as an oscillator line, not histogram bars.
4. Confirm panel text does not overlap header or adjacent fields.
5. Confirm visible panel language is clean: no VISUAL ONLY or local fallback.
6. Confirm drag and minimize/expand still work.
```

## Verdict

```text
COMPILE_INSTALL_PASS_MANUAL_VISUAL_ACCEPTANCE_PENDING
```

# Gate 99ZF - Indicator Scroll Buffer Stability

Date: 2026-07-07

## Scope

Gate 99ZF fixes the manual MT5 visual blocker where the standalone
`Stochastic` pane could blank out when scrolling back, changing chart range, or
triggering older-history loads. The same buffer-projection class was checked
and fixed for `StateMap`.

Implemented only:

```text
stable chart-buffer projection for Stochastic and StateMap
source-stack coverage guard for scroll-back history expansion
repo and active-terminal compile/source proof
```

Not implemented:

```text
q-state formula or threshold change
EA behavior change
Katarakti redesign
live-trading enablement
MT5 performance backtest or promotion claim
```

## Root Cause

The prior projection path used `LimniChangedBarLimit`, which is correct for
ordinary recent-bar updates but wrong when MT5 loads older bars after a scroll.
When older history is added, the new chart bars are at the old end of the
series, while the helper still projected only the newest bars. Any older area
that had just been loaded could remain `EMPTY_VALUE`, which made the
standalone stochastic appear to blank out and then come back.

A second related issue was source-stack coverage. The indicator cache accepted
a stack snapshot as current when its latest closed M1 matched, even if its
first source bar did not cover the older chart range now visible after a
scroll-back load.

## Code Changes

Shared helper:

```text
automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh
```

Added:

```text
LimniSourceSeriesCoversChart
LimniStableProjectionLimit
```

`LimniStableProjectionLimit` projects the full loaded chart when:

```text
first calculation
timeframe/history reset
older chart history is added
chart range moves backwards
```

It keeps incremental projection for normal recent-bar updates.

`Stochastic.mq5`:

```text
version 1.13
uses source coverage guard before accepting cached stack data
uses stable projection limit instead of direct LimniChangedBarLimit
keeps separate-window DRAW_LINE stochastic visual
```

`StateMap.mq5`:

```text
version 1.55
uses source coverage guard before accepting cached stack data
uses stable projection limit for center/state anchor buffers
still has no embedded stochastic visual or stochastic visual toggle
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zf-indicator-scroll-buffer-stability-2026-07-07/
```

Compile logs:

```text
repo-StateMap-compile-log.txt
active-StateMap-compile-log.txt
repo-Stochastic-compile-log.txt
active-Stochastic-compile-log.txt
compile-results.txt
```

All four compile logs report:

```text
Result: 0 errors, 0 warnings
```

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

Expected scan results:

```text
LimniLRMGStackCore source_coverage_guard=True
LimniLRMGStackCore stable_projection_limit=True
StateMap uses_source_coverage_guard=True
StateMap uses_stable_projection_limit=True
StateMap direct_changed_bar_limit=False
Stochastic separate_window=True
Stochastic draw_line=True
Stochastic uses_source_coverage_guard=True
Stochastic uses_stable_projection_limit=True
Stochastic direct_changed_bar_limit=False
```

## Manual MT5 Check

Before external review:

```text
1. Attach Limni/Stochastic on AUDCAD M15.
2. Scroll back far enough that MT5 loads older bars.
3. Confirm the stochastic line remains populated after the older range loads.
4. Switch M15 -> H1 -> M15 and confirm the stochastic line repopulates.
5. Attach Limni/StateMap and confirm the center/state anchor remains populated
   under the same scroll/timeframe checks.
```

## Verdict

```text
COMPILE_INSTALL_PASS_MANUAL_SCROLL_VISUAL_ACCEPTANCE_PENDING
```

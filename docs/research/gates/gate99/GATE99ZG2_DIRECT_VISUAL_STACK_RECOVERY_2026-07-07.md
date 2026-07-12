# Gate 99ZG2 - Direct Visual Stack Recovery

Date: 2026-07-07

## Scope

Gate 99ZG2 responds to the manual MT5 failure after Gate 99ZG:

```text
StateMap stayed in DATA CHECK with bars 0 / q-days 0 / anchor n/a / stochastic n/a.
The standalone Stochastic pane was blank.
The panel was not behaving like a fixed right-side review surface.
```

Implemented only:

```text
direct local chart-symbol stack first for StateMap and Stochastic
runtime/Common Files stack snapshots as fallback only
exact stack failure reason printed and surfaced in the StateMap panel status
q-state refresh remains after visual anchor/stochastic projection
right-side panel position forced back to the default fixed right offset
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

## Review Finding

Gate 99ZG fixed the projection limit, but the screenshot showed source data was
still failing before projection mattered. The panel showed `DATA CHECK`,
`syncing`, `BARS 0`, `q-days 0`, `ANCHOR n/a`, and `STOCHASTIC n/a`.

That means `StateMapEnsureStackCache()` and `EnsureStackCache()` were failing
before buffers received source stack data.

## Code Changes

`Stochastic.mq5`:

```text
version 1.15
uses LimniLoadCachedStackSeries first for direct local chart-symbol stack data
uses LimniVisualBuildStackSnapshot second as direct local rebuild
uses LimniVisualReadStackSnapshot last as optional fallback
prints exact combined failure reason on stack failure
keeps Gate 99ZG full re-projection behavior
```

`StateMap.mq5`:

```text
version 1.57
uses LimniLoadCachedStackSeries first for direct local chart-symbol stack data
uses LimniVisualBuildStackSnapshot second as direct local rebuild
uses LimniVisualReadStackSnapshot last as optional fallback
prints exact combined failure reason on stack failure
shows the failure reason in the panel status instead of generic data unavailable
keeps q-state/all-28 refresh after visual projection so q-state failure does not block anchor/stochastic rendering
forces the panel back to the default right-side fixed offset and disables drag persistence
keeps Gate 99ZG full re-projection behavior
```

## Changed Files

```text
automation/mt5/Indicators/Limni/Stochastic.mq5
automation/mt5/Indicators/Limni/Stochastic.ex5
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/StateMap.ex5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zg2-direct-visual-stack-recovery-2026-07-07/
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
clean-log pattern. The compile logs are the success criterion.

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal source hashes match for:

```text
LimniLRMGStackCore.mqh
LimniVisualRuntimeSnapshot.mqh
StateMap.mq5
Stochastic.mq5
```

Static scan:

```text
static-scan-results.txt
```

Expected scan results:

```text
Stochastic version_1_15=True
StateMap version_1_57=True
Stochastic direct_cached_before_snapshot_read=True
StateMap direct_cached_before_snapshot_read=True
Stochastic direct_build_before_snapshot_read=True
StateMap direct_build_before_snapshot_read=True
Stochastic failure_reason_printed=True
StateMap failure_reason_printed=True
StateMap failure_reason_displayed_in_panel=True
StateMap qstate_refresh_after_projection=True
StateMap panel_forces_default_position=True
StateMap header_not_selectable=True
StateMap drag_does_not_persist_position=True
EA files changed=False
Katarakti files changed=False
```

## Manual MT5 Acceptance

Compile success is not sufficient for this gate.

Required manual check:

```text
AUDCHF M1
StateMap shows bars > 0
StateMap shows q-days > 0
StateMap anchor value is not n/a
StateMap center/state line is visible
standalone Stochastic line is visible
StateMap panel is fixed at the right-side offset
if visual stack still fails, panel/log show the exact stack failure reason
```

## Verdict

```text
COMPILE_INSTALL_PASS_MANUAL_VISUAL_RUNTIME_ACCEPTANCE_PENDING
```

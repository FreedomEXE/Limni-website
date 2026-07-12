# Gate 99ZE - StateMap Q-State Fallback And Stochastic Separation

Date: 2026-07-07

## Scope

Gate 99ZE responds to two manual visual/runtime blockers:

```text
StateMap should not draw its own stochastic visual or expose a stochastic visual toggle.
StateMap stayed in SYNCING when the runtime q-state service snapshot was absent or stale.
```

Implemented only:

```text
remove embedded stochastic visual from StateMap
remove StateMap stochastic visual toggle
keep stochastic value in the StateMap panel
keep standalone Stochastic as the oscillator visual
add service-first / local all-28 q-state fallback to StateMap
persist fallback stack/q-state snapshots to Common Files
remove visible debug-state wording from the StateMap panel path
repo and active-terminal compile/source proof
```

Not implemented:

```text
q-state formula change
threshold / persistence / hysteresis tuning
EA behavior change
Katarakti redesign
live-trading enablement
MT5 performance backtest or promotion claim
```

## StateMap Changes

Removed from `StateMap.mq5`:

```text
ShowStochasticVisual
StochasticVisualBars
embedded StochVisual object strip
StateMapDrawStochasticVisual
```

`StateMap.mq5` still displays the latest stochastic value in the panel because
that value is part of the shared stack state. The actual oscillator visual is
owned by:

```text
automation/mt5/Indicators/Limni/Stochastic.mq5
```

## Q-State Fallback

`StateMap.mq5` now resolves q-state in this order:

```text
1. read current LimniVisualRuntimeService q-state snapshot
2. if missing/stale, derive all-28 q-state from stack snapshots
3. build/write any missing or stale stack snapshot before deriving q-state
4. require all 28 pair features to share the same source M1 time
5. write q-state snapshots for all 28 forced symbols to Common Files
```

This uses `LimniVisualQStateFeaturesFromStack` plus the existing
`LimniQStateFinalizeDirection` formula path. It does not change thresholds,
scoring components, labels, or trade-direction semantics.

The stack fallback path also writes a stack snapshot after local build. The
standalone `Stochastic.mq5` now does the same, so timeframe/settings changes
can reuse the snapshot instead of rebuilding from scratch when the service is
not running.

The StateMap no longer compiles the visible/debug panel strings that caused the
bad visual read in the previous screenshot:

```text
VISUAL ONLY
local fallback
stale fallback
```

## Changed Files

```text
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/Stochastic.mq5
```

Active terminal install paths:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Limni\StateMap.mq5
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Limni\Stochastic.mq5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99ze-statemap-qstate-fallback-stochastic-separation-2026-07-07/
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
StateMap.mq5
Stochastic.mq5
```

Static scan:

```text
static-scan-results.txt
```

Expected scan results:

```text
StateMap embedded_stochastic_input=False
StateMap embedded_stochastic_function=False
StateMap stochastic_visual_toggle_removed=True
StateMap local_qstate_fallback=True
StateMap snapshot_derived_qstate_features=True
StateMap raw_qstate_pair_builder_in_statemap=False
StateMap writes_all28_qstate_snapshots=True
StateMap writes_qstate_snapshot=True
StateMap visible_visual_only_string=False
StateMap visible_stack_source_string=False
StateMap raw_failure_reason_in_panel=False
Stochastic separate_window=True
Stochastic draw_line=True
Stochastic writes_stack_snapshot=True
```

## Manual Visual Check

Before external review:

```text
1. Attach Limni/StateMap and Limni/Stochastic.
2. Confirm StateMap has no embedded stochastic strip and no stochastic visual toggle.
3. Confirm StateMap panel still displays the stochastic value.
4. Confirm standalone Stochastic renders as the oscillator pane.
5. Confirm StateMap does not sit indefinitely in SYNCING; if q-state cannot be
   built, it should show DATA CHECK instead of a fake pending state.
6. Change timeframe or open settings and confirm the written stack/q-state
   snapshots reduce repeat rebuilds.
```

## Verdict

```text
COMPILE_INSTALL_PASS_MANUAL_VISUAL_RUNTIME_ACCEPTANCE_PENDING
```

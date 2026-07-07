# Gate 99ZG3 - StateMap Visual-First Decoupling

Date: 2026-07-07

## Scope

Gate 99ZG3 responds to the manual MT5 failure after Gate 99ZG2:

```text
Stochastic can eventually render from the chart-symbol stack.
StateMap still shows AS-OF syncing, ANCHOR n/a, STOCHASTIC n/a, BARS 0, q-days 0.
StateMap still performs q-state/all-28 fallback work before the final panel update.
```

Implemented only:

```text
remove StateMap local all-28 q-state snapshot build/write from OnCalculate path
make StateMap q-state read-only from existing snapshot files
allow missing or stale q-state snapshot to display as a nonblocking status
keep chart-symbol visual stack, panel values, and center/state line independent of q-state success
keep Stochastic unchanged from Gate 99ZG2
repo and active-terminal compile/source proof
```

Not implemented:

```text
q-state formula or threshold change
EA behavior change
Katarakti redesign
shared runtime lookback redesign
MT5 performance backtest or promotion claim
```

## Review Finding

Gate 99ZG2 made the chart-symbol stack path available, but StateMap still
called the local all-28 q-state fallback from `OnCalculate()`. That meant the
visual indicator could still spend the panel refresh cycle trying to build and
write portfolio q-state snapshots instead of acting as a reliable chart-symbol
viewer first.

The required separation for this gate is:

```text
StateMap visual data comes from the chart-symbol stack.
q-state may be read when a snapshot already exists.
missing/stale q-state does not build all-28 data and does not block visuals.
```

## Code Changes

`StateMap.mq5`:

```text
version 1.58
removed StateMapPortfolioQStateHash
removed StateMapBuildLocalQStateSnapshot
removed LimniVisualWriteQStateSnapshot calls from StateMap
removed LimniVisualQStateFeaturesFromStack calls from StateMap
StateMapRefreshQState now only reads an existing q-state snapshot
missing q-state snapshot sets NO TRADE / qstate_snapshot_missing without failing the visual stack
stale q-state snapshot sets NO TRADE / qstate_snapshot_stale without failing the visual stack
q-state attempt is marked once per latest closed M1 so missing snapshots do not loop expensive work
visual projection remains before the q-state read attempt
panel values still use latest chart-symbol anchor, trend, stochastic, bars, and q-days after q-state status is updated
```

`Stochastic.mq5`:

```text
unchanged from Gate 99ZG2
keeps version 1.15 and the direct chart-symbol stack path
```

## Changed Files

```text
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/StateMap.ex5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zg3-statemap-visual-first-decoupling-2026-07-07/
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
StateMap version_1_58=True
Stochastic version_1_15_unchanged=True
StateMap local_qstate_builder_removed=True
StateMap portfolio_qstate_hash_removed=True
StateMap qstate_write_removed=True
StateMap qstate_features_from_stack_removed=True
StateMap qstate_read_only=True
StateMap snapshot_missing_nonblocking_status=True
StateMap qstate_attempt_marked_once_per_closed_m1=True
StateMap qstate_refresh_after_projection=True
StateMap local_qstate_no_longer_blocks_panel=True
StateMap direct_cached_before_snapshot_read=True
Stochastic direct_cached_before_snapshot_read=True
EA files changed=False
Katarakti files changed=False
```

## Manual MT5 Acceptance

Compile success is not sufficient for this gate.

Required manual check:

```text
NZDCAD M15
standalone Stochastic line is visible immediately or within one normal calculation pass
StateMap BARS > 0
StateMap q-days > 0
StateMap ANCHOR is not n/a
StateMap STOCHASTIC is not n/a
StateMap center/state line is visible
q-state may say snapshot missing or stale without blocking visual data
```

## Verdict

```text
COMPILE_INSTALL_PASS_MANUAL_VISUAL_RUNTIME_ACCEPTANCE_PENDING
```

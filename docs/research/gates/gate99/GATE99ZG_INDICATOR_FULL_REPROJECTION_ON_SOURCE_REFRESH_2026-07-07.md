# Gate 99ZG - Indicator Full Reprojection On Source Refresh

Date: 2026-07-07

## Scope

Gate 99ZG responds to the post-push manual MT5 failure where both
`Limni/Stochastic` and `Limni/StateMap` stopped rendering after the Gate 99ZF
scroll-buffer patch.

Implemented only:

```text
force full chart-buffer projection when the source stack cache refreshes
clear plotted buffers before a full projection
return 0 on stack build/read failure so MT5 retries as an uncalculated pass
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

The outside review identified that `EnsureStackCache()` and
`StateMapEnsureStackCache()` could refresh the source arrays while the indicator
still computed a small incremental projection limit. Because
`LimniProjectDoubleToChartLimit()` only writes the most recent `limit` bars,
older or previously empty chart buffers could remain `EMPTY_VALUE`.

The review also identified that stack build/read failure returned `rates_total`,
which told MT5 the calculation had succeeded even when plotted buffers were not
populated.

## Code Changes

`Stochastic.mq5`:

```text
version 1.14
stack build/read failure returns 0
source refresh forces limit = rates_total
full projection clears StochBuffer before projection
```

`StateMap.mq5`:

```text
version 1.56
stack build/read failure renders the panel then returns 0
source refresh forces limit = rates_total
full projection clears PriceAnchorBuffer and StateAnchorBuffer
full projection resets StateColorBuffer to 2.0
```

The shared helper `LimniLRMGStackCore.mqh` was not changed in this gate.

## Changed Files

```text
automation/mt5/Indicators/Limni/Stochastic.mq5
automation/mt5/Indicators/Limni/Stochastic.ex5
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/StateMap.ex5
```

Active terminal install paths:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Limni\Stochastic.mq5
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Limni\StateMap.mq5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zg-indicator-full-reprojection-on-source-refresh-2026-07-07/
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
StateMap.mq5
Stochastic.mq5
```

Static scan:

```text
static-scan-results.txt
```

Expected scan results:

```text
Stochastic version_1_14=True
StateMap version_1_56=True
Stochastic stack_failure_returns_0=True
StateMap stack_failure_returns_0=True
Stochastic refresh_forces_full_projection=True
StateMap refresh_forces_full_projection=True
Stochastic full_projection_clears_buffer=True
StateMap full_projection_clears_price_anchor=True
StateMap full_projection_clears_state_anchor=True
StateMap full_projection_resets_state_color=True
Shared helper changed=False
```

## Manual MT5 Check

Compile success is not sufficient for this gate because Gate 99ZF compiled
cleanly and still failed visually.

Required manual acceptance:

```text
1. Restart or refresh MT5 indicators so the active-terminal compiled sources are used.
2. Attach Limni/Stochastic on AUDCAD M15.
3. Confirm the oscillator line renders immediately.
4. Scroll back far enough that MT5 loads older bars.
5. Confirm the stochastic line remains populated after the older range loads.
6. Switch M15 -> H1 -> M15 and confirm the stochastic line repopulates.
7. Attach Limni/StateMap and confirm the center/state anchor renders.
8. Repeat the scroll/timeframe checks for StateMap.
```

## Verdict

```text
COMPILE_INSTALL_PASS_MANUAL_VISUAL_RUNTIME_ACCEPTANCE_PENDING
```

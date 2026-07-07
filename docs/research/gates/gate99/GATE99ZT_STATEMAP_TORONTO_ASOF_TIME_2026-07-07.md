# Gate 99ZT - StateMap Toronto As-Of Time

Date: 2026-07-07

## Scope

Tiny StateMap visual-display follow-up only.

Frozen areas:

```text
EA trading behavior
q-state formula semantics
strategy thresholds
Katarakti
backtests
live trading
```

## Change

`StateMap.mq5` now renders the `AS-OF` panel value in Toronto time instead of
broker/server display time.

The source timestamp is unchanged: it is still the latest closed chart-symbol
M1 stack time. The display conversion is:

```text
broker/server timestamp -> UTC using current broker-vs-UTC offset
UTC -> America/Toronto using North American DST boundaries
panel label -> 12-hour lowercase time, for example 1:48 am
```

The `AS-OF` detail line now says `Toronto`.

## Changed Files

```text
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/StateMap.ex5
```

`Stochastic.mq5` was not touched in this gate.

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zt-statemap-toronto-asof-time-2026-07-07/
```

Compile logs:

```text
repo-StateMap-compile-log.txt
active-StateMap-compile-log.txt
compile-results.txt
metaeditor-exit-codes.txt
```

Compile result lines:

```text
repo StateMap: Result: 0 errors, 0 warnings, 5864 msec elapsed, cpu='X64 Regular'
active StateMap: Result: 0 errors, 0 warnings, 8882 msec elapsed, cpu='X64 Regular'
```

MetaEditor returned exit code `1` for both compiles, matching the known local
clean-log pattern. The `Result: 0 errors, 0 warnings` lines are the proof
surface.

Static scan:

```text
static-scan-results.txt
```

Expected active-source scan results:

```text
StateMap has_Toronto_ASOF_detail=True
StateMap has_Toronto_DST_helper=True
StateMap has_broker_to_utc_helper=True
StateMap has_12_hour_suffix=True
StateMap no_VISUAL_ONLY=True
StateMap no_PAIR_SIGNAL=True
StateMap no_LimniVisual=True
Stochastic source_untouched_by_gate99zt=True
```

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal `StateMap.mq5` hashes match after install.

## Manual Acceptance

Codex did not perform a chart screenshot acceptance pass. Manual MT5 visual
acceptance should confirm:

```text
AS-OF value is shown as Toronto time, for example 1:48 am
AS-OF detail line says Toronto
Direction, q pips, bars, q-days, anchor, stochastic, and fixed-right panel still render
Standalone Stochastic still renders
```

## Boundary

No EA files, q-state semantics, strategy thresholds, Katarakti files, backtests,
or live-trading behavior were changed in this gate.

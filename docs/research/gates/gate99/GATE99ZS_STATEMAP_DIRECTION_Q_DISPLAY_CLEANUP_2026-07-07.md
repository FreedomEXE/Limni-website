# Gate 99ZS - StateMap Direction And Q Display Cleanup

Date: 2026-07-07

## Scope

Small StateMap visual-display cleanup only.

Frozen areas:

```text
EA trading behavior
q-state formula semantics
strategy thresholds
Katarakti
backtests
live trading
```

## Display Contract

`StateMap.mq5` no longer presents `VISUAL ONLY` or `PAIR SIGNAL` in the
prominent display.

The panel now derives chart-symbol visual direction from the existing latest
LRMG state only:

```text
state > 0 => DIRECTION: LONG
state < 0 => DIRECTION: SHORT
state == 0 with valid visual data => DIRECTION: NEUTRAL
missing visual data => DIRECTION: WAITING
```

This is a visual chart-symbol direction label, not an EA trade instruction.

## Q Display

The panel now displays q in pips through a local FX pip-size helper:

```text
digits 5 or 3 => point * 10
digits 4 or 2 => point
fallback      => point * 10 when reasonable, otherwise point
```

Panel q is rendered as `Q SIZE` with `pips` units. `q-days` remains visible as
a lower-priority diagnostic.

## Panel Layout

The full panel blocks are now:

```text
DIRECTION
Q SIZE
TREND
STOCHASTIC
ANCHOR
DATA
BARS
AS-OF
```

`BARS` remains visible, and its detail line shows `q-days`.

## Changed Files

```text
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/StateMap.ex5
```

`Stochastic.mq5` was not touched in this gate.

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zs-statemap-direction-q-display-cleanup-2026-07-07/
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
repo StateMap: Result: 0 errors, 0 warnings, 4796 msec elapsed, cpu='X64 Regular'
active StateMap: Result: 0 errors, 0 warnings, 4516 msec elapsed, cpu='X64 Regular'
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
StateMap no_VISUAL_ONLY=True
StateMap no_PAIR_SIGNAL=True
StateMap no_LimniVisual=True
StateMap no_Common_Files_text=True
StateMap no_StateMapBuildLocalQState=True
StateMap no_q_state_text=True
StateMap has_DIRECTION_label=True
StateMap has_Q_SIZE_label=True
StateMap has_pip_helper=True
Stochastic source_untouched_by_gate99zs=True
Shared_stack_no_gate99zs_change=True
```

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal `StateMap.mq5` hashes match after install.

## Manual Acceptance

Codex did not perform a chart screenshot acceptance pass. Manual MT5 visual
acceptance is still required on `AUDCHF H1` and one additional pair/timeframe:

```text
No prominent VISUAL ONLY text
Direction visible at a glance
q displayed in pips
bars > 0 visible
q-days > 0 visible
anchor not n/a
stochastic not n/a
panel remains fixed right
Stochastic line still renders
```

## Boundary

No EA files, q-state semantics, strategy thresholds, Katarakti files, backtests,
or live-trading behavior were changed in this gate.

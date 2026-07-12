# Gate 99Q - Katarakti Event Classifier

Date: 2026-07-06

## Scope

Gate 99Q implements the approved Katarakti redesign as a feature-classification
gate only.

No strategy lane was implemented. No EA execution behavior was changed. No live
trading, order routing, account harvest, currency guard, or portfolio approval
logic was added.

## Changed Files

- `automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh`
- `automation/mt5/Indicators/Limni/Katarakti.mq5`

## Classifier Contract

The old signed-only Katarakti trigger is replaced internally by an explicit
event classifier while preserving a compatibility trigger output for existing
consumers.

Signal codes:

```text
 0 = no resolved Katarakti candidate
 1 = reversal buy
-1 = reversal sell
 2 = continuation buy
-2 = continuation sell
```

Event metadata now includes:

```text
sweep_side
resolution
trade_direction
anchor_relation
trend_relation
setup_age
boundary
q_distance
```

Detailed stack exports expose:

```text
source_trigger
source_trigger_sweep_side
source_trigger_resolution
source_trigger_anchor_relation
source_trigger_trend_relation
source_trigger_setup_age
source_trigger_q_distance
```

The existing simple stack loader remains available for `TrendState` and
`Stochastic`.

## Required Event Coverage

Gate 99Q includes all resolved Katarakti candidate classes:

```text
lower sweep + reclaim + upward displacement -> reversal buy
upper sweep + reclaim + downward displacement -> reversal sell
upper sweep continuation / failed reclaim -> continuation buy
lower sweep continuation / failed reclaim -> continuation sell
```

No event is filtered out because it is above/below PriceAnchor or with/against
TrendState. Those relationships are metadata for later research and strategy
arbitration.

## Visual Projection

`Katarakti.mq5` now has four visual buffers:

```text
Katarakti Reversal Buy
Katarakti Reversal Sell
Katarakti Continuation Buy
Katarakti Continuation Sell
```

Continuation arrows use separate colors and a larger offset from price so they
can be visually distinguished from reversal-reclaim arrows.

## Verification

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99q-katarakti-event-classifier-2026-07-06/`

Repo compile logs:

- `repo-PriceAnchor-compile-log.txt`
- `repo-Stochastic-compile-log.txt`
- `repo-TrendState-compile-log.txt`
- `repo-Katarakti-compile-log.txt`

Active-terminal compile logs:

- `active-PriceAnchor-compile-log.txt`
- `active-Stochastic-compile-log.txt`
- `active-TrendState-compile-log.txt`
- `active-Katarakti-compile-log.txt`

All logs report:

```text
Result: 0 errors, 0 warnings
```

MetaEditor returned process exit code `1` while writing clean logs, matching the
known local MT5 compile pattern in this repo.

Repo and active-terminal source hashes after install:

```text
LimniLRMGStackCore.mqh
70FAAE46B551FE0CDDC88204D536755A0F95B5A7C08BFAE4E62866B19F3E5E29

Katarakti.mq5
CDBAC267A3F84A11064A7C73826D26303A96AA64F403A4671246D27615426CAD
```

## Review Note

Tell the reviewer that continuation Katarakti signals are intentionally included
in Gate 99Q. The feature layer captures all resolved Katarakti candidates first;
strategy lanes and portfolio risk will decide later which classes are tradable.

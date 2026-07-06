# Gate 99E - LRMG Indicator Stabilization

Date: 2026-07-06

## Scope

This gate treats the current EAs as reference debt and stabilizes the new LRMG
indicator stack first.

No EA logic, final-EA entry logic, backtest result, live/app integration, or
promotion claim is changed here.

## Shared Formula Contract

The visual stack keeps the Gate 99C/99D contract:

- fixed `PERIOD_M1` source data
- completed broker/server calendar days
- `q_day` = LRMG movement radius of each completed day's M1 close path
- `q_effective` = median of prior valid `q_day` values over
  `ScaleLookbackDays`
- `ScaleLookbackDays=0` means all prior valid completed days
- chart timeframe is display-only, not formula input

## Indicator Definitions

### `LimniLRMGPriceLine`

Chart-window structural reference line.

It builds LRMG events from completed-day `q_effective` movement quanta and
draws the median of the last `55` closed LRMG event prices. This is the cyan /
green structural center reference for the stack. It is not by itself a
long-above / short-below rule.

### `LimniLRMGStoch`

Separate-window LRMG exhaustion oscillator.

It measures the current M1 close inside the recent LRMG event-price range:
`0` near the lower side of the last `55` LRMG events, `100` near the upper side.
The `20` / `80` levels are visual exhaustion context, not standalone entry
permission.

### `LimniLRMGMA`

Separate-window LRMG David State ribbon.

It no longer behaves like an ordinary moving average. It displays sticky LRMG
state:

- `+1`: confirmed above the LRMG reference line
- `-1`: confirmed below the LRMG reference line
- `0`: no confirmed state yet

Confirmation is event-based:

```text
z = (closed_lrmg_event_price - lrmg_price_line) / q
up state when z >= +1
down state when z <= -1
otherwise retain prior confirmed state
```

### `LimniLRMGTrigger`

Chart-window LRMG Katarakti Events markers.

It marks structural LRMG event sequences only:

- `LRMG KTR Up`: lower range sweep, reclaim, then upward displacement
- `LRMG KTR Down`: upper range sweep, reclaim, then downward displacement

The range is the prior `55` closed LRMG event prices. These are structural
events, not final EA buy/sell labels.

## Stabilization Finding

All four indicators were clearing their visible buffers at the start of every
`OnCalculate`. When MT5 delayed or failed an M1 history load during chart
scrolling, the indicators returned with empty buffers, causing flashes or blank
loads. Even when the stack eventually loaded, the user saw a full clear before
projection.

The stack also remains computationally heavy because each `.mq5` indicator is a
separate compiled instance. The shared include improves code reuse but does not
share one live in-memory cache across the four indicators.

## Patch

Changed files:

- `automation/mt5/Indicators/LimniLRMGPriceLine.mq5`
- `automation/mt5/Indicators/LimniLRMGStoch.mq5`
- `automation/mt5/Indicators/LimniLRMGMA.mq5`
- `automation/mt5/Indicators/LimniLRMGTrigger.mq5`
- `automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh`

The patch now:

- clears indicator buffers only on first calculation
- loads/builds the LRMG stack before replacing visible output
- projects into temporary buffers first
- copies temporary buffers into indicator buffers only after successful load
- preserves the prior visible indicator state when a later scroll/history load
  cannot resolve enough M1 data yet

No formula constants were changed.

## Compile Proof

Artifact folder:

`docs/research/gates/gate99/artifacts/gate99e-lrmg-indicator-stabilization-2026-07-06/`

Repo compile logs:

- `LimniLRMGPriceLine-repo-compile-log.txt`
- `LimniLRMGStoch-repo-compile-log.txt`
- `LimniLRMGMA-repo-compile-log.txt`
- `LimniLRMGTrigger-repo-compile-log.txt`

Active-terminal compile logs:

- `LimniLRMGPriceLine-active-terminal-compile-log.txt`
- `LimniLRMGStoch-active-terminal-compile-log.txt`
- `LimniLRMGMA-active-terminal-compile-log.txt`
- `LimniLRMGTrigger-active-terminal-compile-log.txt`

All eight logs report:

`Result: 0 errors, 0 warnings`

MetaEditor returned process exit code `1` while writing clean compile logs,
matching the known behavior from Gate 99D.

## Source Hash Parity

Repo and active-terminal sources match after install:

- `LimniLRMGPriceLine.mq5`:
  `AE6828AF980872F6FC7769111A2AEF7020ED028671296ABD020C896F91BBCF16`
- `LimniLRMGStoch.mq5`:
  `4165A69C64FFB9493837C329D7482EFBF45AA39CFF50E942D8E117B4CB361A78`
- `LimniLRMGMA.mq5`:
  `1F2D3721A01F6EC69B64F9E38F229D0DAE1304BED31EB80B8F29E317067E33DA`
- `LimniLRMGTrigger.mq5`:
  `DCD0CCD60139314AEACA8416007D58D2EFC8C42226EE2FEDFF9F7EEED2F68700`
- `LimniLRMGStackCore.mqh`:
  `B35C6090C4BB2F777E4A8234F155D1595A6778E1527BBB208BC407F5D5952A3B`

## Remaining Risk

This should reduce visible flashing and blank-load failures. It does not fully
solve compute cost if all four indicators are attached together over deep chart
history.

If MT5 is still too slow after this patch, the next stabilization gate should
consolidate the stack into one multi-buffer indicator or a generated custom
LRMG chart/cache source so PriceLine, Stoch, State, and Trigger are computed
once and rendered together.

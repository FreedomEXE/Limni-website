# Stop Loss Integration to Limni System

Date: 2026-03-03
Owner: Freedom / Codex research log

## Scope
Evaluate emergency stop-loss integration on Universal v1 over the last 6 completed weeks (week opens `2026-01-19` to `2026-02-23`) using the existing `v1-universal-tp1-friday-carry-aligned` simulator.

## What Was Added to the Backtest
- Dynamic week window via `BACKTEST_WEEKS` (default 6 in current runs).
- Stop mode toggle:
  - `STOP_MODE=none`
  - `STOP_MODE=adr`
- ADR stop parameters:
  - `ADR_LOOKBACK_DAYS` (used: 20)
  - `ADR_STOP_MULTIPLIER` (swept)
- Mode toggle for Universal execution construction:
  - `UNIVERSAL_MODE=non_net`
  - `UNIVERSAL_MODE=net`
- Weekly drawdown methodology upgrade:
  - Drawdown now computed per week against that week's starting equity, using intrawweek equity path (`week_drawdown_pct`).

## Completed Results (Carry Aligned)

### 1) Non-net ADR Sweep (carry aligned)
`UNIVERSAL_MODE=non_net`, `CARRY_MODE=aligned`

| Mode | Equity % | Max DD % | Stop Hits | Win Rate % | Profit Factor | Floating % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| no stop | 169.0747 | 4.7844 | 0 | 92.7835 | 10.1528 | -107.7903 |
| adr_0.5 | 59.0490 | 10.8440 | 349 | 41.4430 | 1.3640 | 0.0000 |
| adr_0.75 | 120.0001 | 6.1576 | 260 | 55.4795 | 1.7501 | -0.4792 |
| adr_1.0 | 168.1988 | 5.6064 | 189 | 65.7194 | 2.3939 | -17.9069 |
| adr_1.25 | 170.2670 | 5.4796 | 164 | 69.4394 | 2.3092 | -18.0711 |
| adr_1.5 | 167.5983 | 5.6100 | 138 | 72.5234 | 2.3065 | -21.0419 |
| adr_2.0 | **172.1973** | 5.1060 | 95 | 77.9798 | 2.5473 | -28.5778 |

Takeaway: `ADR x2` was the strongest combined result in this window.

### 2) Net vs Non-net (carry aligned)

| Run | Desired | Opened | Closed | Stop Hits | Max DD % | Equity % | Floating % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| non_net + no stop | 611 | 432 | 388 | 0 | 4.7844 | 169.0747 | -107.7903 |
| non_net + adr2 | 611 | 525 | 495 | 95 | 5.1060 | 172.1973 | -28.5778 |
| net + no stop | 281 | 238 | 223 | 0 | 5.0443 | 152.9828 | -22.5895 |
| net + adr2 | 281 | 246 | 234 | 17 | 5.2128 | 151.4338 | -7.4271 |

Net ADR2 stop-hit rate:
- `17` stops
- `7.26%` of closed trades (`6.91%` of opened)

### 3) Why `desired` and `opened` differ
Main reason is carry mechanics (not missing data):
- `desired` counts this week’s signals/legs.
- `opened` excludes positions already open from prior week carry.
- In carry mode, many desired legs are already active, so they do not reopen.

## No-Carry ADR2 Results (Sunday Open -> Friday Close)
Run config:
- `BACKTEST_WEEKS=6`
- `CARRY_MODE=none`
- `STOP_MODE=adr`
- `ADR_LOOKBACK_DAYS=20`
- `ADR_STOP_MULTIPLIER=2`

### 4) Carry vs No-Carry (ADR2)

| Run | Desired | Opened | Closed | Stop Hits | Friday Forced | Open End | Max DD % | Realized % | Floating % | Equity % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| non_net + carry + adr2 | 611 | 525 | 495 | 95 | 0 | 30 | 5.1060 | 200.7751 | -28.5778 | 172.1973 |
| non_net + no_carry + adr2 | 611 | 601 | 601 | 78 | 209 | 0 | 5.1135 | 180.1467 | 0.0000 | **180.1467** |
| net + carry + adr2 | 281 | 246 | 234 | 17 | 0 | 12 | 5.2128 | 158.8609 | -7.4271 | 151.4338 |
| net + no_carry + adr2 | 281 | 271 | 271 | 11 | 81 | 0 | 5.3948 | 154.3411 | 0.0000 | **154.3411** |

Key notes:
- No-carry naturally increases `opened` and `closed` because positions do not persist across weeks.
- In this 6-week sample, no-carry improved end equity for both net and non-net under ADR2.
- No-carry zeroes floating risk by design (`open_end=0`, `floating=0`).

### 5) Weekly Results — non_net + no_carry + ADR2

| Week | Desired | Opened | TP | ADR Stops | Friday Profit | Friday Forced | Open End | Week DD % | End Equity % | Delta Equity % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-01-19 | 99 | 89 | 53 | 25 | 8 | 11 | 0 | 0.0000 | 28.9266 | 28.9266 |
| 2026-01-26 | 98 | 98 | 56 | 27 | 7 | 15 | 0 | 0.0000 | 50.9311 | 22.0046 |
| 2026-02-02 | 102 | 102 | 57 | 8 | 15 | 37 | 0 | 1.8401 | 89.2349 | 38.3037 |
| 2026-02-09 | 109 | 109 | 64 | 12 | 16 | 33 | 0 | 0.0165 | 130.1332 | 40.8983 |
| 2026-02-16 | 109 | 109 | 50 | 2 | 24 | 57 | 0 | 5.1135 | 166.1425 | 36.0093 |
| 2026-02-23 | 94 | 94 | 34 | 4 | 28 | 56 | 0 | 0.0000 | 180.1467 | 14.0042 |

### 6) Weekly Results — net + no_carry + ADR2

| Week | Desired | Opened | TP | ADR Stops | Friday Profit | Friday Forced | Open End | Week DD % | End Equity % | Delta Equity % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-01-19 | 51 | 41 | 32 | 4 | 4 | 5 | 0 | 0.0000 | 31.1420 | 31.1420 |
| 2026-01-26 | 42 | 42 | 31 | 6 | 1 | 5 | 0 | 0.6102 | 53.5189 | 22.3768 |
| 2026-02-02 | 44 | 44 | 29 | 1 | 6 | 14 | 0 | 1.8090 | 77.6254 | 24.1065 |
| 2026-02-09 | 51 | 51 | 40 | 0 | 4 | 11 | 0 | 0.0175 | 110.1736 | 32.5482 |
| 2026-02-16 | 49 | 49 | 29 | 0 | 10 | 20 | 0 | 5.3948 | 137.0660 | 26.8924 |
| 2026-02-23 | 44 | 44 | 18 | 0 | 15 | 26 | 0 | 0.0000 | 154.3411 | 17.2751 |

## Current Working Recommendation
- Keep `ADR x2` as emergency stop candidate.
- For this sample window, no-carry + ADR2 is currently strongest in realized/equity terms:
  - non_net: `180.1467%`
  - net: `154.3411%`

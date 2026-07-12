# Gate 36 FX Basket Pressure Probe

Generated: 2026-06-16

## Scope

Freedom proposed a complete pivot from pair-direction prediction to treating the
28-pair FX universe as one synthetic pressure instrument.

First-pass question:

> If we open the full 28-pair basket in listed orientation, mirrored as
> all-long and all-short books, does the basket reliably create measurable
> pressure/extremes that could be harvested later?

This pass is price-only:

- all 28 repo FX pairs from `PAIRS_BY_ASSET_CLASS.fx`;
- displayed weeks `2019-01-01` through `2026-06-08`;
- equal listed-pair sizing: `0.01` standard lots per pair;
- reference account equity: `$1,000`;
- first target probe: either mirrored book reaches `+$100`;
- USD conversion from same-hour USD crosses inside the 28-pair universe;
- no spread, commission, swap, slippage, COT, ADR Grid, martingale, or grid
  unwind logic.

Important definition:

- `listed_long` means long every repo-listed pair: long `EURUSD`, long
  `USDJPY`, long `EURGBP`, etc.
- This is not automatically "risk-on" or "long FX"; it is listed-orientation
  basket exposure.

## Implementation

Research-only exporter:

`app/scripts/verification/export-fx-basket-pressure-probe.ts`

Command:

```powershell
npx tsx app/scripts/verification/export-fx-basket-pressure-probe.ts --from 2019-01-01 --to 2026-06-08 --lot-size 0.01 --account-equity-usd 1000 --profit-target-usd 100
```

Validation:

```powershell
npx tsc --noEmit --project app/tsconfig.json --pretty false
```

Receipt:

- `app/reports/data-verification/fx-basket-pressure-probe/fx-28pair-basket-pressure-probe-389w-20260616-022831.md`
- `app/reports/data-verification/fx-basket-pressure-probe/fx-28pair-basket-pressure-probe-389w-20260616-022831.json`
- `app/reports/data-verification/fx-basket-pressure-probe/fx-28pair-basket-pressure-probe-389w-20260616-022831.csv`

The first attempt accidentally used `listDataSectionWeeks()` and selected only
`116` weeks from `2024-01-09` through `2026-06-08`. That preview was not treated
as the final 2019-2026 test. The exporter was corrected to generate calendar
execution weeks from the requested date range.

## Result

| Metric | Result |
|---|---:|
| Calendar weeks selected | 389 |
| Complete 28-pair weeks | 378 |
| Missing/incomplete weeks | 11 |
| Weeks where either mirrored book hit `+$100` | 200 / 378 |
| Hit rate | 52.91% |
| Listed-long first hits | 107 |
| Listed-short first hits | 93 |
| Median weekly max absolute pressure | `$104.66` |
| P75 weekly max absolute pressure | `$153.47` |
| P90 weekly max absolute pressure | `$223.03` |
| P95 weekly max absolute pressure | `$279.48` |
| Max weekly absolute pressure | `$458.49` |

Incomplete weeks are `2025-10-06` through `2025-12-16`, where the canonical
hourly price bars were missing for all 28 FX pairs. This overlaps the known
late-2025 source-vacuum window, but this note treats it simply as a price
coverage gap for this probe.

## Year Summary

| Year | Weeks | Target Hits | Long First | Short First | No Target | Median Max Pressure | P90 Max Pressure | Max Pressure |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2019 | 53 | 30 | 14 | 16 | 23 | `$110.78` | `$223.03` | `$458.49` |
| 2020 | 52 | 34 | 20 | 14 | 18 | `$123.35` | `$248.81` | `$392.14` |
| 2021 | 52 | 19 | 10 | 9 | 33 | `$83.41` | `$137.75` | `$206.41` |
| 2022 | 52 | 37 | 22 | 15 | 15 | `$140.40` | `$279.48` | `$345.55` |
| 2023 | 52 | 28 | 14 | 14 | 24 | `$101.30` | `$205.01` | `$287.83` |
| 2024 | 53 | 29 | 13 | 16 | 24 | `$110.19` | `$198.59` | `$444.79` |
| 2025 | 52 | 16 | 9 | 7 | 36 | `$75.30` | `$157.53` | `$297.92` |
| 2026 | 23 | 7 | 5 | 2 | 16 | `$80.32` | `$148.30` | `$195.45` |

## Management Sanity Check

The old manual process closed the winning account near `+$100` and then had to
manage the losing side. To approximate that risk, I derived this from the
receipt:

- take every week where either mirrored book hit `+$100`;
- assume the winner is closed at `+$100`;
- hold the opposite losing book to Friday close;
- net result = `$100 + opposite_side_friday_close_pnl`.

Derived result over the `200` target-hit weeks:

| Metric | Result |
|---|---:|
| Net-positive weeks | 83 / 200 |
| Opposite side fully recovered to `>= $0` by Friday | 14 / 200 |
| Opposite side worsened after first target | 103 / 200 |
| Average net if winner closed and loser held | `-$12.21` |
| Median net | `-$11.38` |
| P25 net | `-$62.37` |
| P75 net | `+$38.94` |
| Worst net | `-$344.79` |
| Best net | `+$445.47` |

Worst examples:

| Week | First Target Side | Hours | Opposite At Target | Opposite Friday Close | Net |
|---|---|---:|---:|---:|---:|
| 2024-07-29 | listed_short | 45 | `-$109.13` | `-$444.79` | `-$344.79` |
| 2020-06-01 | listed_long | 34 | `-$117.51` | `-$392.14` | `-$292.14` |
| 2022-09-19 | listed_short | 68 | `-$101.59` | `-$345.55` | `-$245.55` |
| 2022-03-01 | listed_short | 36 | `-$100.28` | `-$329.13` | `-$229.13` |
| 2019-10-07 | listed_long | 88 | `-$116.42` | `-$320.71` | `-$220.71` |

Best examples:

| Week | First Target Side | Hours | Opposite At Target | Opposite Friday Close | Net |
|---|---|---:|---:|---:|---:|
| 2022-09-26 | listed_short | 1 | `-$261.91` | `+$345.47` | `+$445.47` |
| 2020-06-15 | listed_long | 24 | `-$114.53` | `+$155.95` | `+$255.95` |
| 2019-09-02 | listed_short | 32 | `-$121.18` | `+$119.58` | `+$219.58` |
| 2025-01-07 | listed_long | 33 | `-$103.91` | `+$117.50` | `+$217.50` |
| 2022-11-08 | listed_long | 17 | `-$103.91` | `+$90.72` | `+$190.72` |

## Interpretation

This is the first result in recent strategy research that supports Freedom's
structural premise.

The 28-pair listed-orientation basket is not inert. At `0.01` lots per pair on a
`$1,000` reference account, a `+$100` pressure event appears in `200/378`
complete weeks, and the median weekly max pressure is already around `$105`.
That means the full FX universe does produce measurable pressure large enough to
matter at the old sizing scale.

However, blind Sunday entry plus close-winner/hold-loser is not a standalone
edge. Once the first book hits `+$100`, the opposite book is typically around
`-$100` or worse. Holding that loser to Friday is negative on average, positive
only `83/200` times, and has severe tail weeks. This explains why the old demo
could withdraw profits for a while and still eventually blow up: the pressure
exists, but unmanaged loser inventory is the failure mode.

The useful clue is not "open both sides and harvest blindly." The useful clue is
that the 28-pair basket gives us a measurable pressure gauge. The next system
should use that pressure gauge to decide:

- when not to enter;
- which side is stretched;
- whether the stretched side historically reverts or continues;
- when to unwind inventory instead of martingaling it.

## Decision

- Promote nothing to live strategy logic.
- Keep Gate 36 research-only.
- Do not add ADR Grid yet.
- Do not add martingale yet.
- Do not add COT yet.

## Next Probe

The next clean test should use the generated pressure series to classify entry
timing:

1. Build rolling pressure z-score / percentile thresholds from prior bars only.
2. Test entries only when absolute basket pressure is already extreme.
3. For an extreme positive `listed_long` pressure, test whether continuation or
   reversion wins over the next `N` hours.
4. Repeat for extreme negative pressure.
5. Only after that, decide whether COT USD money-flow should classify the regime
   as risk-on/risk-off.

ADR Grid belongs after the pressure-entry behavior is known. If the basket
reliably oscillates after extremes, ADR Grid/unwind logic has merit. If extreme
pressure often trends further, the system needs continuation or delayed-entry
rules, not grid averaging.

## Continuation: Basket ADR Pressure Bands

Freedom corrected the research unit: the dollar target was useful only because
it recreated the old manual two-account behavior. The proper test is a
basket-wide ADR-normalized pressure index.

Definition:

```txt
pair_adr_move = pair_return_pct_from_week_entry / pair_weekly_ADR_pct
basket_adr_pressure = average(pair_adr_move across all 28 listed FX pairs)
```

Interpretation:

- `+1.00` means the listed-long 28-pair basket is stretched by one average ADR
  unit.
- `-1.00` means the listed-short mirror is stretched by one average ADR unit.
- Bands are measured on synchronized hourly closes, not intrabar highs/lows, so
  the first pass is conservative and avoids fake simultaneous basket extremes.

Research-only exporter:

`app/scripts/verification/export-fx-basket-adr-pressure-bands.ts`

Commands:

```powershell
npx tsx app/scripts/verification/export-fx-basket-adr-pressure-bands.ts --from 2022-01-01 --to 2022-12-31
npx tsx app/scripts/verification/export-fx-basket-adr-pressure-bands.ts --from 2026-01-01 --to 2026-06-08
npx tsx app/scripts/verification/export-fx-basket-adr-pressure-bands.ts --from 2019-01-01 --to 2026-06-08
```

Validation:

```powershell
npx tsc --noEmit --project app/tsconfig.json --pretty false
```

Receipts:

- `app/reports/data-verification/fx-basket-adr-pressure-bands/fx-28pair-basket-adr-pressure-bands-52w-20260616-030231.md`
- `app/reports/data-verification/fx-basket-adr-pressure-bands/fx-28pair-basket-adr-pressure-bands-23w-20260616-030230.md`
- `app/reports/data-verification/fx-basket-adr-pressure-bands/fx-28pair-basket-adr-pressure-bands-389w-20260616-030336.md`

### Full 2019-2026 Result

| Metric | Result |
|---|---:|
| Weeks selected | 389 |
| Complete strict-ADR weeks | 377 |
| Incomplete/default-ADR weeks | 12 |
| Median weekly max abs basket ADR pressure | `+0.51` |
| P75 weekly max abs basket ADR pressure | `+0.71` |
| P90 weekly max abs basket ADR pressure | `+0.99` |
| P95 weekly max abs basket ADR pressure | `+1.19` |
| Max weekly abs basket ADR pressure | `+2.26` |

Incomplete/default-ADR weeks are concentrated in the late-2025 price/ADR vacuum:
displayed weeks `2025-10-06` through `2025-12-23`.

Band behavior:

| Band | Touches | Touch Rate | Long/Short | Half Revert | Zero Revert | Next Continue | Zero Before Next | Next Before Zero | Median Touch Hours | Avg Close Side-Signed |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `0.50` | 193/377 | 51.19% | 101/92 | 60 | 18 | 86 | 18 | 85 | 65 | `+0.56` |
| `0.75` | 88/377 | 23.34% | 43/45 | 12 | 0 | 35 | 0 | 35 | 81 | `+0.83` |
| `1.00` | 35/377 | 9.28% | 17/18 | 4 | 0 | 17 | 0 | 17 | 89 | `+1.08` |
| `1.25` | 17/377 | 4.51% | 9/8 | 2 | 0 | 9 | 0 | 9 | 94 | `+1.31` |
| `1.50` | 9/377 | 2.39% | 4/5 | 0 | 0 | 3 | 0 | 3 | 87 | `+1.50` |

Year summary:

| Year | Complete Weeks | Median Max Abs | P75 Max Abs | P90 Max Abs | Max Abs | Touch >=0.75 | Touch >=1.00 | Touch >=1.50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2019 | 53 | `+0.53` | `+0.83` | `+1.05` | `+2.26` | 17 | 6 | 4 |
| 2020 | 52 | `+0.52` | `+0.69` | `+0.90` | `+2.02` | 12 | 4 | 1 |
| 2021 | 52 | `+0.47` | `+0.63` | `+0.92` | `+1.44` | 8 | 2 | 0 |
| 2022 | 52 | `+0.54` | `+0.82` | `+1.10` | `+1.26` | 18 | 7 | 0 |
| 2023 | 52 | `+0.48` | `+0.63` | `+0.88` | `+1.41` | 10 | 5 | 0 |
| 2024 | 53 | `+0.55` | `+0.74` | `+0.96` | `+1.81` | 13 | 5 | 2 |
| 2025 | 40 | `+0.40` | `+0.50` | `+0.86` | `+1.68` | 6 | 4 | 2 |
| 2026 | 23 | `+0.48` | `+0.60` | `+0.99` | `+1.15` | 4 | 2 | 0 |

### Gate 36b Interpretation

The ADR-normalized band surface works. A `0.50` basket ADR move is common enough
to act as a weekly state boundary, `0.75` is a real stretch zone, and `1.00+` is
a rarer regime-level stretch.

The first read does **not** support blindly fading a touched band to weekly mean.
Strict zero reversion before continuation is weak:

- At `0.50`, zero-before-next happened only `18/193` touches, while
  next-before-zero happened `85/193`.
- At `0.75`, `1.00`, `1.25`, and `1.50`, zero-before-next was `0`.
- Average close side-signed pressure stayed above the touched band at every
  threshold, meaning the basket often remained stretched or continued rather
  than snapping back to zero inside the same week.

This is important: the basket-wide ADR bands are real, but the entry cannot be
"touch band, fade immediately." The timing problem is still the whole problem.
The next logic should test whether entry improves after one of these conditions:

1. continuation exhausts and fails back through the touched band;
2. price reaches a higher band and then loses momentum;
3. a COT/USD flow regime says the stretch should be faded rather than followed;
4. the system trades continuation toward the next band instead of mean
   reversion.

No promotion. No ADR Grid yet. No martingale. No COT overlay yet.

## Continuation: Basket ADR Band-State Probe

Freedom added the correct management context: a future system may start neutral
with both mirrored books open, harvest one side, add to the losing side or
individual losers, close partial baskets, or only require the losing side to
return to breakeven. Before testing those management branches, Gate 36c tested
the smaller prerequisite: where does the basket band actually snap?

Question:

```txt
After first basket ADR band touch, does pressure continue to the next band,
or fail back through the touched band?

If it fails back through the touched band, does that failure then snap toward
half/zero before retouching the band?
```

Research-only exporter:

`app/scripts/verification/export-fx-basket-adr-band-state-probe.ts`

Commands:

```powershell
npx tsx app/scripts/verification/export-fx-basket-adr-band-state-probe.ts --from 2022-01-01 --to 2022-12-31
npx tsx app/scripts/verification/export-fx-basket-adr-band-state-probe.ts --from 2026-01-01 --to 2026-06-08
npx tsx app/scripts/verification/export-fx-basket-adr-band-state-probe.ts --from 2019-01-01 --to 2026-06-08
```

Receipt:

`app/reports/data-verification/fx-basket-adr-band-state/fx-28pair-basket-adr-band-state-389w-20260616-032042.md`

### Full 2019-2026 Band-State Result

| Band | Touches | Continue First | Fail First | No Decision | Fail Half Before Retouch | Fail Zero Before Retouch | Retouch Before Half | Median Fail Hours | Median Retouch Hours | Avg Failure Close |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `0.50` | 193/377 | 35 | 144 | 14 | 29 | 11 | 104 | 2 | 2 | `+0.50` |
| `0.75` | 88/377 | 18 | 61 | 9 | 3 | 0 | 51 | 2 | 2 | `+0.76` |
| `1.00` | 35/377 | 13 | 17 | 5 | 2 | 0 | 14 | 3 | 4 | `+0.83` |
| `1.25` | 17/377 | 7 | 8 | 2 | 2 | 0 | 3 | 4 | 2 | `+1.23` |
| `1.50` | 9/377 | 2 | 7 | 0 | 0 | 0 | 5 | 2 | 2 | `+1.49` |

Year-level check for the practical bands:

| Year | Complete Weeks | Touch 0.75 | Fail First 0.75 | Half Before Retouch 0.75 | Touch 1.00 | Fail First 1.00 | Half Before Retouch 1.00 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2019 | 53 | 17 | 12 | 0 | 6 | 2 | 0 |
| 2020 | 52 | 12 | 10 | 0 | 4 | 2 | 0 |
| 2021 | 52 | 8 | 4 | 0 | 2 | 2 | 1 |
| 2022 | 52 | 18 | 12 | 1 | 7 | 4 | 1 |
| 2023 | 52 | 10 | 6 | 2 | 5 | 2 | 0 |
| 2024 | 53 | 13 | 11 | 0 | 5 | 2 | 0 |
| 2025 | 40 | 6 | 4 | 0 | 4 | 2 | 0 |
| 2026 | 23 | 4 | 2 | 0 | 2 | 1 | 0 |

### Gate 36c Interpretation

This test says the first simple snap trigger is not enough.

The basket often does fail back through the touched band before reaching the
next band, but those failures are usually shallow:

- At `0.75`, failure-first happened `61` times, but only `3` reached half-band
  before retouch and `0` reached zero before retouch.
- At `1.00`, failure-first happened `17` times, but only `2` reached half-band
  before retouch and `0` reached zero before retouch.
- Median failure after touch was only `2-4` hours depending on band, and median
  retouch after failure was also around `2-4` hours. That means the basket often
  wobbles around the band rather than actually snapping.

The management implication is important. A system should not add to the losing
side or fade the winner just because pressure dips back below the touched band.
That is too early and too noisy.

The more promising next branch is a stronger confirmation condition, for
example:

1. fail below band, then stay below it for `N` hours;
2. fail below band, retest the band, then reject it;
3. reach a higher band first, then fail below that higher band;
4. require a slope/momentum break before treating the stretched side as
   exhausted.

The neutral-basket management idea is still alive, but the snap point is not
first touch and not first shallow failure. The next proof should identify a
stronger exhaustion confirmation before testing add/close/unwind rules.

## Continuation: One-Week Hedged ADR Grid Smoke Test

Freedom stopped the basket-band line and reframed the next merit question around
ADR Grid. The idea is to keep the 28-pair universe, but trade it as a hedged
ADR Grid basket instead of trying to predict a basket mean:

```txt
for every FX pair:
  run one LONG ADR Grid
  run one SHORT ADR Grid
```

This is not COT, Weekly Hold, or directional source research. It is pure
mechanical ADR Grid harvesting on a fully mirrored 28-pair FX basket.

Research-only exporter:

`app/scripts/verification/export-fx-hedged-adr-grid-week.ts`

Command:

```powershell
npx tsx app/scripts/verification/export-fx-hedged-adr-grid-week.ts --week 2026-06-08T23:00:00.000Z
```

Receipt:

`app/reports/data-verification/fx-hedged-adr-grid/fx-28pair-hedged-adr-grid-2026-06-08-20260616-033849.md`

Scope:

- displayed week `2026-06-08`;
- all 28 listed FX pairs;
- both LONG and SHORT grid per pair, 56 engines total;
- ADR Grid mechanics: `0.20 ADR` spacing/TP, `1.0 ADR` reset,
  reset-entry buffer on, confirmed 1H bars;
- no COT, no sentiment, no strength, no pair fill cap, no spread, no
  commission, no swap, no slippage, no margin rules.

### Last-Week Result

| Metric | Result |
|---|---:|
| Pair coverage | 28/28 |
| Default ADR symbols | 0 |
| Grid engines | 56 |
| Total fills | 579 |
| LONG fills | 252 |
| SHORT fills | 327 |
| TP closes | 506 |
| Reset closes | 57 |
| Week-close exits | 16 |
| Fill W/L | 529/50 |
| Combined raw return points | `+49.9911%` |
| Combined ADR-normalized return | `+81.4034 ADR` |
| LONG ADR return | `+41.7492 ADR` |
| SHORT ADR return | `+39.6542 ADR` |
| Combined ADR path peak | `+83.3877` |
| Combined ADR path max drawdown | `-17.4714` |
| Combined raw path max drawdown | `-8.7358%` |
| Max active fills | 110 |
| Max active ADR exposure | `22.00` ADR-fill units |

Exit reason contribution:

| Exit Reason | Count | ADR Return | Raw Return | W/L |
|---|---:|---:|---:|---:|
| `grid_tp` | 506 | `+101.2000` | `+59.4659%` | 506/0 |
| `grid_reset` | 57 | `-11.6583` | `-5.5006%` | 21/36 |
| `week_close` | 16 | `-8.1383` | `-3.9742%` | 2/14 |

Best hedged pairs:

| Pair | Fills | TP | Reset | Week Close | Long ADR | Short ADR | Hedged ADR | Max MAE ADR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| AUDUSD | 40 | 37 | 3 | 0 | `+3.60` | `+2.80` | `+6.40` | 1.52 |
| AUDJPY | 37 | 34 | 3 | 0 | `+3.62` | `+2.60` | `+6.22` | 1.38 |
| CHFJPY | 38 | 34 | 0 | 4 | `+3.85` | `+2.25` | `+6.10` | 0.72 |
| USDCHF | 29 | 28 | 1 | 0 | `+2.00` | `+3.45` | `+5.45` | 1.16 |
| EURUSD | 26 | 24 | 2 | 0 | `+1.40` | `+3.08` | `+4.48` | 1.37 |

Worst hedged pairs:

| Pair | Fills | TP | Reset | Week Close | Long ADR | Short ADR | Hedged ADR | Max MAE ADR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| GBPCHF | 28 | 21 | 0 | 7 | `+1.20` | `-2.70` | `-1.50` | 1.76 |
| EURAUD | 33 | 25 | 8 | 0 | `+1.40` | `-2.33` | `-0.93` | 2.56 |
| AUDNZD | 17 | 12 | 0 | 5 | `+0.07` | `+0.60` | `+0.67` | 1.46 |
| CADJPY | 5 | 5 | 0 | 0 | `+0.80` | `+0.20` | `+1.00` | 0.70 |
| GBPJPY | 10 | 8 | 2 | 0 | `+0.73` | `+0.80` | `+1.53` | 1.13 |

### Gate 36d Interpretation

This is the most constructive result from the pivot.

The basket-band tests did not find a clean mean-reversion trigger, but the
hedged ADR Grid smoke test shows why Freedom keeps coming back to the grid: the
mechanic harvested both sides of the FX universe in a single closed week. LONG
and SHORT sleeves both ended strongly positive, and the combined basket path
ended near its peak.

The result is not production proof. It excludes spread, commission, swap,
slippage, and margin rules, and the trade count is high enough that transaction
costs are a first-order concern. But as a research direction, this is stronger
than the basket-band fade line.

Current read:

- Stop treating Gate 36 as a basket mean-reversion predictor.
- Continue treating the 28-pair universe as a hedged ADR Grid harvest surface.
- Next proof should compare this same hedged-grid week against the Pine
  indicator for a few individual pairs, then run a small lookback of closed
  weeks to see whether trending weeks create unacceptable reset/close drag.

## Continuation: Five-Week Hedged ADR Grid Lookback

The one-week smoke test was constructive, but it could not answer whether a
nearby trending week would create unacceptable active-inventory drag. A small
closed-week lookback was run before any broad sweep.

Commands:

```powershell
npx tsx app/scripts/verification/export-fx-hedged-adr-grid-week.ts --week 2026-06-01T23:00:00.000Z
npx tsx app/scripts/verification/export-fx-hedged-adr-grid-week.ts --week 2026-05-25T23:00:00.000Z
npx tsx app/scripts/verification/export-fx-hedged-adr-grid-week.ts --week 2026-05-18T23:00:00.000Z
npx tsx app/scripts/verification/export-fx-hedged-adr-grid-week.ts --week 2026-05-11T23:00:00.000Z
```

Receipts:

- `app/reports/data-verification/fx-hedged-adr-grid/fx-28pair-hedged-adr-grid-2026-05-11-20260616-035426.md`
- `app/reports/data-verification/fx-hedged-adr-grid/fx-28pair-hedged-adr-grid-2026-05-18-20260616-035414.md`
- `app/reports/data-verification/fx-hedged-adr-grid/fx-28pair-hedged-adr-grid-2026-05-25-20260616-035406.md`
- `app/reports/data-verification/fx-hedged-adr-grid/fx-28pair-hedged-adr-grid-2026-06-01-20260616-035403.md`
- `app/reports/data-verification/fx-hedged-adr-grid/fx-28pair-hedged-adr-grid-2026-06-08-20260616-033849.md`

### Five-Week Result

| Displayed Week | Fills | TP | Reset | Week Close | Final ADR | Max ADR DD | Final Raw | Max Raw DD | Max Active Fills |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-05-11 | 514 | 380 | 39 | 95 | `-6.2359` | `-48.6077` | `-3.2900%` | `-32.8600%` | 119 |
| 2026-05-18 | 497 | 394 | 60 | 43 | `+28.2703` | `-41.2092` | `+16.9100%` | `-19.1400%` | 128 |
| 2026-05-25 | 420 | 341 | 59 | 20 | `+51.2821` | `-23.6441` | `+27.7300%` | `-13.4900%` | 111 |
| 2026-06-01 | 547 | 401 | 67 | 79 | `-44.9107` | `-77.4512` | `-42.6600%` | `-51.1400%` | 161 |
| 2026-06-08 | 579 | 506 | 57 | 16 | `+81.4034` | `-17.4714` | `+49.9912%` | `-8.7358%` | 110 |

Aggregate:

| Metric | Result |
|---|---:|
| Weeks | 5 |
| Positive / negative weeks | 3 / 2 |
| Total ADR | `+109.8092` |
| Average ADR / week | `+21.9618` |
| Total fills | 2,557 |
| Total TP / reset / week-close exits | 2,022 / 282 / 253 |
| Worst final week | 2026-06-01, `-44.9107 ADR` |
| Worst max ADR drawdown | 2026-06-01, `-77.4512 ADR` |
| Max active fills | 161 |
| Max active ADR exposure | `32.20` ADR-fill units |

Side split:

| Displayed Week | LONG ADR | SHORT ADR | Combined ADR |
|---|---:|---:|---:|
| 2026-05-11 | `-10.75` | `+4.51` | `-6.24` |
| 2026-05-18 | `+12.08` | `+16.19` | `+28.27` |
| 2026-05-25 | `+27.72` | `+23.56` | `+51.28` |
| 2026-06-01 | `-14.59` | `-30.32` | `-44.91` |
| 2026-06-08 | `+41.75` | `+39.65` | `+81.40` |

Worst five-week pair contributors:

| Pair | Hedged ADR | LONG ADR | SHORT ADR | Fills | TP | Reset | Week Close | Max MAE ADR | Negative Weeks |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| NZDUSD | `-10.38` | `-16.14` | `+5.76` | 77 | 56 | 4 | 17 | 2.52 | 2 |
| AUDNZD | `-10.04` | `+2.72` | `-12.76` | 95 | 60 | 12 | 23 | 2.08 | 3 |
| EURNZD | `-7.74` | `+6.73` | `-14.47` | 87 | 64 | 5 | 18 | 2.83 | 2 |
| GBPNZD | `-7.67` | `+5.16` | `-12.84` | 90 | 67 | 11 | 12 | 3.14 | 1 |
| EURGBP | `-7.15` | `-10.00` | `+2.85` | 103 | 76 | 6 | 21 | 2.77 | 2 |

Best five-week pair contributors:

| Pair | Hedged ADR | LONG ADR | SHORT ADR | Fills | TP | Reset | Week Close | Max MAE ADR | Negative Weeks |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| AUDJPY | `+16.49` | `+8.32` | `+8.17` | 97 | 86 | 11 | 0 | 1.38 | 0 |
| CHFJPY | `+15.80` | `+8.43` | `+7.38` | 111 | 94 | 10 | 7 | 1.81 | 0 |
| AUDCAD | `+12.36` | `+4.81` | `+7.55` | 65 | 61 | 4 | 0 | 1.04 | 0 |
| EURCAD | `+11.48` | `+3.57` | `+7.91` | 100 | 84 | 9 | 7 | 1.70 | 1 |
| CADCHF | `+11.25` | `+4.79` | `+6.46` | 78 | 66 | 8 | 4 | 1.46 | 0 |

### 2026-06-01 Stress Read

The worst week explains the main failure mode:

| Exit Reason | Count | ADR Return | Raw Return | W/L |
|---|---:|---:|---:|---:|
| `grid_tp` | 401 | `+80.20` | `+42.69%` | 401/0 |
| `grid_reset` | 67 | `-24.44` | `-10.60%` | 18/49 |
| `week_close` | 79 | `-100.67` | `-74.75%` | 0/79 |

The grid harvested many TPs, but stale active inventory overwhelmed them by the
Friday close. This is the same inventory problem as the earlier mirrored-book
test, now expressed inside the ADR Grid engine.

### Gate 36e Interpretation

The hedged ADR Grid idea remains alive, but the one-week read was too generous.
The five-week lookback says:

- the gross harvesting surface is real: 2,022 TP closes across five weeks;
- the basket is still net-positive in this small sample at `+109.8092 ADR`;
- unmanaged active inventory is the blocker, not TP production;
- 2026-06-01 is the stress case to study before any broad sweep;
- NZD and some GBP crosses are the first pair-concentration warning in this
  sample;
- transaction costs and margin are still excluded, so live-readiness is not
  implied.

Next research should not tune a profit target. It should test inventory
containment:

1. Pine visual parity on a few single-pair LONG/SHORT grid runs, especially a
   clean pair (`AUDJPY` or `AUDCAD`) and a stress pair (`GBPNZD`, `EURNZD`,
   `NZDUSD`, or `AUDNZD`).
2. A focused 2026-06-01 inventory audit: age of active fills, week-close loser
   concentration, and whether earlier stop-entry/force-close rules reduce the
   `week_close` drag without deleting TP production.
3. Only after that, test a small rule matrix. Keep COT, martingale/scaling,
   pair clustering, commissions, margin, and broad 2019-current sweeps out
   until the pure inventory behavior is understood.

## Continuation: Gate 36f 2026-06-01 Inventory / COT / Strength Autopsy

Added research-only script:
`app/scripts/verification/audit-fx-hedged-adr-grid-inventory.ts`.

Source receipt:
`app/reports/data-verification/fx-hedged-adr-grid/fx-28pair-hedged-adr-grid-2026-06-01-20260616-035403.json`.

Autopsy receipt:
`app/reports/data-verification/fx-hedged-adr-grid-inventory/fx-28pair-hedged-adr-grid-inventory-autopsy-2026-06-01-20260616-042348.md`.

Scope:

- Displayed week: `2026-06-01`.
- Joins the hedged ADR Grid receipt to COT Faces, COT Faces commercial-delta
  contrarian, week-open strength, entry-cutoff strength, and realised FX
  rotation.
- Sentiment is excluded because the stored sample is too short for this gate.
- Realised FX rotation is labelled as ex-post context, not a pre-entry signal.

Selected side versus opposite side:

| Source | Directional Pairs | Selected ADR | Opposite ADR | Edge | Selected WC ADR | Opposite WC ADR | Warned | Fed Loser |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| COT Faces | 28/28 | `+9.95` | `-54.86` | `+64.82` | `-20.23` | `-80.44` | 15 | 13 |
| COT Faces commercial-delta contrarian | 28/28 | `+9.53` | `-54.44` | `+63.96` | `-20.23` | `-80.44` | 14 | 14 |
| Strength at week open | 28/28 | `-75.31` | `+30.40` | `-105.71` | `-100.67` | `+0.00` | 6 | 22 |
| Strength at entry cutoff | 28/28 | `+19.39` | `-64.30` | `+83.69` | `-10.41` | `-90.26` | 20 | 8 |

Inventory stress:

- At combined max DD (`2026-06-03T19:00:00Z`), the book had `159` active fills:
  `54` LONG and `105` SHORT, `31.80` ADR-fill units of active exposure. Those
  active fills eventually resolved to `-110.90` ADR, including `-94.32` ADR of
  future week-close loss.
- At max active fills / exposure (`2026-06-03T21:00:00Z`), the book had `161`
  active fills and `32.20` ADR-fill units. Those fills eventually resolved to
  `-111.31` ADR.
- At entry cutoff (`2026-06-05T13:00:00Z`), only `79` active fills remained, but
  they were old inventory: average age `64.3` hours, max age `108` hours, and
  all remaining future result was week-close loss (`-100.67` ADR).

Worst inventory facts:

- The stress was mainly broad NZD weakness plus some GBP/EUR/AUD cross strength
  against NZD.
- Worst hedged pairs by ADR were `GBPNZD -17.24`, `EURNZD -13.15`,
  `NZDUSD -11.44`, `NZDJPY -10.09`, `AUDNZD -6.81`, and `NZDCAD -5.83`.
- COT Faces warned correctly on all six of those worst pairs.
- Week-open strength was wrong on all six and fed the losing side.
- Entry-cutoff strength had flipped correctly on those six, which is useful as
  a potential no-new-entry / quarantine signal, not as a week-open setup signal.

Realised FX rotation:

| Currency | Realised Score | COT Faces Vote | Strength-Open Vote |
|---|---:|---:|---:|
| USD | `+8.228` | `+3` | `+1` |
| GBP | `+4.444` | `-1` | `-7` |
| JPY | `+3.713` | `+1` | `-5` |
| EUR | `+2.114` | `+7` | `-3` |
| NZD | `-12.770` | `-5` | `+7` |
| CHF | `-4.165` | `-7` | `-1` |
| AUD | `-2.881` | `+5` | `+5` |
| CAD | `+1.317` | `-3` | `+3` |

Risk proxy:

- FX-relative risk-sensitive minus haven proxy was `-7.370`, a risk-off /
  defensive realised rotation.
- COT Faces risk-sensitive minus haven vote was flat at `0.000`; it caught NZD
  weakness better than it classified broad risk-on/risk-off.
- Week-open strength vote was risk-on (`+6.667`) and wrong for this stress.

### Gate 36f Interpretation

This is the first constructive COT result in the ADR Grid branch. It does not
promote COT Faces and it does not erase the earlier source-opportunity warning
that selected direction only barely beat opposite over broad path tests. But on
the actual `2026-06-01` hedged-grid failure, COT Faces would have avoided much
of the stale inventory if used as a side selector, while week-open strength
would have made the loss worse.

Fresh lead:

- Test COT Faces as a grid-side permission layer: run only the selected grid
  side per pair versus only the opposite side, first across the existing
  five-week sample, then over a broader clean window if the risk metrics hold.
- Test strength as a timing / quarantine layer, not as a week-open directional
  source: if strength flips against active inventory by cutoff or by a stress
  timestamp, stop new entries or force inventory review.
- Test risk-on/risk-off and moneyflow as explicit currency-rotation features.
  Do not infer them from ex-post realised flow in production logic.
- Continue treating fixed per-fill SL as secondary. The immediate blocker is
  inventory budget, active-fill age, and stale week-close exposure.

## Continuation: Gate 36g COT / Strength Side-Selector Audit

Freedom's next hypothesis was that strength may not be useful as a standalone
directional source, but could have merit as a fade or timing layer when it
disagrees with COT Faces.

Added research-only script:
`app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts`.

Receipt:
`app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-5w-20260616-043858.md`.

Scope:

- Input receipts: the existing five hedged ADR Grid weeks from Gate 36e.
- Marking: rebuilds marked paths from recorded grid fills plus canonical 1H
  bars, so drawdown includes active inventory.
- Sentiment excluded because the stored sample is too short.
- Cutoff-strength rows are labelled as lookahead/quarantine diagnostics, not
  valid week-open setup signals.

Five-week variant result:

| Variant | Pair Sides | Total ADR | W/L | Worst Path DD | R/DD | Week-Close ADR | Max Active |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fully hedged baseline | 280 | `+109.81` | 3/2 | `-77.45` | `1.42` | `-225.80` | 161 |
| COT Faces selected | 140 | `+90.79` | 4/1 | `-21.99` | `4.13` | `-83.98` | 78 |
| COT Faces opposite | 140 | `+19.02` | 3/2 | `-87.44` | `0.22` | `-141.82` | 137 |
| Strength open selected | 140 | `-45.70` | 2/3 | `-83.51` | `-0.55` | `-202.72` | 132 |
| Strength open fade | 140 | `+155.51` | 5/0 | `-25.45` | `6.11` | `-23.08` | 75 |
| COT + strength open agree | 77 | `+19.39` | 2/3 | `-23.47` | `0.83` | `-79.79` | 66 |
| COT when strength open disagrees | 63 | `+71.39` | 5/0 | `-12.81` | `5.57` | `-4.20` | 43 |
| Strength when open disagrees | 63 | `-65.09` | 3/2 | `-88.56` | `-0.73` | `-122.94` | 114 |

Cutoff-strength diagnostics:

| Variant | Pair Sides | Total ADR | W/L | Worst Path DD | R/DD | Week-Close ADR | Max Active |
|---|---:|---:|---:|---:|---:|---:|---:|
| COT + cutoff strength agree | 72 | `+67.69` | 5/0 | `-23.10` | `2.93` | `-16.98` | 47 |
| COT when cutoff strength disagrees | 68 | `+23.09` | 3/2 | `-17.23` | `1.34` | `-67.00` | 56 |
| Cutoff strength when disagrees | 68 | `+53.04` | 4/1 | `-26.68` | `1.99` | `-22.13` | 64 |

### Gate 36g Interpretation

This is the strongest Gate 36 lead so far, but it is still only a five-week
sample. The signal is not simply "combine COT and strength." The signal is more
specific:

- Week-open strength as a standalone direction was bad: `-45.70` ADR.
- Fading week-open strength was excellent in this small sample: `+155.51` ADR,
  5/0 weeks, and only `-23.08` ADR of week-close loss.
- When COT Faces and week-open strength disagreed, trading COT side returned
  `+71.39` ADR with only `-12.81` path DD and `-4.20` week-close drag.
- Following strength on those same disagreement rows returned `-65.09` ADR with
  `-88.56` path DD and `-122.94` week-close drag.
- COT/strength agreement was not the good slice: only `+19.39` ADR, 2/3 weeks.

Fresh read:

Strength may be useful precisely because it is wrong at the week-open grid
setup horizon. Its merit may be as a crowding/fade condition or as a warning
that the COT side has trapped opposite-side inventory available to harvest. That
is different from treating strength as a source of direction.

Next test:

1. Expand the same side-selector audit beyond five weeks before promoting any
   conclusion. The first expansion should be current 2026 closed weeks, then a
   clean source-backed historical window if the shape survives.
2. Score by return/DD, week-close loss, active exposure, active age, and worst
   pair/currency concentration. Raw ADR return alone is not enough.
3. Keep the key variants narrow: COT selected, COT opposite, strength selected,
   strength fade, COT/strength agree, COT when strength disagrees, and strength
   when it disagrees with COT.
4. Treat cutoff-strength as a possible quarantine/no-new-entry signal only.
   It cannot be used as a week-open setup signal without lookahead.

## Continuation: Gate 36h COT Variant / Strength Anchor Split

Freedom corrected the interpretation before expanding the sample:

- `cot_faces_v1_commercial_delta_contrarian` is not cleaner than
  `cot_faces_v1_forced` in the `2026-06-01` autopsy. It was similar, slightly
  worse, and differed on only one pair in that week.
- The strength issue is not only direction; it is also anchor timing. The
  prior `strength_open` test used canonical week-open strength, but the
  snapshots were Sunday/pre-entry for most weeks and included the canonical
  1w/1m lookback blend.

The side-selector audit was extended in-place, still research-only:

`app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts`

Receipt:

`app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-5w-20260616-065234.md`

Scope:

- same five Gate 36e hedged ADR Grid receipts;
- same ADR Grid terms: `0.20 ADR` spacing/TP, `1.0 ADR` reset,
  `0.20 ADR` reset-entry buffer, no SL, no costs, no margin;
- COT modes: `cot_faces_v1_forced` and
  `cot_faces_v1_commercial_delta_contrarian`;
- strength modes:
  - `strength_open_canonical`: current canonical week-open resolver, including
    prior 1w/1m lookback fallback;
  - `strength_friday_snapshot`: latest 1h/4h/24h currency strength snapshot at
    or before Friday 17:00 New York, with no later Sunday refresh.

Five-week result:

| Variant | Total ADR | Worst Path DD | R/DD | Week-Close ADR | W/L | Max Active |
|---|---:|---:|---:|---:|---:|---:|
| Fully hedged baseline | `+109.81` | `-77.45` | `1.42` | `-225.80` | 3/2 | 161 |
| COT Faces selected | `+90.79` | `-21.99` | `4.13` | `-83.98` | 4/1 | 78 |
| COT Faces commercial-delta contrarian selected | `+93.23` | `-19.93` | `4.68` | `-79.85` | 5/0 | 73 |
| Open canonical strength selected | `-45.70` | `-83.51` | `-0.55` | `-202.72` | 2/3 | 132 |
| Open canonical strength fade | `+155.51` | `-25.45` | `6.11` | `-23.08` | 5/0 | 75 |
| Friday frozen strength selected | `+123.45` | `-32.33` | `3.82` | `-32.47` | 5/0 | 85 |
| Friday frozen strength fade | `-13.56` | `-98.55` | `-0.14` | `-178.56` | 3/2 | 145 |
| COT Faces when open canonical strength disagrees | `+71.39` | `-12.81` | `5.57` | `-4.20` | 5/0 | 43 |
| Commercial-delta contrarian COT when open canonical strength disagrees | `+77.73` | `-12.81` | `6.07` | `-0.06` | 5/0 | 43 |
| COT Faces + Friday frozen strength agree | `+67.47` | `-17.96` | `3.76` | `-25.58` | 4/1 | 56 |
| Commercial-delta contrarian COT + Friday frozen strength agree | `+70.98` | `-15.07` | `4.71` | `-21.44` | 5/0 | 50 |

### Gate 36h Interpretation

This still does not promote a source rule. It tightens the next test boundary:

- Commercial-delta contrarian is not a new standalone answer. It improves the
  five-week selected slice modestly (`+93.23` versus `+90.79`) and improves the
  open-strength disagreement slice, but the shape is still the same COT Faces
  family.
- Friday frozen strength is much better than open canonical strength as a
  selected direction (`+123.45` versus `-45.70`), but it is still not the top
  risk-adjusted result in this tiny sample.
- The strongest five-week shape remains a fade/crowding condition:
  open canonical strength fade, and COT when open canonical strength disagrees.
- Active-age and concentration metrics still matter. Fully hedged baseline
  reached `161` active fills and `-225.80` week-close ADR, while the best
  disagreement slices cut max active fills to `43` and nearly eliminated
  week-close drag.

Next test:

1. Expand this exact source-mode matrix to current 2026 closed weeks first.
2. Generate missing 2026 hedged ADR Grid receipts with the same grid terms
   before rerunning the side-selector audit.
3. Do not tune ADR Grid parameters, add stop loss, add costs/margin, add pair
   clustering, or promote COT/strength until the source/strength definition
   survives the larger current-2026 window.

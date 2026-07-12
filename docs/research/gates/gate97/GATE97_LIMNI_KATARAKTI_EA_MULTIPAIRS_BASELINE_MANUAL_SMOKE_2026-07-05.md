# Gate 97 - Limni Katarakti EA Multipair Baseline Manual Smoke

Date: 2026-07-05

## Scope

Convert `automation/mt5/Experts/LimniKataraktiEA.mq5` from a single-symbol M1 Strategy Tester harness into a multipair M1 Strategy Tester baseline harness. The first run must use the same fixed settings across all selected symbols in one tester pass.

This is an execution harness verification gate. It is not strategy promotion, optimization, parameter search, or a live/app integration gate.

After the first successful David-off smoke, Freedom explicitly opened a bounded
manual shape-discovery sequence inside this gate:

1. `KTR_LOOSE + David OFF`
2. `KTR_LOOSE + David AGAINST`
3. `KTR_LOOSE + David WITH`

The purpose is to learn the inventory/lifecycle shape of the current MT5 EA
harness before testing smaller grid caps, strict Katarakti variants, lifecycle
guards, or adaptive controller rules.

## Frozen Areas

- Do not modify `automation/mt5/Experts/LimniHedge_V1.mq5`.
- Do not modify Type3, Gate 95, Gate 96, or LimniHedge runner logic.
- Do not add a new risk model, regime model, formula, or parameter sweep.
- Do not treat any MT5 tester result as approved evidence until the CSV receipts and Strategy Tester report are reviewed.

## Fixed 28-Symbol CSV

Use exact broker symbols for the active Eightcap/OANDA MT5 environment:

```text
AUDCAD.i,AUDCHF.i,AUDJPY.i,AUDNZD.i,AUDUSD.i,CADCHF.i,CADJPY.i,CHFJPY.i,EURAUD.i,EURCAD.i,EURCHF.i,EURGBP.i,EURJPY.i,EURNZD.i,EURUSD.i,GBPAUD.i,GBPCAD.i,GBPCHF.i,GBPJPY.i,GBPNZD.i,GBPUSD.i,NZDCAD.i,NZDCHF.i,NZDJPY.i,NZDUSD.i,USDCAD.i,USDCHF.i,USDJPY.i
```

As of the 2026-07-05 patch, the preferred MT5 Strategy Tester path is the built-in FX28 preset:

- select one driver symbol in Strategy Tester, such as `AUDCAD.i`
- keep Strategy Tester optimization off
- `EnableMultiSymbol=true`
- `SymbolsCsv=` blank
- `UseDefaultFx28Symbols=true`
- `UseTimerPump=false`

This avoids MT5's "all Market Watch symbols" mode, which forces a symbol sweep/optimization-style run. It also avoids relying on tester-side Market Watch enumeration, which may expose only the driver symbol in a normal one-symbol test.

The EA still supports a Market Watch fallback if explicitly requested:

- `EnableMultiSymbol=true`
- `SymbolsCsv=` blank
- `UseDefaultFx28Symbols=false`
- Market Watch contains only the intended 28 visible symbols

In this mode the EA enumerates visible Market Watch symbols and records the actual list in `effective_symbols_csv`.

## Manual Smoke Checklist

1. Compile `LimniKataraktiEA.mq5` in MetaEditor and require `0 errors, 0 warnings`.
2. Run a single-symbol M1 Strategy Tester smoke with `EnableMultiSymbol=false`.
3. Run a two-symbol M1 Strategy Tester smoke with `EnableMultiSymbol=true`, `SymbolsCsv=AUDCAD.i,AUDCHF.i`, and `UseDefaultFx28Symbols=false`.
4. Run the 28-symbol M1 Strategy Tester baseline with one driver symbol, optimization off, `EnableMultiSymbol=true`, blank `SymbolsCsv`, and `UseDefaultFx28Symbols=true`.
5. Keep `FailIfAnySymbolUnavailable=true` for baseline evidence so missing broker symbols fail the run instead of silently shrinking the basket universe.
6. Keep `UseTimerPump=false` for the baseline unless a tester-specific missed-bar issue is documented.
7. Export and preserve the per-symbol event, basket, and summary CSVs.
8. Export and preserve the aggregate summary and pair-contribution CSVs.
9. Preserve the MT5 Strategy Tester report beside the CSV receipts.

## Required Receipt Checks

- Each selected symbol has independent basket state and CSV rows.
- Aggregate `closed_net_adr_total` is the sum of per-symbol closed net ADR.
- Aggregate `terminal_marked_adr_total` is the sum of per-symbol terminal open-basket markout.
- Aggregate `closed_plus_marked_net_adr_total` equals closed net ADR plus terminal marked ADR.
- `effective_symbols_csv` in the receipts matches the requested 28-symbol set for the baseline run.
- Same-bar trail/grid ambiguity counters and multi-grid same-bar counters are visible in receipts for later review.

## Artifact Storage

Manual MT5 Strategy Tester exports must be copied out of the terminal common
files folder and preserved under:

```text
docs/research/gates/gate97/artifacts/
```

Each run folder should include:

- aggregate summary CSV
- aggregate pair-contribution CSV
- all per-symbol `_summary.csv`, `_baskets.csv`, and `_events.csv` files
- `artifact_manifest.csv` with SHA-256 hashes
- MT5 Strategy Tester HTML report when available

## Run Ledger

### Run A - Loose Katarakti, David Off, Tight TP, Uncapped Grid

Artifact folder:

```text
docs/research/gates/gate97/artifacts/manual-smoke-2026-ytd-david-off-tp010-uncapped/
```

Source terminal folder:

```text
C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/Common/Files/LimniKataraktiEA/
```

Run id:

```text
2026_01_01_00_00_00_TESTER_181
```

Preserved artifacts:

- `86` exported CSV files
- `artifact_manifest.csv`

Settings confirmed from per-symbol summary receipts:

| Field | Value |
| --- | --- |
| Symbol source | `default_fx28` |
| Symbols | 28 default FX broker symbols |
| Katarakti mode | `KTR_LOOSE` / `0` |
| David mode | `OFF` |
| David MA / RSI | MA `35`, RSI `1000/60/40` |
| Stoch | `1000/100/100`, OS/OB `10/90` |
| TP | `0.10 ADR` |
| SL | `0.00 ADR` |
| Grid | enabled |
| Grid spacing | `0.10 ADR` |
| Max basket entries | `500` |
| Trailing stop | disabled |
| Execution price mode | `MT5_ORDER_FILL` |

Important caveat: this was intentionally uncapped behavior. `MaxBasketEntries`
was `500`, not `50`, to expose worst-case inventory shape. The cap did not
bind in closed baskets, but the unresolved terminal basket reached `44` fills.

Time coverage visible in exported event rows:

```text
2026-01-02 14:06:00 through 2026-07-03 23:59:30
```

This is therefore a 2026 YTD-style smoke, not a full 12-month run.

Aggregate read from pair-contribution/per-symbol files:

| Metric | Value |
| --- | ---: |
| Pair rows | 28 |
| Closed baskets | 658 |
| Closed net ADR | 200.300000 |
| Terminal marked ADR | -59.378693 |
| Closed plus marked ADR | 140.921307 |
| Unresolved open baskets | 1 |
| Weighted average fills | 3.0441 |
| Worst closed max fill count | 30 |
| Worst open drawdown ADR | -45.098982 |
| Same-bar TP/grid ambiguity count | 7 |
| Multi-grid same-bar count | 47 |

Unresolved terminal basket:

| Field | Value |
| --- | --- |
| Symbol | `USDCAD.i` |
| Side | short |
| Entry time | `2026-06-17 15:18:00` |
| Terminal mark time | `2026-07-03 23:59:30` |
| Fills | 44 |
| Terminal net ADR | -59.378693 |
| MAE ADR | -95.145927 |
| Duration minutes | 23561.50 |

Execution receipt read:

| Metric | Value |
| --- | ---: |
| Event files | 28 |
| Event rows | 3591 |
| Execution receipt rows | 2703 |
| Rows with nonzero actual-minus-modeled price | 2400 |
| Maximum absolute actual-minus-modeled price | 0.64 |
| Average absolute actual-minus-modeled price | 0.00886945 |

Read: this run is useful and mechanically alive as a frequent-harvest shape.
The fixed `0.10 ADR` TP closes many small baskets, but the 100% closed win rate
is not a quality claim because there is no SL and terminal open inventory can
carry the real damage. The immediate disease is unresolved basket lifecycle,
not entry scarcity.

The aggregate summary CSV from this run is not used as the primary parsed
source because the comma-delimited symbol list shifted columns in MT5's CSV
writer. The durable read above is computed from pair-contribution and
per-symbol files.

### Run B - Loose Katarakti, David Against, Tight TP, Uncapped Grid

Artifact folder:

```text
docs/research/gates/gate97/artifacts/manual-smoke-2026-ytd-david-against-tp010-uncapped/
```

Run id:

```text
2026_01_01_00_00_00_TESTER_259
```

Preserved artifacts:

- `86` exported CSV files
- `artifact_manifest.csv`

Settings confirmed from per-symbol summary receipts:

| Field | Value |
| --- | --- |
| Symbol source | `default_fx28` |
| Symbols | 28 default FX broker symbols |
| Katarakti mode | `KTR_LOOSE` / `0` |
| David mode | `AGAINST` |
| David MA / RSI | MA `35`, RSI `1000/60/40` |
| Stoch | `1000/100/100`, OS/OB `10/90` |
| TP | `0.10 ADR` |
| SL | `0.00 ADR` |
| Grid | enabled |
| Grid spacing | `0.10 ADR` |
| Max basket entries | `500` |
| Trailing stop | disabled |
| Execution price mode | `MT5_ORDER_FILL` |

Time coverage visible in exported event rows:

```text
2026-01-02 14:06:00 through 2026-07-03 17:26:00
```

Aggregate read from the semicolon-safe aggregate summary:

| Metric | Value |
| --- | ---: |
| Pair rows | 28 |
| Closed baskets | 334 |
| Closed net ADR | 90.300000 |
| Terminal marked ADR | 0.000000 |
| Closed plus marked ADR | 90.300000 |
| Unresolved open baskets | 0 |
| Weighted average fills | 2.7036 |
| Worst closed max fill count | 21 |
| Worst open drawdown ADR | -21.161269 |
| Same-bar TP/grid ambiguity count | 4 |
| Multi-grid same-bar count | 16 |

Execution receipt read:

| Metric | Value |
| --- | ---: |
| Event files | 28 |
| Event rows | 2122 |
| Execution receipt rows | 1236 |
| Rows with nonzero actual-minus-modeled price | 1051 |
| Maximum absolute actual-minus-modeled price | 0.64 |
| Average absolute actual-minus-modeled price | 0.00768540 |

Event mix:

| Event | Rows |
| --- | ---: |
| `GRID_ADD` | 569 |
| `ENTRY` | 334 |
| `EXIT` | 334 |
| `SELL_SIGNAL` | 328 |
| `BUY_BLOCKED_DAVID` | 280 |
| `SELL_BLOCKED_DAVID` | 180 |
| `BUY_SIGNAL` | 97 |

Pair spread:

| Group | Symbol | Closed baskets | Closed plus marked ADR | Worst DD ADR | Max fills |
| --- | --- | ---: | ---: | ---: | ---: |
| Best | `AUDJPY.i` | 19 | 6.800000 | -9.097956 | 14 |
| Best | `NZDCHF.i` | 17 | 5.400000 | -21.161269 | 19 |
| Best | `NZDJPY.i` | 22 | 4.800000 | -2.095187 | 7 |
| Best | `CHFJPY.i` | 20 | 4.700000 | -4.346696 | 9 |
| Bottom | `NZDUSD.i` | 7 | 1.100000 | -0.576550 | 3 |
| Bottom | `EURAUD.i` | 8 | 1.400000 | -0.755062 | 4 |
| Bottom | `EURGBP.i` | 11 | 1.600000 | -0.245830 | 2 |
| Bottom | `AUDUSD.i` | 8 | 1.700000 | -1.621622 | 6 |

Read: `David AGAINST` is the cleanest of the three uncapped tight-TP smokes
for inventory. It gave up net versus David Off (`90.300000` closed-plus-marked
ADR versus `140.921307`), but removed the terminal open-basket disease that
both David Off and David With carried. It also cut worst drawdown from
`-45.098982` to `-21.161269`, reduced worst fill count from the unresolved
`44` fill USDCAD basket / `30` closed-fill worst case to `21`, and reduced
multi-grid same-bar events from `47` and `31` down to `16`.

This is not promotion evidence. It is enough to make `David AGAINST` the
first candidate for capped-grid and lifecycle-guard testing.

### Run C - Loose Katarakti, David With, Tight TP, Uncapped Grid

Artifact folder:

```text
docs/research/gates/gate97/artifacts/manual-smoke-2026-ytd-david-with-tp010-uncapped/
```

Run id:

```text
2026_01_01_00_00_00_TESTER_237
```

Preserved artifacts:

- `86` exported CSV files
- `artifact_manifest.csv`

Settings confirmed from per-symbol summary receipts:

| Field | Value |
| --- | --- |
| Symbol source | `default_fx28` |
| Symbols | 28 default FX broker symbols |
| Katarakti mode | `KTR_LOOSE` / `0` |
| David mode | `WITH` |
| David MA / RSI | MA `35`, RSI `1000/60/40` |
| Stoch | `1000/100/100`, OS/OB `10/90` |
| TP | `0.10 ADR` |
| SL | `0.00 ADR` |
| Grid | enabled |
| Grid spacing | `0.10 ADR` |
| Max basket entries | `500` |
| Trailing stop | disabled |
| Execution price mode | `MT5_ORDER_FILL` |

Time coverage visible in exported event rows:

```text
2026-01-02 14:06:00 through 2026-07-03 23:59:30
```

Aggregate read from pair-contribution/per-symbol files:

| Metric | Value |
| --- | ---: |
| Pair rows | 28 |
| Closed baskets | 325 |
| Closed net ADR | 110.300000 |
| Terminal marked ADR | -59.378693 |
| Closed plus marked ADR | 50.921307 |
| Unresolved open baskets | 1 |
| Weighted average fills | 3.3938 |
| Worst closed max fill count | 30 |
| Worst open drawdown ADR | -45.098982 |
| Same-bar TP/grid ambiguity count | 3 |
| Multi-grid same-bar count | 31 |

Unresolved terminal basket:

| Field | Value |
| --- | --- |
| Symbol | `USDCAD.i` |
| Side | short |
| Entry time | `2026-06-17 15:18:00` |
| Terminal mark time | `2026-07-03 23:59:30` |
| Fills | 44 |
| Terminal net ADR | -59.378693 |
| MAE ADR | -95.145927 |
| Duration minutes | 23561.50 |

Execution receipt read:

| Metric | Value |
| --- | ---: |
| Event files | 28 |
| Event rows | 2358 |
| Execution receipt rows | 1471 |
| Rows with nonzero actual-minus-modeled price | 1350 |
| Maximum absolute actual-minus-modeled price | 0.488 |
| Average absolute actual-minus-modeled price | 0.00984293 |

Read: `David WITH` reduced trade count versus `David OFF` but did not solve the
same unresolved USDCAD short. Closed-plus-marked ADR fell from `140.921307` to
`50.921307`, while terminal marked ADR stayed identical at `-59.378693`.
This is weaker than Run A as a standalone frequent-harvest shape and does not
yet justify graduating `David WITH` into grid-cap testing.

The aggregate summary CSV from this run is not used as the primary parsed
source because it was exported before the semicolon-safe receipt patch. The
durable read above is computed from pair-contribution and per-symbol files.
After Run C, the EA was patched and reinstalled so future `symbols_csv` and
`effective_symbols_csv` receipt fields use semicolon-safe text.

## A/B/C Comparison

All three preserved runs used the same `KTR_LOOSE`, `0.10 ADR` TP, `0.00 ADR`
SL, `0.10 ADR` grid spacing, `500` max entries, David MA `35`, David RSI
`1000/60/40`, and Stoch `1000/100/100` with `10/90`. The A/B/C variable was
`DavidMode`.

| Run | David | Closed baskets | Closed plus marked ADR | Unresolved open baskets | Worst DD ADR | Worst fill count | Multi-grid same-bar |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | `OFF` | 658 | 140.921307 | 1 | -45.098982 | 44 terminal / 30 closed | 47 |
| B | `AGAINST` | 334 | 90.300000 | 0 | -21.161269 | 21 | 16 |
| C | `WITH` | 325 | 50.921307 | 1 | -45.098982 | 44 terminal / 30 closed | 31 |

Current read: `David OFF` is the highest net frequent-harvest shape, but it
carries the open-inventory failure. `David WITH` lowers activity without fixing
that failure. `David AGAINST` is the best lifecycle shape in this bounded smoke,
because it is the only one with zero unresolved terminal baskets.

## Final Gate 97 Read

Freedom's final read for this checkpoint:

- `David WITH` is a dud for now.
- `David OFF` is still interesting because it produced the most harvest, but
  it carried unresolved terminal inventory.
- `David AGAINST` is also interesting because it cleaned up this smoke, but
  the mechanism is not yet understood.
- The David RSI `1000/60/40` settings were trial-and-error prototype settings,
  not proven optimal settings.

The next step is not grid caps or David tuning. Pause here and open Gate 98 as
a Katarakti entry-stack ablation. The first objective is to isolate Katarakti
itself before deciding whether stochastic, LRMG, or David filters actually help.

## Next Gate

Recommended new gate:

```text
Gate 98 - katarakti-entry-stack-ablation
```

Start with `Katarakti only` for `KTR_LOOSE`, `KTR_BALANCED`, and
`KTR_EXTREME`, then add layer-by-layer tests:

1. `K_ONLY`
2. `K_STOCH`
3. `K_LRMG_REVERSAL`
4. `K_LRMG_REVERSAL_STOCH`
5. Winner + `DAVID_AGAINST`
6. Winner + `DAVID_WITH` as a control only

Important definition: `Katarakti only` disables LRMG, stochastic, and David as
entry filters. If Katarakti's internal trigger mechanics require the existing
non-time-based/LRMG event source, preserve that as a mechanical source while
disabling LRMG as a directional or overextension filter.

## Stop Line

Do not continue into broad optimization, Candidate B integration, formula
redesign, live trading, app/runtime integration, grid-cap testing, lifecycle
guard testing, or further David parameter tuning from Gate 97. The next action
is Gate 98 design/implementation for a clean Katarakti isolation switch and
receipts.

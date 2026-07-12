# Gate 82 MT5 Hedged Grid Visual Prototype

Date: 2026-06-30

Verdict: `PASS_GATE82_MT5_HEDGED_GRID_VISUAL_PROTOTYPE_BUILT_NO_PROMOTION`

## Scope

This gate builds the first MT5 Expert Advisor prototype for visual mechanics
inspection of the raw fully hedged grid family.

Included:

- MT5 EA mechanics under `automation/mt5/Experts/`.
- Fully hedged long and short grid legs.
- `NO_LIMIT_RAW` mode.
- `L3_RAW` mode.
- Chart-symbol-first operation with optional `SymbolsCsv` multi-symbol support.
- On-chart `Comment()` dashboard for Strategy Tester visual audit.
- CSV logs for account state, symbol state, fills, and resets.
- MetaEditor compile proof.

Excluded:

- No Candidate B dependency.
- No Brain/cell dependency.
- No COT, Strength, Regime, or fair-value dependency.
- No risk layer.
- No pair-net `+1ADR` flatten logic.
- No account-level lock.
- No partial harvest logic.
- No optimization.
- No all-28 validation.
- No promotion.
- No live-readiness claim.

## Files

- `automation/mt5/Experts/LimniBasketHedgeEAAlphaV1.mq5`
- `automation/mt5/Experts/LimniBasketHedgeEAAlphaV1.ex5`
- `docs/research/gates/gate82/GATE82_MT5_HEDGED_GRID_VISUAL_PROTOTYPE_2026-06-30.md`

## Mechanics Implemented

The EA follows the raw Gate 80/Gate 82 hedged mechanics, not the rejected
pair-net flatten variant.

- Each enabled symbol owns independent long and short legs.
- Each leg starts with one market fill.
- Additional same-side fills are added when price moves by `SpacingAdrMultiple`
  from the leg anchor in either adverse or favorable direction.
- Leg PnL is measured in ADR units using actual MT5 bid/ask marks and actual
  position open prices.
- A leg resets when its leg-level net ADR PnL reaches `TargetAdrMultiple`.
- `NO_LIMIT_RAW` keeps restarting legs without a weekly reset cap.
- `L3_RAW` stops a side after three target resets for that symbol-side in the
  current MT5 week.

Repo mapping note: the Gate 80 replay code applies the L3 reset counter inside
the side loop for `weekly_side_grid`, so the MT5 implementation uses independent
long and short weekly reset counters. The dashboard also shows the symbol-level
sum for audit.

Week boundary note: the EA computes the Limni week boundary as Sunday 19:00 ET
with DST handling, logs `WEEK_BOUNDARY`, and resets L3 weekly counters. It does
not flatten positions at week boundary. That is an MT5 continuous-mechanics
choice and should be visually reviewed before any later all-28 test.

## Inputs

- `Mode`: `NO_LIMIT_RAW` or `L3_RAW`.
- `SymbolsCsv`: comma-separated symbols for later multi-symbol tests.
- `UseCurrentChartSymbolOnly`: default `true`; first validation should use this.
- `LotSize`: default `0.01`.
- `AdrValue`: explicit price-distance ADR override. If `0`, the EA uses average
  D1 high-low range over the last 14 closed daily bars.
- `TargetAdrMultiple`: default `1.0`.
- `SpacingAdrMultiple`: default `0.2`.
- `MaxPositionsPerSymbol`: safety cap only.
- `EnableTrading`: default `true`.
- `AllowLiveTrading`: default `false`; non-tester trading is blocked unless this
  is explicitly changed.
- `ManualFlattenNow`: closes this EA's managed positions for enabled symbols.
- `MagicNumberBase`: deterministic per-symbol, per-mode magic source.
- `SlippagePoints`, `MaxOrdersPerTick`, `DashboardRefreshSeconds`,
  `DashboardMaxSymbols`, `CsvLogEnabled`.

## Safety

- Requires `ACCOUNT_MARGIN_MODE_RETAIL_HEDGING`.
- Blocks netting-only accounts.
- Blocks non-Strategy-Tester trading unless `AllowLiveTrading=true`.
- Manages only positions matching enabled symbol plus deterministic magic.
- Does not interfere with manual trades or unrelated EA trades.
- Stops opening new positions for a symbol when `MaxPositionsPerSymbol` is hit
  and logs `SAFETY_CAP_HIT`.
- `ManualFlattenNow` is the only manual flatten control in this gate.

## Dashboard

The EA uses `Comment()` because this prototype is for fast Strategy Tester
visual audit rather than polished runtime UI.

Account-level fields:

- gate/build name;
- mode;
- enabled symbol count;
- trading gate status;
- hedging account status;
- balance;
- equity;
- open PnL;
- closed EA PnL;
- total MTM;
- current drawdown;
- max observed drawdown;
- free margin;
- margin level;
- total open positions;
- long positions;
- short positions;
- total fills;
- total resets;
- last action;
- last error.

Symbol-level fields:

- symbol;
- bid, ask, spread;
- ADR value used;
- target distance;
- spacing distance;
- magic number;
- open long count/lots;
- open short count/lots;
- long weekly reset count;
- short weekly reset count;
- open PnL;
- closed PnL;
- total MTM;
- swap;
- commission;
- total reset count;
- fill count;
- last action;
- last error.

## CSV Logs

Written to the MT5 Files directory.

Account state:

- `limni_basket_hedge_alpha_v1_account_state_<mode>.csv`

Symbol state:

- `limni_basket_hedge_alpha_v1_symbol_state_<symbol>_<mode>.csv`

Fill/deal log:

- `limni_basket_hedge_alpha_v1_fills_<symbol>_<mode>.csv`

Reset log:

- `limni_basket_hedge_alpha_v1_resets_<symbol>_<mode>.csv`

Closed PnL, commission, and swap are read from MT5 deal history since EA attach.
Open PnL and open swap are read from current positions. Open-position
commission is not exposed by MT5 position properties in this EA and is therefore
not reported separately.

## Compile Proof

Compiler:

- `C:\Program Files\OANDA Global MetaTrader 5 Terminal\MetaEditor64.exe`

Command shape:

```powershell
$src = (Resolve-Path 'automation/mt5/Experts/LimniBasketHedgeEAAlphaV1.mq5').Path
$log = (Resolve-Path 'automation/mt5/Experts').Path + '\LimniBasketHedgeEAAlphaV1.compile.log'
Start-Process -FilePath 'C:\Program Files\OANDA Global MetaTrader 5 Terminal\MetaEditor64.exe' -ArgumentList @('/compile:' + $src, '/log:' + $log) -Wait -PassThru -WindowStyle Hidden
```

Result from `LimniBasketHedgeEAAlphaV1.compile.log`, archived after compile at
`archive/automation/mt5/generated-logs/2026-06-30/limni-basket-hedge-ea-alpha-v1-compile-log.txt`:

- `Result: 0 errors, 0 warnings`
- `.ex5` emitted at
  `automation/mt5/Experts/LimniBasketHedgeEAAlphaV1.ex5`

MetaEditor returned process exit code `1` despite the compile log reporting zero
errors and zero warnings. The log and emitted `.ex5` are the compile evidence.

## One-Pair Visual Strategy Tester

First validation should use one pair only.

Suggested first run:

- EA: `LimniBasketHedgeEAAlphaV1`
- Symbol: one liquid FX pair, for example `EURUSD`
- Mode: `NO_LIMIT_RAW`
- Visual mode: on
- `UseCurrentChartSymbolOnly=true`
- `SymbolsCsv=""`
- `LotSize=0.01`
- `AdrValue=0` for broker-derived 14-day D1 ADR, or set an explicit price
  distance if exact audit comparability is needed.
- `TargetAdrMultiple=1.0`
- `SpacingAdrMultiple=0.2`
- `MaxPositionsPerSymbol=200`
- `EnableTrading=true`
- `AllowLiveTrading=false`

Repeat the same one-pair visual inspection with `Mode=L3_RAW`.

Freedom should capture:

- screenshot/video of initial long+short seed;
- screenshot/video of adverse and favorable expansion fills;
- screenshot/video of a target reset;
- screenshot/video of `L3_RAW` stopping a side after three weekly side resets;
- CSV excerpts for the same events.

## Later Multi-Symbol Strategy Tester

Allowed only after one-pair mechanics are visually accepted.

Use:

- `UseCurrentChartSymbolOnly=false`
- `SymbolsCsv=EURUSD,GBPUSD,...`

The EA will manage each enabled symbol with a deterministic symbol/mode magic
number and symbol-specific logs. Multi-symbol support is built, but all-28
runtime is not validated by this gate.

## Known Limitations

- This is an MT5 mechanics prototype, not a broker-real production system.
- ADR inside MT5 is either explicit `AdrValue` or a simple 14-day D1 high-low
  average. It is not the frozen warehouse ADR derivation.
- The warehouse replay uses close-mark path payloads. The EA uses actual MT5
  bid/ask and actual fills, so exact fill timing can differ.
- L3 follows the repo replay's side-local reset cap. It does not add pair-net
  flattening.
- The `Comment()` dashboard can become long in multi-symbol mode.
- Closed PnL history is session-scoped from EA attach.
- No Strategy Tester visual run was performed in this repo pass; only
  MetaEditor compile was run.

## Final Verdict

`PASS_GATE82_MT5_HEDGED_GRID_VISUAL_PROTOTYPE_BUILT_NO_PROMOTION`

This gate builds and compiles the one-pair-first visual mechanics EA. It does
not validate all-28 execution, live readiness, risk, sizing, or production
profitability.

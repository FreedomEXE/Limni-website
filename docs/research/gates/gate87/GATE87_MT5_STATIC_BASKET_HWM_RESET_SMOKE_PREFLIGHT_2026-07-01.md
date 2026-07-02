# Gate 87 MT5 Static Basket HWM Reset Smoke Preflight

Generated: `2026-07-01`

## Verdict

`PASS_GATE87_MT5_STATIC_BASKET_HWM_RESET_PREFLIGHT_COMPILED_AND_INSTALLED_NO_TESTER_RESULT`

## Scope

Gate 87 adds optional account-equity high-watermark reset mechanics to the
active MT5 raw harvest EA so Freedom can run a static basket lifecycle smoke.

This gate does not change raw harvest rules:

- fully hedged long+short sides;
- `1.0` ADR target;
- `0.2` ADR spacing;
- no direction signal;
- no Candidate B;
- no COT / Strength / Regime;
- no adaptive basket selector;
- no trailing;
- no pair-net flatten;
- no promotion or live-readiness claim.

## Baseline Pain Point

Freedom's six-year EURUSD MT5 run showed that raw continuous one-pair lifecycle
is not acceptable even though the EA did harvest gross gains:

- report: `C:/Users/User/Desktop/LIMNI/eurusd 6 year test.html`
- report SHA256:
  `D2B59B2AB37BD901924FF5C797CD4A64A130736274488E54A1A913656030034A`
- net profit: `$174.51`
- profit factor: `1.01`
- equity drawdown: `$9,808.87` / `78.61%`
- total trades: `6,680`
- final forced liquidation: `149` open positions
- normal closed price profit: about `$10,566.73`
- normal closed swap: about `$-4,401.41`
- entry commission: about `$-400.80`
- end-of-test forced liquidation price PnL: about `$-5,847.41`

Interpretation: the pain point is stale inventory, hold time, swap/carry, and
end-of-test liquidation. The next useful experiment is lifecycle reset, not
target/spacing overfit.

## EA Changes

Added optional inputs:

- `EquityHwmResetEnabled=false`
- `EquityHwmResetTargetMoney=500.0`
- `EquityHwmResetCooldownSeconds=60`
- `EquityHwmCsvLogEnabled=true`

When enabled, the EA tracks a cycle start equity. If account equity reaches:

```text
cycle_start_equity + EquityHwmResetTargetMoney
```

the EA closes all positions managed by this EA across configured symbols,
resets all leg anchors, starts a new cycle from post-close equity, and waits
until the next manage cycle before opening fresh positions.

`EquityHwmCsvLogEnabled` writes the basket-level reset receipt even when heavy
fill-level `CsvLogEnabled` is disabled. The reset file is:

```text
limni_basket_hedge_alpha_v3_equity_hwm_resets.csv
```

## Compile Evidence

Repo compile:

- compiler:
  `C:/Program Files/OANDA Global MetaTrader 5 Terminal/MetaEditor64.exe`
- log:
  `docs/research/gates/gate87/artifacts/limni-basket-hedge-ea-alpha-v3-gate87-repo-compile-log.txt`
- result: `0 errors, 0 warnings`

Active terminal compile:

- compiler:
  `C:/Users/User/AppData/Roaming/Five Percent Online MetaTrader 5 - alt/MetaEditor64.exe`
- log:
  `docs/research/gates/gate87/artifacts/limni-basket-hedge-ea-alpha-v3-gate87-active-terminal-compile-log.txt`
- result: `0 errors, 0 warnings`

## Install Evidence

Active terminal data root:

```text
C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB
```

Installed active terminal files:

- `MQL5/Experts/LimniBasketHedgeEAAlphaV3.mq5`
- `MQL5/Experts/LimniBasketHedgeEAAlphaV3.ex5`
- `MQL5/Experts/Include/Strategy/RawHarvestEngine.mqh`

Repo and active-terminal source hashes match:

- `LimniBasketHedgeEAAlphaV3.mq5`:
  `B75EB3D2C0020B5B7D82DDB4CA289FDE96AFE1C55D901640B1C63C133FC37926`
- `RawHarvestEngine.mqh`:
  `E09FD57B3898C4E1251490CF434CF8F68F12ACE768154188D51CDBED2A8F3EF7`

Compiled `.ex5` hashes:

- repo OANDA compile:
  `7FA2F261ACFD6C30AAF146EF2C01FDF83791920C34C0E7D93B77FBC40051DF52`
- active terminal compile:
  `A9E767348BEFB7C1F47E59E0437366A4560E344C56614A516AD9AF2DC3BA0204`

## Recommended Static Basket Smoke

Run `HWM OFF` and `HWM ON` with the same basket/settings.

EA:

```text
LimniBasketHedgeEAAlphaV3
```

Chart symbol/timeframe:

```text
EURUSD,M1
```

Focused static basket:

```text
AUDNZD,AUDUSD,EURCHF,EURGBP,EURUSD,GBPCHF,GBPJPY,GBPUSD,NZDUSD,USDCHF,USDJPY
```

Common inputs:

- `SymbolsCsv=AUDNZD,AUDUSD,EURCHF,EURGBP,EURUSD,GBPCHF,GBPJPY,GBPUSD,NZDUSD,USDCHF,USDJPY`
- `UseCurrentChartSymbolOnly=false`
- `LotSize=0.01`
- `TargetAdrMultiple=1.0`
- `SpacingAdrMultiple=0.2`
- `CsvLogEnabled=false`
- `EquityHwmCsvLogEnabled=true`
- `DashboardEnabled=false`
- `EnableTimer=false`
- `TesterCadence=RH_CADENCE_NEW_M1_BAR` for first rough lifecycle smoke
- `TesterMinSecondsBetweenManage=0`
- `AdrRefreshSeconds=3600`
- `DrawdownRefreshSeconds=60`

HWM OFF:

- `EquityHwmResetEnabled=false`

HWM ON:

- `EquityHwmResetEnabled=true`
- `EquityHwmResetTargetMoney=500.0`
- `EquityHwmResetCooldownSeconds=60`

If `NEW_M1_BAR` shows a real lifecycle improvement, repeat the HWM ON run with
`TesterCadence=RH_CADENCE_EVERY_TICK` before treating it as stronger MT5
evidence.

## Interim Manual Tester Notes

Freedom reported the `$500` HWM target failed around the same 2021 choke point
seen in the raw EURUSD run. A `$100` target, about `1%` of a `$10,000` account,
also failed around 2022. A `$10` target almost survived but still failed in
2025, with the account moving from roughly `$15,000` back toward `$10,000`,
which is unacceptable. A `$1` target is the active manual follow-up smoke.

The fixed-money target is temporary test scaffolding. If HWM shows lifecycle
value, replace or supplement it with an ADR-normalized target, likely scaled by
active symbols and lot sizing instead of fixed dollars.

Fixed `LotSize=0.01` is also temporary smoke-test scaffolding. If HWM shows
lifecycle value, add a later sizing gate so lot size scales with account equity
or risk budget and remains coherent with the reset target. Do not change sizing
inside the current HWM smoke while Freedom is still mapping target failure
thresholds.

Freedom then reported the `$1` target also appears to be failing. If `$1` fails
cleanly, the working read is that one-pair fixed-target HWM optimization is
probably not enough by itself. Do not keep shrinking HWM indefinitely as if a
magic target will solve the lifecycle.

Park the next lifecycle design review around:

- LWM / equity floor: flatten when cycle equity falls below a defined low-water
  threshold;
- stale-age closure: flatten or stop adding when a cycle or position set has
  been open too long, such as one month, especially if still below cycle start;
- account-equity profit trailing: after a cycle reaches a profit activation
  level, trail total account equity and flatten all managed positions when
  equity gives back too much.

Trailing must be defined carefully before coding. The first safest candidate is
account-level equity trailing that flattens the whole managed cycle. Avoid a
first version that simply closes winners and leaves losers, because that can
recreate the stale-inventory failure. Side-level trailing or runner logic is a
separate, riskier design question.

## Parked Later Directional Gate

After raw both-side HWM testing, save a later MT5 research gate for Candidate B
directional harvest logic in the EA/MQH include path. The first version should
test whether choosing one side from weekly direction has merit on the same MT5
execution surface.

Candidate B logic is deliberately not part of Gate 87. Do not use it to mask the
current raw-HWM question. If opened later, avoid forced loss-making flips as the
first design; prefer cycle-boundary direction refresh after HWM reset, or a
profit-only / stop-adding-new-exposure handling of stale direction.

## Metrics To Compare

- final net profit;
- equity drawdown;
- balance drawdown;
- total trades/deals;
- max and average holding time;
- total swap;
- reset count from `limni_basket_hedge_alpha_v3_equity_hwm_resets.csv`;
- average time between resets;
- positions purged per reset;
- open PnL and open swap before each reset;
- final end-of-test forced liquidation count and loss.

## Stop Line

Gate 87 is a compiled/install preflight for a static-basket HWM reset smoke. It
is not an MT5 tester result, strategy promotion, optimized HWM target, adaptive
basket selector, risk layer, or live-readiness claim.

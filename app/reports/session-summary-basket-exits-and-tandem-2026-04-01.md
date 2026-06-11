# Session Summary: Basket Exits and Tandem Research

Date: 2026-04-01
Author: Codex
Status: Research only. No app wiring or production behavior changes were made.

## Executive Summary

Nothing was wired into the app.

I added and ran [backtest-basket-exit-grid.ts](C:/Users/User/Documents/GitHub/limni-website/scripts/backtest-basket-exit-grid.ts) to test `120` basket exit configs across the `6` active weekly-hold strategies with canonical engine parity. The first pass exposed a parity issue in the Friday-close fallback, I fixed that, reran it, and got exact baseline parity against the engine. Main conclusion: there is no clean universal TP/trail/SL config worth shipping yet, especially with only `10` realized weeks. The best compromise was `TP 0.15 / Trail 0.15 / SL 0.10`, but it still hurt Dealer and 2-of-3 Agree, so I agree with the decision not to add this yet.

Then I added and ran [backtest-tandem-sleeve-portfolios.ts](C:/Users/User/Documents/GitHub/limni-website/scripts/backtest-tandem-sleeve-portfolios.ts) and saved the writeup in [tandem-sleeve-portfolios-2026-04-01.md](C:/Users/User/Documents/GitHub/limni-website/reports/tandem-sleeve-portfolios-2026-04-01.md). That tested the actual portfolio thesis: treat each model basket as its own sleeve so one can stop while others continue. Result: shared-basket exits were mostly not useful, but independent sleeve management was much more promising. The strongest base portfolio on this window was `tandem_3 = dealer + sentiment + strength`; `commercial` remained a drag as a capital sleeve, though it still makes sense to keep it for data collection.

The main numbers from the tandem work were:

- Current canonical `commercial`: `-38.07%`, `-42.04% DD`
- Current canonical legacy `tandem` (`dealer + commercial + sentiment`): `+127.51%`, `-24.24% DD`
- `tandem_4` Friday hold: `+208.40%`, `-39.22% DD`
- `tandem_3` Friday hold: `+246.47%`, `-29.22% DD`
- `tandem_3` sleeve-managed `0.15 / 0.15 / 0.10`: `+230.08%`, `-10.93% DD`, only `2` losing weeks
- Best qualitative finding: independent sleeves helped in exactly the kind of weeks being discussed, where one or two baskets were cut and another kept running

Current state:

- `tandem` in the app code is still the legacy 3-model version
- `strength` is still separate
- No app behavior, strategy definition, or UI wiring was changed

If the next step is delayed for discussion with Nyx, that makes sense. The first low-risk next step is to change current tandem to include strength so the combined picture is easier to view, without committing to any exit logic yet.

## Scope of Work

This session covered two distinct research branches:

1. Universal basket-level exits across the six active weekly-hold strategies
2. Tandem portfolio construction using independent model sleeves

No engine logic was modified. All work stayed in standalone research scripts and Markdown reports.

## Inputs and Reference Docs

- Prompt / spec: [CODEX_BASKET_TP_SL_OPTIMIZATION_2026-04-01.md](C:/Users/User/Documents/GitHub/limni-website/docs/CODEX_BASKET_TP_SL_OPTIMIZATION_2026-04-01.md)
- Canonical protocol: [BACKTEST_CANONICAL_PROTOCOL.md](C:/Users/User/Documents/GitHub/limni-website/docs/BACKTEST_CANONICAL_PROTOCOL.md)
- Canonical basket source: [basketSource.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/basketSource.ts)
- Canonical engine: [weeklyHoldEngine.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/weeklyHoldEngine.ts)
- Strategy definitions: [strategyConfig.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/strategyConfig.ts)

## Artifacts Created

### Scripts

- [backtest-basket-exit-grid.ts](C:/Users/User/Documents/GitHub/limni-website/scripts/backtest-basket-exit-grid.ts)
- [backtest-tandem-sleeve-portfolios.ts](C:/Users/User/Documents/GitHub/limni-website/scripts/backtest-tandem-sleeve-portfolios.ts)

### Reports

- [tandem-sleeve-portfolios-2026-04-01.md](C:/Users/User/Documents/GitHub/limni-website/reports/tandem-sleeve-portfolios-2026-04-01.md)
- [session-summary-basket-exits-and-tandem-2026-04-01.md](C:/Users/User/Documents/GitHub/limni-website/reports/session-summary-basket-exits-and-tandem-2026-04-01.md)

## Tests and Commands Run

These are the substantive tests run during the session.

1. Universal basket-exit grid, first run:

```powershell
npx tsx scripts\backtest-basket-exit-grid.ts
```

Outcome:

- Script ran successfully
- Exposed parity drift in the Friday-close fallback
- Showed that reconstructing Friday close from the daily path was not acceptable for canonical parity

2. Universal basket-exit grid, corrected rerun:

```powershell
npx tsx scripts\backtest-basket-exit-grid.ts
```

Outcome:

- Exact parity achieved for all six strategies
- Full `120 x 6` sweep completed
- Established that there is no clean universal exit config worth shipping yet

3. Ad hoc canonical baseline probe for current weekly-hold strategy baselines:

This was run via a temporary helper script created only for the probe and deleted immediately after use.

```powershell
npx tsx scripts\tmp-weekly-hold-baselines.ts
```

Probe outputs:

- `commercial`: `weeks=10 net=-38.07 dd=-42.04 trades=224`
- `tandem`: `weeks=10 net=127.51 dd=-24.24 trades=719`
- `dealer`: `weeks=10 net=73.18 dd=-2.19 trades=230`
- `sentiment`: `weeks=10 net=92.40 dd=-19.56 trades=265`
- `strength`: `weeks=10 net=80.89 dd=-14.98 trades=335`

4. Tandem sleeve portfolio study:

```powershell
npx tsx scripts\backtest-tandem-sleeve-portfolios.ts
```

Outcome:

- Legacy tandem Friday-hold sleeve sum matched engine tandem exactly
- Tested legacy tandem, `tandem_4`, and `tandem_3`
- Compared shared-basket vs independent-sleeve exits
- Confirmed that independent sleeves are more promising than one shared tandem basket stop

## Basket Exit Research: What Was Learned

### Goal

Find one standard basket exit config that could improve risk-adjusted returns across all six weekly-hold strategies.

### Strategies tested

- `dealer`
- `sentiment`
- `tiered_v3`
- `agree_2of3`
- `selector_sentiment_override`
- `strength`

### Result

No universal no-hurt configuration was found.

Best overall compromise from the capped cross-strategy ranking:

- `TP 0.15 / Trail 0.15 / SL 0.10`

But that still hurt:

- `Dealer`
- `2-of-3 Agree`

### Important per-strategy read

- `Dealer` does not want the stop loss. It performed best with trailing and no SL.
- `Sentiment` benefited strongly from `SL 0.10`.
- `Tiered V3` also benefited clearly from the SL.
- `Selector` improved materially on risk-adjusted terms with the SL.
- `Strength` benefited from tighter risk control, though not always from the exact same configuration.
- `Agree` liked a wider SL better than the cross-strategy compromise.

### Conclusion

Do not add basket exits into the app yet.

Rationale:

- only `10` realized weeks
- no universal config
- high risk of overfitting by assigning different TP/SL per strategy at this stage

## Tandem Sleeve Research: What Was Learned

### Goal

Test the idea that each system should be treated as a separate basket inside a larger weekly portfolio so one system can stop out while the others continue.

### Portfolios tested

- `Legacy Tandem` = Dealer + Commercial + Sentiment
- `Tandem 4` = Dealer + Commercial + Sentiment + Strength
- `Tandem 3` = Dealer + Sentiment + Strength

### Variants tested

- `Friday Hold`
- `Shared SL 0.10`
- `Sleeves SL 0.10`
- `Shared 0.15 / 0.15 / 0.10`
- `Sleeves 0.15 / 0.15 / 0.10`

### Headline results

| Portfolio | Variant | Net | Max DD | R/DD | Losing Weeks |
|---|---:|---:|---:|---:|---:|
| Legacy Tandem | Friday Hold | `+127.51%` | `-24.24%` | `5.3x` | 3 |
| Legacy Tandem | Sleeves 0.15 / 0.15 / 0.10 | `+152.58%` | `-17.43%` | `8.8x` | 3 |
| Tandem 4 | Friday Hold | `+208.40%` | `-39.22%` | `5.3x` | 4 |
| Tandem 4 | Sleeves 0.15 / 0.15 / 0.10 | `+218.82%` | `-15.63%` | `14.0x` | 3 |
| Tandem 3 | Friday Hold | `+246.47%` | `-29.22%` | `8.4x` | 4 |
| Tandem 3 | Sleeves 0.15 / 0.15 / 0.10 | `+230.08%` | `-10.93%` | `21.0x` | 2 |

### Main interpretations

1. `Commercial` remains a drag as a capital sleeve.
2. `Tandem 3` is the strongest base portfolio on this window.
3. Shared-basket stop logic does not capture the desired diversification behavior well.
4. Independent sleeve management is much closer to the intended architecture.
5. The decision frontier appears to be:
   - max raw return: `Tandem 3 Friday Hold`
   - lower drawdown / fewer bad weeks: `Tandem 3 Sleeves 0.15 / 0.15 / 0.10`

### Important qualitative examples

Week `03-09` was the clearest example of sleeve logic helping:

- `Legacy Tandem` Friday hold: `-10.5%`
- `Legacy Tandem` sleeves `0.15 / 0.15 / 0.10`: `+4.2%`
- `Tandem 4` Friday hold: `-12.4%`
- `Tandem 4` sleeves `0.15 / 0.15 / 0.10`: `+15.3%`
- `Tandem 3` Friday hold: `-5.2%`
- `Tandem 3` sleeves `0.15 / 0.15 / 0.10`: `+17.6%`

This is the kind of week where one sleeve can be cut while another continues and carries the portfolio.

## Current Recommendation

Do not wire exits into the app yet.

The first low-risk, non-destructive next step is:

- change current tandem to include `strength` so the combined picture is easier to inspect in one place

That keeps the next move simple:

- no exit logic change
- no commitment to a universal basket stop
- better visibility into whether strength belongs in the main combined portfolio view

## Deferred Decisions

These decisions are intentionally left open:

- whether `commercial` should stay as a capital sleeve
- whether `tandem` should become `tandem_4` or `tandem_3`
- whether any basket exit logic should be added later
- whether forward testing should compare `tandem_3` hold vs sleeve-managed variants

## Final Session Position

This session produced useful research, but not a deployment decision.

What seems strongest at the end of the day:

- universal basket exits are not ready
- independent sleeves are more promising than shared tandem stops
- `dealer + sentiment + strength` is currently the strongest portfolio construction tested
- `commercial` still matters as data, but does not currently justify confidence as an allocated sleeve

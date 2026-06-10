# ADR Grid Runner, Trailing, and Cost Sensitivity Research

Date: 2026-06-02

## Scope

This note captures the high-level result of the ADR Grid variant research run on canonical app data.

Test script:

- `scripts/backtest-adr-grid-runner-refill.ts`

Data window:

- 19 realized app-style weeks
- `2026-01-19T00:00:00.000Z` through `2026-05-24T23:00:00.000Z`

Primary comparison:

- Tandem
- ADR Grid
- Pair Fill Cap ON
- H1 path bars
- ADR-normalized return mode

## Variants Tested

### Current App Close/Rearm

The current app ADR Grid:

- no seed trade at execution open
- each grid fill closes fully at the next `0.20 ADR` step
- the level rearms on the next bar
- active pair fill cap is enforced
- basket reset closes active fills at the app's `1x ADR` reset condition

### Runner/Refill

The proposed runner/refill idea:

- first TP closes half
- the other half stays open as a runner
- later same-level fills only refill the missing half
- also tested with an execution-open seed trade

### Trailing Runner

Trailing variants were tested in two families:

- half TP at `+0.20 ADR`, then trail the remaining half
- whole-fill trail after price first reaches the normal `+0.20 ADR` TP

Trail distances tested:

- `0.20 ADR`
- `0.40 ADR`

Trailing stop rule:

- trail only arms after the normal grid TP is reached
- stop checks use the previous confirmed H1 trail before updating from the next H1 bar
- this avoids assuming a favorable intrabar order that the H1 data cannot prove

## Pair Fill Cap Interpretation

For runner/refill variants, pair cap was counted in full-size-equivalent units:

- full grid fill = `1.0`
- half runner = `0.5`
- refill half = `0.5`

This matches the user's intended semantics: the cap controls full-sized exposure, not arbitrary fill count.

## Main Result: Tandem + Pair Fill Cap ON

| Variant | Return | Path DD | Return/DD | Path Sharpe | Trades | Max Exposure |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current app close/rearm | +632.67% | 6.26% | 101.10 | 10.05 | 27,529 | 408.0 |
| Runner/refill, no seed | +378.47% | 8.28% | 45.73 | 8.13 | 32,808 | 348.0 |
| Runner/refill, seeded | +355.54% | 9.90% | 35.93 | 7.71 | 31,386 | 365.5 |
| Half TP + trail 0.20 | +413.37% | 8.47% | 48.82 | 8.50 | 38,867 | 326.5 |
| Half TP + trail 0.40 | +371.99% | 8.94% | 41.59 | 8.06 | 37,273 | 342.5 |
| Whole trail 0.20 | +255.59% | 10.38% | 24.61 | 5.85 | 17,360 | 356.0 |
| Whole trail 0.40 | +155.09% | 13.29% | 11.67 | 3.73 | 15,077 | 375.0 |

## Plain-English Read

The runner/refill logic was reasonable in theory because it lets part of a trade stay open for a larger win. In this data, it did not beat the current app.

The likely reason is mechanical:

- the current app banks frequent small grid wins and rearms quickly
- runner/refill keeps exposure open longer
- open runners consume pair fill cap
- consumed cap blocks or delays the fast close/rearm churn that is currently producing most of the return

The best trailing variant was `Half TP + trail 0.20`, but it still lagged the current app:

- return was `219.30%` lower
- path drawdown was `2.21` points higher
- path Sharpe was `1.55` lower

Whole-fill trailing performed worse because it changes reentry behavior the most. The grid first has to reach `+0.20 ADR`, then it holds the whole fill instead of banking the win, and the level waits until the runner exits before reentering.

## Cost Sensitivity

The cost model was added after noting that the current app creates many smaller trades, so spreads and commissions should hit it harder than runner systems.

Cost model:

- cost is applied per full-size-equivalent closed trade
- a full close pays `1.0x` cost
- a half close pays `0.5x` cost
- costs are subtracted from each trade before rebuilding path DD and path Sharpe

Tandem + Pair Fill Cap ON:

| Cost/FSE | Current App Sharpe | Half TP + Trail 0.20 Sharpe | Current App Return | Half TP + Trail 0.20 Return |
| ---: | ---: | ---: | ---: | ---: |
| 0.0000% | 10.05 | 8.50 | +632.67% | +413.37% |
| 0.0025% | 9.36 | 7.57 | +563.85% | +360.02% |
| 0.0050% | 8.13 | 6.26 | +495.03% | +306.67% |
| 0.0100% | 4.98 | 3.42 | +357.38% | +199.96% |
| 0.0200% | 0.72 | -0.15 | +82.09% | -13.44% |
| 0.0300% | -1.16 | -1.72 | -193.20% | -226.85% |

Costs narrow the gap, but in the tested cost bands they did not flip the winner. At extreme costs, every variant starts degrading hard.

For FX-only deployment, the low bands may be realistic on liquid majors with a raw/commission account. They are less reliable for crosses, minors, rollover, news, late Friday, and Sunday open. Future FX-only cost testing should split majors, crosses, and stress-session assumptions.

## Seeded Current-App ADR Grid Follow-Up

After the runner/refill work, we tested the simpler difference between the app and the user's original expectation:

- add one initial ADR Grid trade at execution/week open
- keep the current app's full close/rearm behavior
- keep the same `0.20 ADR` TP step
- keep pair fill cap behavior
- do not convert it into runner/refill logic

This was important because the previous seeded test applied to runner/refill, not the current app grid.

Primary result, Tandem + Pair Fill Cap ON:

| Variant | Return | Path DD | Return/DD | Path Sharpe | Trades | Max Exposure |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current app close/rearm | +632.67% | 6.26% | 101.10 | 10.05 | 27,529 | 408.0 |
| Current app + execution-open seed | +631.08% | 8.72% | 72.41 | 10.02 | 28,435 | 340.0 |

Plain-English result:

- the execution-open seed did not improve the capped Tandem baseline
- return was `1.60%` lower
- path DD was `2.46` points higher
- return/DD fell from `101.10` to `72.41`
- path Sharpe was almost unchanged, but slightly lower

Cost-adjusted note:

- under moderate simulated costs, the seed sometimes improved path Sharpe and drawdown shape
- it still reduced return versus the current app baseline
- this makes it a cost-shape research option, not a default upgrade

Uncapped note:

- without pair fill cap, the seed increased return slightly
- because the production/default research lens is pair fill cap ON, this is not enough to promote it

## Current Conclusion

Do not replace the current ADR Grid close/rearm logic with runner/refill or trailing runner based on this test.

The current app logic remains the best tested ADR Grid variant by:

- return
- path drawdown
- return/DD
- path Sharpe

The runner/trailing ideas remain useful as design references, especially if a future live execution study proves costs are much higher than this sensitivity model.

The execution-open seed should also stay as a research option, but not as the default ADR Grid behavior.

## Follow-Up Tests

### 1. Weekly Hold With ADR Closure / Trailing Exit

Completed in:

- `docs/research/WEEKLY_HOLD_ADR_EXIT_RESEARCH_2026-06-02.md`

Exit logic tested on Weekly Hold:

- baseline Weekly Hold
- Weekly Hold with `1x ADR` favorable closure
- Weekly Hold with trailing stop after favorable movement
- possibly combine fixed weekly hold and ADR closure as a hybrid

Rationale:

- Weekly Hold is simpler to test and automate than ADR Grid
- Weekly Hold has fewer trades, so spread/commission drag should be lower
- if profitable, a hybrid could let Weekly Hold larger-position trades offset commission drag from smaller ADR Grid trades
- ADR Grid and Weekly Hold may complement each other: grid harvests movement, hold captures sustained direction

First-pass result:

- `Trail after +1x ADR, 0.40 ADR distance` was the best tested Weekly Hold exit variant for both Tandem and Tiered.
- Next step is cost sensitivity and FX-only / asset-class split.

### 2. Validate Seed Mirror If Needed

If the execution-open seed becomes interesting again, validate the custom no-seed mirror against the canonical app engine before treating seed results as implementation-grade.

## Verification

Commands run:

- `npx tsc --noEmit --pretty false`
- `npx tsx scripts/backtest-adr-grid-runner-refill.ts`

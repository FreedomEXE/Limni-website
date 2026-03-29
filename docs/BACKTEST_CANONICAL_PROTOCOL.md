# Canonical Backtest Protocol

Date: 2026-03-29
Status: ACTIVE
Owner: Codex + Freedom

## Purpose

This protocol exists to stop strategy research from drifting away from the app's real source of truth.

Any weekly-bias or intraday backtest is only valid if it can be reconciled to the same canonical inputs the app uses.

If a new script cannot match canonical app baselines, stop research immediately and fix parity first.

## Source Of Truth

### Weekly dealer / commercial / sentiment bias

The canonical weekly base-model source is:

- [basketSource.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/basketSource.ts)

This module is the approved source for:

- `dealer`
- `commercial`
- `sentiment`

It sits below the strategy engine and above raw data stores.

If interpretation changes, fix it there.

### What the app sections mean

- Data section sentiment shows raw sentiment context from aggregates
- Sentiment trading direction is contrarian to crowding
- Performance weekly-hold uses the canonical strategy engine
- Matrix is a display layer and must not be treated as the canonical research source

Do not infer research truth from UI wording alone.

## Canonical Strategy Engine Path

Approved engine path:

- [weeklyHoldEngine.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/weeklyHoldEngine.ts)
- [strategyPageData.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/strategyPageData.ts)

Approved weekly-bias strategy config:

- [strategyConfig.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/strategyConfig.ts)

Approved current app comparison surface:

- [compare-weekly-bias-selector-vs-app-baselines.ts](C:/Users/User/Documents/GitHub/limni-website/scripts/compare-weekly-bias-selector-vs-app-baselines.ts)
- [rank-current-intraday-strategies.ts](C:/Users/User/Documents/GitHub/limni-website/scripts/rank-current-intraday-strategies.ts)

## Validation Gate

Before trusting any new backtest result, first reproduce the canonical app baselines on the same closed-week window.

### Weekly hold baselines

On the exact closed-week comparison window:

- `dealer`: `+116.64%`, max DD `-40.71%`
- `commercial`: `+28.92%`, max DD `-69.34%`
- `sentiment`: `+129.13%`, max DD `-21.66%`
- `tiered_v3`: `+137.21%`, max DD `-22.89%`
- `agree_2of3`: `+114.98%`, max DD `-21.30%`

### Intraday ADR baselines

On the same canonical closed-week window:

- `sentiment + ADR`: `+49.47%`, max DD `-8.78%`
- `tiered_v3 + ADR`: `+49.16%`, max DD `-9.57%`

If a new research script cannot match these numbers closely enough, do not use its outputs.

## Required Workflow

Every new weekly-bias or intraday backtest must follow this order:

1. Identify the exact strategy family and comparison window.
2. Confirm the script is reading canonical weekly directions from [basketSource.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/basketSource.ts) or from an engine path that already depends on it.
3. Reproduce the relevant canonical baseline first.
4. Only after parity is confirmed, run the new variant.
5. Compare the variant against the canonical baseline on the same week set.
6. Clearly label whether the result is:
   - canonical app baseline
   - canonical engine variant
   - forced full-basket experiment
   - filtered experiment

## Banned Mistakes

These mistakes invalidate results:

- comparing a forced full-basket experiment to an app weekly-hold baseline without saying they are different experiments
- using Matrix display output as the research source of truth
- using UI wording alone to infer sentiment direction
- mixing current or future weeks into a closed-week benchmark without explicitly stating it
- treating a display mismatch as proof of a strategy mismatch before checking the underlying canonical source
- building dealer, commercial, or sentiment directions independently from raw snapshots when [basketSource.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/basketSource.ts) already defines them

## Practical Notes

### Sentiment interpretation

Current app logic is contrarian:

- `CROWDED_LONG` => trade `SHORT`
- `CROWDED_SHORT` => trade `LONG`
- `NEUTRAL` => no trade

That mapping lives in:

- [daily.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/sentiment/daily.ts)

### March 22 / March 23 lesson

One important lesson from the March 22 investigation:

- Data, Performance, and Matrix can look inconsistent because they may be showing different semantics
- the first step is always to compare:
  - raw crowding
  - derived trade direction
  - strategy engine trades
  - displayed board rows

Do not invalidate research from screenshots alone.

## Hand-off Rule

When handing off to Nyx or starting a fresh Codex session, include this exact instruction:

`Before any new backtest, verify parity against canonical app baselines using basketSource.ts and the approved closed-week window. If parity fails, stop research and fix parity first.`

## Related Docs

- [WEEKLY_BIAS_CONTEXT_ENGINE_SPEC_2026-03-29.md](C:/Users/User/Documents/GitHub/limni-website/docs/bots/WEEKLY_BIAS_CONTEXT_ENGINE_SPEC_2026-03-29.md)
- [WEEKLY_BIAS_SELECTOR_SENTIMENT_OVERRIDE_HANDOFF_2026-03-29.md](C:/Users/User/Documents/GitHub/limni-website/docs/bots/WEEKLY_BIAS_SELECTOR_SENTIMENT_OVERRIDE_HANDOFF_2026-03-29.md)
- [CODEX_WEEKLY_RECONSTRUCTION_PROMPT.md](C:/Users/User/Documents/GitHub/limni-website/docs/CODEX_WEEKLY_RECONSTRUCTION_PROMPT.md)
